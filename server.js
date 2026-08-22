#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Server
   Hält Spieler, Chips und Feed zentral, damit das Leaderboard
   für alle gleich ist. Ohne Abhängigkeiten: nur Node.
       node server.js        →  http://localhost:3000
   ═══════════════════════════════════════════════════════════ */
'use strict';

var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var PORT = Number(process.env.PORT) || 3000;
var HOST = process.env.HOST || '0.0.0.0';

/* ─────────────── Betrieb hinter einem Reverse-Proxy ───────────────
   BASE_PATH=/gamba  → die Seite liegt nicht auf der Wurzel der Domain,
   sondern in einem Unterpfad. Der Server nimmt dann sowohl /gamba/api/state
   als auch /api/state an — je nachdem, ob der Proxy den Prefix schon
   entfernt hat. Alle Pfade im HTML sind relativ, deshalb reicht das.
   TRUST_PROXY=1     → die echte Besucher-IP steht in X-Forwarded-For.
   Ohne das teilen sich alle Besucher die Brute-Force-Bremse, weil aus
   Sicht des Servers jede Anfrage vom Proxy-Container kommt. */
var BASE_PATH = (function (b) {
  b = String(b || '').trim();
  if (!b || b === '/') return '';
  if (b.charAt(0) !== '/') b = '/' + b;
  return b.replace(/\/+$/, '');
})(process.env.BASE_PATH);
var TRUST_PROXY = /^(1|true|yes)$/i.test(String(process.env.TRUST_PROXY || ''));

/* ─────────────── TLS (Let's Encrypt) ───────────────
   Entweder die beiden Pfade direkt setzen:
     SSL_CERT=/etc/letsencrypt/live/deine.domain/fullchain.pem
     SSL_KEY=/etc/letsencrypt/live/deine.domain/privkey.pem
   oder kurz ueber die Domain:
     SSL_DOMAIN=deine.domain
   Ohne diese Angaben laeuft alles wie bisher ueber HTTP. */
var SSL_DOMAIN = process.env.SSL_DOMAIN || '';
var SSL_CERT = process.env.SSL_CERT ||
  (SSL_DOMAIN ? '/etc/letsencrypt/live/' + SSL_DOMAIN + '/fullchain.pem' : '');
var SSL_KEY = process.env.SSL_KEY ||
  (SSL_DOMAIN ? '/etc/letsencrypt/live/' + SSL_DOMAIN + '/privkey.pem' : '');
/* Port fuer die Weiterleitung von http auf https, z.B. HTTP_REDIRECT_PORT=80 */
var REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT) || 0;

function readTLS() {
  if (!SSL_CERT || !SSL_KEY) return null;
  try {
    return { cert: fs.readFileSync(SSL_CERT), key: fs.readFileSync(SSL_KEY) };
  } catch (e) {
    console.error('[gambaking] Zertifikat nicht lesbar (' + e.code + '): ' + e.path);
    console.error('            Laeuft der Server als der richtige Benutzer? ' +
                  'Die Dateien unter /etc/letsencrypt gehoeren normalerweise root.');
    return null;
  }
}
var ROOT = __dirname;
/* Im Container zeigt DATA_DIR auf ein Volume, damit die Konten ein
   `docker compose up --build` ueberleben. */
var DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
var DATA_FILE = path.join(DATA_DIR, 'gambaking.json');

var START_BALANCE = 500;
var BAILOUT = 50;
var FEED_MAX = 40;
var TOKEN_TTL = 6 * 3600 * 1000; // Admin-Login gilt 6 Stunden

/* ─────────────── Datenhaltung ─────────────── */

function emptyDB() {
  return {
    players: {},
    feed: [],
    /* Statistik: jede abgerechnete Runde und jede Anmeldung mit Zeitstempel.
       Aus diesen zwei Listen rechnet /api/stats alles aus, was das
       Admin-Panel zeigt — Durchschnitte, Verläufe, welches Spiel für die
       Spieler positiv läuft. Gekürzt wird nach Alter und nach Anzahl. */
    runden: [],
    logins: [],
    /* Protokoll beendeter Partys: Einstellungen, Endstand und Auszahlung
       je Sitzung. Geschrieben wird es von mp.js, gelesen ueber /api/partys. */
    partyLog: [],
    /* spielLuck: Feinjustierung je Spiel, 0..100 mit 50 als neutral. Was
       nicht drinsteht, laeuft neutral — deshalb ein leeres Objekt und keine
       Liste aller Spiele: welche es gibt, weiss der Browser. */
    settings: {
      adminPin: process.env.GAMBAKING_PIN || '1337',
      spielLuck: {},
      /* spielRegel: was der Admin je Spiel festlegt — { aus, min, max }.
         Auch hier steht nur drin, was vom Normalfall abweicht: aus = die
         Kachel verschwindet fuer alle, min/max begrenzen den Einsatz
         (0 heisst: die Grenze des Spiels selbst gilt). */
      spielRegel: {},
      /* Naechster Wipe: Zeitpunkt in Millisekunden, 0 = keiner geplant.
         wipeXp sagt, ob dabei auch die Stufen fallen. */
      wipeAt: 0,
      wipeXp: false
    }
  };
}

function loadDB() {
  try {
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    var db = JSON.parse(raw);
    db.players = db.players || {};
    db.feed = db.feed || [];
    db.runden = Array.isArray(db.runden) ? db.runden : [];
    db.logins = Array.isArray(db.logins) ? db.logins : [];
    db.partyLog = Array.isArray(db.partyLog) ? db.partyLog : [];
    db.settings = Object.assign(emptyDB().settings, db.settings || {});
    if (!db.settings.spielLuck || typeof db.settings.spielLuck !== 'object') db.settings.spielLuck = {};
    if (!db.settings.spielRegel || typeof db.settings.spielRegel !== 'object') db.settings.spielRegel = {};
    return db;
  } catch (e) {
    return emptyDB();
  }
}

var db = loadDB();
var saveTimer = null;

function writeDB() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    var tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DATA_FILE);            // atomar ersetzen
  } catch (e) {
    console.error('[gambaking] Speichern fehlgeschlagen:', e.message);
  }
}

function saveDB() {
  if (saveTimer) return;                      // gebündelt schreiben
  saveTimer = setTimeout(function () {
    saveTimer = null;
    writeDB();
  }, 120);
}

/**
 * Beim Beenden sofort schreiben — sonst faellt der letzte Spielzug weg.
 *
 * Frueher stand hier ein "if (!saveTimer) return". Das sah sparsam aus, war
 * aber die Stelle, an der Chips verschwanden: beim Herunterfahren bucht
 * mp.shutdown() alle Stapel von den Tischen zurueck aufs Konto, ohne einen
 * Speicher-Timer zu setzen. Ohne laufenden Timer schrieb flushDB dann gar
 * nichts, und nach dem Neustart waren die Chips weg. Beim Beenden ist ein
 * Schreibvorgang zu viel harmlos, ein fehlender nicht.
 */
function flushDB() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  writeDB();
}

/* ─────────────── Passwoerter ─────────────── */

/** scrypt mit zufaelligem Salt; im Klartext wird nie etwas gespeichert. */
function hashPw(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  try {
    var parts = String(stored || '').split(':');
    if (parts.length !== 2) return false;
    var a = Buffer.from(crypto.scryptSync(String(pw), parts[0], 32).toString('hex'), 'hex');
    var b = Buffer.from(parts[1], 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

/* ─────────────── Brute-Force-Bremse ───────────────
   Sobald der Server oeffentlich erreichbar ist, darf niemand Passwoerter
   durchprobieren: nach 8 Fehlversuchen ist die Kombination aus IP und Name
   fuer 15 Minuten gesperrt. Ein erfolgreicher Login loescht den Zaehler. */

var LOGIN_MAX = 8;
var LOGIN_WINDOW = 15 * 60 * 1000;
var loginTries = new Map();

/** Echte Besucher-IP — hinter Traefik steckt sie in X-Forwarded-For. */
function clientIP(req) {
  if (TRUST_PROXY) {
    var fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '?';
}
function loginKey(req, name) {
  return clientIP(req) + '|' + String(name || '').toLowerCase();
}
function loginBlocked(key) {
  var e = loginTries.get(key);
  if (!e) return 0;
  if (Date.now() - e.first > LOGIN_WINDOW) { loginTries.delete(key); return 0; }
  if (e.n < LOGIN_MAX) return 0;
  return Math.ceil((e.first + LOGIN_WINDOW - Date.now()) / 60000);
}
function loginFailed(key) {
  var e = loginTries.get(key);
  if (!e || Date.now() - e.first > LOGIN_WINDOW) e = { n: 0, first: Date.now() };
  e.n++;
  loginTries.set(key, e);
}
function loginOk(key) { loginTries.delete(key); }

/* ─────────────── Sitzungen ─────────────── */

var SESSION_TTL = 12 * 3600 * 1000;
var sessions = new Map();   // Token -> { id, exp }

function newSession(playerId) {
  var t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, { id: playerId, exp: Date.now() + SESSION_TTL });
  return t;
}
/** Gibt die Spieler-ID zurueck, oder null. */
function sessionPlayer(t) {
  if (!t) return null;
  var s = sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(t); return null; }
  return db.players[s.id] ? s.id : null;
}
function dropSessionsOf(playerId) {
  sessions.forEach(function (v, k) { if (v.id === playerId) sessions.delete(k); });
}

/* ─────────────── Admin-Token ─────────────── */

var tokens = new Map();

function issueToken() {
  var t = crypto.randomBytes(24).toString('hex');
  tokens.set(t, Date.now() + TOKEN_TTL);
  return t;
}
function validToken(t) {
  if (!t) return false;
  var exp = tokens.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { tokens.delete(t); return false; }
  return true;
}

/* ─────────────── Helfer ─────────────── */

function clean(str, max) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/[\u0000-\u001f\u007f]/g, '')   // Steuerzeichen raus
    .slice(0, max);
}
function int(v) {
  var n = Math.floor(Number(v));
  return isFinite(n) ? n : 0;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/** Zehntel-genaue Zahl — fuer die Glueckswerte, die feiner als ganzzahlig sind. */
function zehntel(v) {
  var n = Math.round(Number(v) * 10) / 10;
  return isFinite(n) ? n : 0;
}

function newPlayer(name, avatar, id) {
  return {
    id: /^[a-z0-9]{4,32}$/i.test(String(id || '')) ? String(id) : crypto.randomBytes(8).toString('hex'),
    name: clean(name, 18) || 'Spieler',
    avatar: clean(avatar, 8) || '👤',
    balance: START_BALANCE,
    granted: 0,
    wagered: 0,
    returned: 0,
    plays: 0,
    wins: 0,
    losses: 0,
    biggestWin: 0,
    biggestWinGame: '',
    peak: START_BALANCE,
    luck: 50,
    xp: 0,
    claimedLevel: 1,
    pw: '',
    lastBonus: 0,
    lastBailout: 0,
    created: Date.now()
  };
}

/* Muss Zeichen fuer Zeichen zu js/core.js passen, sonst rechnen Client und
   Server unterschiedliche Level. Nach oben offen; die 999 ist nur eine
   Notbremse gegen endlose Schleifen bei absurden XP-Geschenken. */
var MAX_LEVEL = 999;
var FLAT_FROM = 30;
var FLAT_BASE = 280 * (FLAT_FROM - 1) + 60 * (FLAT_FROM - 1) * (FLAT_FROM - 2);
var FLAT_STEP = 280 + 120 * (FLAT_FROM - 1);

function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= FLAT_FROM) {
    var n = level - 1;
    return 280 * n + 60 * n * (n - 1);
  }
  // ab hier kostet jede Stufe gleich viel, sonst waeren hohe Level unerreichbar
  return FLAT_BASE + (level - FLAT_FROM) * FLAT_STEP;
}
function levelOf(xp) {
  var l = 1;
  while (l < MAX_LEVEL && (xp || 0) >= xpForLevel(l + 1)) l++;
  return l;
}
/** Aufstiege abrechnen: pro Level 100 x Level, ab Level 30 gedeckelt. */
function settleLevels(p) {
  var lvl = levelOf(p.xp || 0);
  var claimed = p.claimedLevel || 1;
  var reward = 0;
  while (claimed < lvl) { claimed++; reward += 100 * Math.min(claimed, FLAT_FROM); }
  if (reward > 0) {
    p.balance += reward;
    p.granted += reward;
    p.peak = Math.max(p.peak, p.balance);
  }
  p.claimedLevel = claimed;
  return reward;
}

/**
 * Eintrag in die Aktionsliste.
 *
 * party: die Nummer der Party, in der das passiert ist. Damit trennt der
 * Browser die beiden Welten — waehrend einer Party zeigt er nur, was in
 * genau dieser Party passiert, sonst alles mit einem "Party:" davor.
 */
function pushFeed(text, type, party) {
  var e = { t: Date.now(), text: clean(text, 160), type: clean(type, 12) };
  var pid = clean(party, 24);
  if (pid) e.party = pid;
  db.feed.unshift(e);
  if (db.feed.length > FEED_MAX) db.feed.length = FEED_MAX;
}

/** Was der Client zu sehen bekommt — PIN und Passwort-Hashes bleiben hier. */
function publicState() {
  var safe = {};
  Object.keys(db.players).forEach(function (k) {
    var p = db.players[k], c = {};
    Object.keys(p).forEach(function (f) { if (f !== 'pw') c[f] = p[f]; });
    safe[k] = c;
  });
  return {
    players: safe, feed: db.feed, startBalance: START_BALANCE,
    spielLuck: db.settings.spielLuck || {},
    spielRegel: db.settings.spielRegel || {},
    wipeAt: db.settings.wipeAt || 0,
    wipeXp: !!db.settings.wipeXp
  };
}

/**
 * Alle Spieler auf Anfang.
 *
 * mitXp sagt, ob auch Stufen und Erfahrung fallen. Ohne das bleibt der
 * Fortschritt stehen und nur die Chips gehen zurueck auf den Startwert —
 * das ist die uebliche Wahl fuer eine neue Runde unter Freunden.
 */
function alleZuruecksetzen(mitXp) {
  Object.keys(db.players).forEach(function (k) {
    var x = db.players[k];
    x.balance = START_BALANCE;
    x.granted = 0; x.wagered = 0; x.returned = 0;
    x.plays = 0; x.wins = 0; x.losses = 0;
    x.biggestWin = 0; x.biggestWinGame = ''; x.peak = START_BALANCE;
    x.lastBailout = 0;
    if (mitXp) { x.xp = 0; x.claimedLevel = 1; }
  });
}

/**
 * Geplanter Wipe.
 *
 * Der Zeitpunkt steht in den Einstellungen; jede Minute wird nachgesehen.
 * Faellt der Server aus und laeuft erst spaeter wieder an, holt er den
 * verpassten Wipe beim naechsten Blick nach — deshalb "<=" und nicht ein
 * genaues Zeitfenster.
 */
function wipeFaellig() {
  var w = db.settings.wipeAt || 0;
  if (!w || Date.now() < w) return;
  db.settings.wipeAt = 0;
  alleZuruecksetzen(!!db.settings.wipeXp);
  pushFeed('🧹 Grosser Wipe: alle zurueck auf ' + START_BALANCE + ' Chips' +
           (db.settings.wipeXp ? ' und Stufe 1' : ''), 'admin');
  saveDB();
  console.log('[gambaking] Geplanter Wipe ausgefuehrt.');
}
var wipeUhr = setInterval(wipeFaellig, 30000);
if (wipeUhr.unref) wipeUhr.unref();
wipeFaellig();

/* So lange und so viel wird aufgehoben. 30 Tage sind die längste Spanne,
   die das Panel anbietet; die Obergrenze schützt die Datei, wenn an einem
   Abend zehntausend Runden zusammenkommen. */
var STAT_TAGE = 31 * 86400000;
var STAT_MAX = 60000;

function statKuerzen(liste) {
  var grenze = Date.now() - STAT_TAGE;
  while (liste.length && liste[0].t < grenze) liste.shift();
  if (liste.length > STAT_MAX) liste.splice(0, liste.length - STAT_MAX);
}

/** Eine abgerechnete Runde ins Protokoll. */
function statRunde(spieler, spiel, einsatz, gewinn) {
  db.runden.push({ t: Date.now(), p: spieler, g: clean(spiel, 24), e: einsatz, w: gewinn });
  statKuerzen(db.runden);
}

/** Eine Anmeldung ins Protokoll — auch die frische Registrierung zählt. */
function statLogin(spieler) {
  db.logins.push({ t: Date.now(), p: spieler });
  statKuerzen(db.logins);
}

function nameTaken(name) {
  var n = String(name).trim().toLowerCase();
  return Object.keys(db.players).some(function (k) {
    return String(db.players[k].name).trim().toLowerCase() === n;
  });
}
function findByName(name) {
  var n = String(name).trim().toLowerCase();
  var k = Object.keys(db.players).filter(function (id) {
    return String(db.players[id].name).trim().toLowerCase() === n;
  })[0];
  return k ? db.players[k] : null;
}

/* ─────────────── Mehrspieler ───────────────
   Die Tische liegen nur im Speicher: ein Neustart raeumt sie ab. Die Chips
   sind trotzdem sicher — sie stehen erst wieder auf dem Konto, sobald jemand
   aufsteht, und beim Herunterfahren wird jeder Stapel zurueckgebucht. */
var mp = require('./mp.js')({
  players: function () { return db.players; },
  db: function () { return db; },
  save: saveDB,
  feed: pushFeed
});

/* Lag beim letzten Beenden noch etwas auf einem Tisch — etwa weil der Prozess
   hart abgebrochen wurde —, kommt es jetzt zurueck aufs Konto. */
(function () {
  var zurueck = mp.erholen();
  if (zurueck) console.log('[gambaking] ' + zurueck + ' Chips von offenen Tischen zurückgebucht.');
})();

/* ─────────────── Radio ───────────────
   Ein Sender laeuft hier, nicht im Browser.

   Vorher wuerfelte jeder Zuhoerer seine eigene Reihenfolge: zwei Leute im
   selben Raum hoerten zwei verschiedene Stuecke. Ein Radio ist aber genau
   das Gegenteil davon — es laeuft, ob jemand zuhoert oder nicht, und wer
   einschaltet, kommt mitten hinein.

   Deshalb steht hier die Uhr. Der Server merkt sich je Sender die
   Reihenfolge, das laufende Stueck und wann es angefangen hat; die
   Browser fragen nur, was gerade laeuft, und spulen an die passende
   Stelle. Weitergeschaltet wird nicht aktiv, sondern beim Nachsehen: wer
   fragt, bekommt den Stand, der sich aus der verstrichenen Zeit ergibt.
   Ohne Zuhoerer rechnet niemand — und trotzdem stimmt die Zeit, wenn
   wieder jemand einschaltet.

   Was hier laeuft, sind die Sender aus assets/sfx/sounds.json. Der
   eingebaute Mischsender bleibt im Browser: er spielt die live erzeugten
   Loops, und die entstehen in jedem Browser einzeln — die lassen sich
   nicht auf dieselbe Sekunde bringen, weil es keine Datei gibt, in die
   man springen koennte. */

var RADIO_DAUER = 210;            // Rueckfall, wenn ein Stueck keine Laenge nennt
var RADIO_MAX_SPRUNG = 12 * 3600e3;   // laenger her? Dann faengt der Sender neu an

var sfxPack = null;

function packLesen() {
  try {
    sfxPack = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'sfx', 'sounds.json'), 'utf8'));
  } catch (e) {
    sfxPack = null;
    console.warn('Sound-Pack nicht lesbar — Radio bleibt aus:', e.message);
  }
}
packLesen();

/** Alle Stuecke aus dem Pack, als Verzeichnis id -> Eintrag. */
function packStuecke() {
  var raus = {};
  var liste = sfxPack && Array.isArray(sfxPack.music) ? sfxPack.music : [];
  liste.forEach(function (t) { if (t && t.id && t.file) raus[t.id] = t; });
  return raus;
}

/** Ein Sender aus dem Pack. Ohne Eintrag: null — dann laeuft er lokal. */
function packSender(id) {
  var liste = sfxPack && Array.isArray(sfxPack.radio) ? sfxPack.radio : [];
  for (var i = 0; i < liste.length; i++) {
    if (liste[i] && liste[i].id === id) return liste[i];
  }
  return null;
}

/* Was gerade laeuft, je Sender. Bewusst nur im Speicher: ein Neustart
   faengt die Sendung von vorn an, und das ist genau richtig — eine
   Startzeit von gestern in der Datenbank waere nichts wert. */
var radios = {};

function stueckDauer(st, id) {
  var t = packStuecke()[id];
  var d = t && Number(t.dauer);
  if (d && d > 0) return Math.round(d);
  return Math.max(30, Math.round(Number(st.dauer) || RADIO_DAUER));
}

/** Die Stuecke eines Senders in Sendereihenfolge, gemischt falls gewuenscht. */
function radioReihe(st) {
  var da = packStuecke();
  var ids = Array.isArray(st.tracks) && st.tracks.length
    ? st.tracks.filter(function (id) { return !!da[id]; })
    : Object.keys(da);
  if (st.mischen !== false && ids.length > 2) {
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
  }
  return ids;
}

/**
 * Stand eines Senders — und dabei so weit vorspulen, wie Zeit vergangen ist.
 *
 * Am Ende der Reihe wird neu gemischt, sonst hoerte man ewig dieselbe
 * Abfolge. Die Schleife ist nach oben begrenzt: laeuft der Server lange
 * ohne Zuhoerer, faengt der Sender lieber neu an, als zehntausend
 * Titelwechsel nachzurechnen.
 */
function radioStand(id) {
  var st = packSender(id);
  if (!st) return null;
  var r = radios[id];
  var jetzt = Date.now();
  if (!r || !r.reihe.length) r = radios[id] = { reihe: radioReihe(st), pos: 0, start: jetzt };
  if (!r.reihe.length) return null;
  if (jetzt - r.start > RADIO_MAX_SPRUNG) { r.reihe = radioReihe(st); r.pos = 0; r.start = jetzt; }

  var wache = 0;
  while (jetzt - r.start >= stueckDauer(st, r.reihe[r.pos]) * 1000) {
    r.start += stueckDauer(st, r.reihe[r.pos]) * 1000;
    r.pos++;
    if (r.pos >= r.reihe.length) { r.reihe = radioReihe(st); r.pos = 0; }
    if (++wache > 4000) { r.start = jetzt; r.pos = 0; break; }
  }

  var dauer = stueckDauer(st, r.reihe[r.pos]);
  return {
    sender: id,
    name: st.name || id,
    track: r.reihe[r.pos],
    naechster: r.reihe[(r.pos + 1) % r.reihe.length],
    start: r.start,
    dauer: dauer,
    /* Die Serverzeit mitschicken: die Uhr im Browser geht fast nie
       genau, und ohne diesen Abgleich spulte jeder um seinen eigenen
       Fehler daneben. */
    jetzt: jetzt,
    laenge: r.reihe.length,
    pos: r.pos
  };
}

/** Weiterschalten — der Rest des laufenden Stuecks faellt weg. */
function radioWeiter(id) {
  var st = packSender(id);
  if (!st) return null;
  radioStand(id);                       // erst auf Stand bringen
  var r = radios[id];
  if (!r) return null;
  r.pos++;
  if (r.pos >= r.reihe.length) { r.reihe = radioReihe(st); r.pos = 0; }
  r.start = Date.now();
  return radioStand(id);
}

/** Ein bestimmtes Stueck auflegen. */
function radioWaehlen(id, trackId) {
  var st = packSender(id);
  if (!st) return null;
  radioStand(id);
  var r = radios[id];
  if (!r) return null;
  var wo = r.reihe.indexOf(trackId);
  if (wo < 0) {
    /* Nicht in der laufenden Reihe, aber im Sender? Dann direkt dahinter
       einsortieren, statt die Reihe wegzuwerfen. */
    if (!packStuecke()[trackId]) return { error: 'Unbekanntes Stück' };
    if (Array.isArray(st.tracks) && st.tracks.length && st.tracks.indexOf(trackId) < 0) {
      return { error: 'Gehört nicht zu diesem Sender' };
    }
    r.reihe.splice(r.pos + 1, 0, trackId);
    wo = r.pos + 1;
  }
  r.pos = wo;
  r.start = Date.now();
  return radioStand(id);
}

/* ─────────────── Operationen ─────────────── */

var ADMIN_OPS = { grant: 1, grantXp: 1, deletePlayer: 1, resetPlayer: 1, resetAll: 1, setPin: 1, luck: 1, gameLuck: 1, gameRule: 1, statReset: 1, setWipe: 1, wipe: 1, resetPassword: 1, radioSkip: 1, radioPick: 1 };
/* Diese Operationen darf nur der angemeldete Spieler selbst ausloesen. */
var SELF_OPS = { wager: 1, payout: 1, bailout: 1, bonus: 1, xp: 1 };

function applyOp(op) {
  var type = op && op.type;
  if (!type) return { error: 'Keine Operation angegeben' };

  var isAdmin = validToken(op.token);
  var me = sessionPlayer(op.session);

  if (ADMIN_OPS[type] && !isAdmin) {
    return { error: 'Nur der Admin darf das', code: 403 };
  }
  if (SELF_OPS[type]) {
    if (!me) return { error: 'Nicht angemeldet', code: 401 };
    if (op.id !== me) return { error: 'Fremdes Konto', code: 403 };
  }
  if (type === 'feed' && !me && !isAdmin) {
    return { error: 'Nicht angemeldet', code: 401 };
  }

  var p = op.id ? db.players[op.id] : null;
  var needsPlayer = { wager: 1, payout: 1, bailout: 1, bonus: 1, xp: 1, grant: 1, grantXp: 1, deletePlayer: 1, luck: 1, resetPassword: 1 };
  if (needsPlayer[type] && !p) return { error: 'Spieler nicht gefunden', code: 404 };

  switch (type) {

    case 'wager': {
      var amount = clamp(int(op.amount), 1, 1e9);
      if (amount > p.balance) return { error: 'Nicht genug Chips', code: 400 };
      p.balance -= amount;
      p.wagered += amount;
      p.plays++;
      break;
    }

    case 'payout': {
      var win = clamp(int(op.amount), 0, 1e9);
      var stake = clamp(int(op.stake), 0, 1e9);
      statRunde(p.id, op.game, stake, win);
      if (win > 0) {
        p.balance += win;
        p.returned += win;
        p.peak = Math.max(p.peak, p.balance);
        if (win - stake > p.biggestWin) {
          p.biggestWin = win - stake;
          p.biggestWinGame = clean(op.game, 24);
        }
        p.wins++;
      } else {
        p.losses++;
      }
      break;
    }

    case 'bailout': {
      if (p.balance >= 1) break;              // nur wer wirklich blank ist
      var DAY_B = 24 * 3600 * 1000;
      if (Date.now() - (p.lastBailout || 0) < DAY_B) {
        return { error: 'Mitleids-Chips heute schon abgeholt', code: 429 };
      }
      p.lastBailout = Date.now();
      p.balance = BAILOUT;
      p.granted += BAILOUT;
      break;
    }

    case 'bonus': {
      var DAY = 24 * 3600 * 1000;
      if (Date.now() - (p.lastBonus || 0) < DAY) {
        return { error: 'Tagesbonus schon abgeholt', code: 429 };
      }
      p.lastBonus = Date.now();
      p.balance += 250;
      p.granted += 250;
      p.peak = Math.max(p.peak, p.balance);
      break;
    }

    case 'xp': {
      p.xp = (p.xp || 0) + clamp(int(op.amount), 0, 500);
      settleLevels(p);
      break;
    }

    case 'feed': {
      pushFeed(op.text, op.kind, op.party);
      break;
    }

    /* ── ab hier nur mit Admin-Token ── */

    case 'grant': {
      var amt = clamp(int(op.amount), -1e9, 1e9);
      p.balance = Math.max(0, p.balance + amt);
      p.granted += amt;
      p.peak = Math.max(p.peak, p.balance);
      break;
    }

    case 'grantXp': {
      p.xp = Math.max(0, (p.xp || 0) + clamp(int(op.amount), -1e6, 1e6));
      if (levelOf(p.xp) < (p.claimedLevel || 1)) p.claimedLevel = levelOf(p.xp);
      settleLevels(p);
      break;
    }

    case 'luck': {
      p.luck = clamp(zehntel(op.luck), 0, 100);
      break;
    }

    case 'resetPassword': {
      var np2 = String(op.password || '');
      if (np2.length < 4) return { error: 'Passwort braucht mindestens 4 Zeichen', code: 400 };
      p.pw = hashPw(np2);
      dropSessionsOf(p.id);                   // laufende Sitzungen beenden
      break;
    }

    case 'deletePlayer': {
      dropSessionsOf(op.id);
      delete db.players[op.id];
      break;
    }

    /* Einzelnen Spieler zuruecksetzen. Konto, Name und Passwort bleiben — nur
       Chips, XP und Statistik gehen auf Anfang. Der Glueck-Regler bleibt
       ebenfalls stehen, den dreht der Admin bewusst. */
    case 'resetPlayer': {
      var rp = db.players[op.id];
      if (!rp) return { error: 'Spieler nicht gefunden', code: 404 };
      rp.balance = START_BALANCE;
      rp.granted = 0; rp.wagered = 0; rp.returned = 0;
      rp.plays = 0; rp.wins = 0; rp.losses = 0;
      rp.biggestWin = 0; rp.peak = START_BALANCE;
      rp.xp = 0; rp.claimedLevel = 1;
      rp.lastBailout = 0;
      break;
    }

    case 'resetAll': {
      alleZuruecksetzen(true);
      break;
    }

    /* Naechsten Wipe planen oder absagen. */
    case 'setWipe': {
      var wann = Number(op.at) || 0;
      db.settings.wipeAt = wann > Date.now() ? Math.floor(wann) : 0;
      db.settings.wipeXp = !!op.xp;
      break;
    }

    /* Quote eines einzelnen Spiels. Sie gilt fuer alle Spieler und kommt zum
       persoenlichen Glueck dazu — der Regler oben verschiebt einen Spieler,
       dieser hier ein Spiel. */
    case 'gameLuck': {
      db.settings.spielLuck = db.settings.spielLuck || {};
      if (op.alle) {
        db.settings.spielLuck = {};
        break;
      }
      var spiel = clean(op.game, 24).trim();
      if (!spiel) return { error: 'Kein Spiel angegeben', code: 400 };
      var wert = clamp(zehntel(op.luck), 0, 100);
      /* Neutral wird geloescht statt gespeichert: so bleibt die Datei
         uebersichtlich und ein spaeter umbenanntes Spiel zieht keinen
         toten Eintrag mit. */
      if (wert === 50) delete db.settings.spielLuck[spiel];
      else db.settings.spielLuck[spiel] = wert;
      break;
    }

    /* Statistik zuruecksetzen.
       Was genau, sagt der Aufruf: Runden und Anmeldungen sind die Grundlage
       der Kurven, das Party-Protokoll haengt nicht daran und wird nur auf
       ausdrueckliche Ansage mit geleert. Die Konten bleiben unberuehrt —
       dafuer gibt es den Wipe. */
    case 'statReset': {
      var wasWeg = [];
      if (op.runden !== false) { db.runden = []; wasWeg.push('Runden'); }
      if (op.logins !== false) { db.logins = []; wasWeg.push('Logins'); }
      if (op.party) { db.partyLog = []; wasWeg.push('Party-Protokoll'); }
      pushFeed('Statistik zurückgesetzt (' + (wasWeg.join(', ') || 'nichts') + ')', 'admin');
      break;
    }

    /* Regeln eines Spiels: ob es ueberhaupt in der Halle steht und in
       welchem Rahmen gesetzt werden darf. Gilt fuer alle Spieler. */
    case 'gameRule': {
      db.settings.spielRegel = db.settings.spielRegel || {};
      if (op.alle) {
        db.settings.spielRegel = {};
        break;
      }
      var gspiel = clean(op.game, 24).trim();
      if (!gspiel) return { error: 'Kein Spiel angegeben', code: 400 };
      var regel = db.settings.spielRegel[gspiel] || {};
      if (op.aus !== undefined) regel.aus = !!op.aus;
      if (op.min !== undefined) regel.min = clamp(Math.floor(Number(op.min) || 0), 0, 1000000);
      if (op.max !== undefined) regel.max = clamp(Math.floor(Number(op.max) || 0), 0, 100000000);
      /* Eine Obergrenze unter der Untergrenze waere eine Sackgasse. */
      if (regel.min && regel.max && regel.max < regel.min) regel.max = regel.min;
      /* Nichts Besonderes eingestellt? Dann auch keinen Eintrag behalten. */
      if (!regel.aus && !regel.min && !regel.max) delete db.settings.spielRegel[gspiel];
      else db.settings.spielRegel[gspiel] = regel;
      break;
    }

    case 'setPin': {
      var pin = clean(op.pin, 12).trim();
      if (!pin) return { error: 'PIN darf nicht leer sein', code: 400 };
      db.settings.adminPin = pin;
      break;
    }

    /* Radio: der Admin darf umschalten. Beides aendert nichts an der
       Datenbank — der Sender laeuft im Speicher —, deshalb geht die
       Antwort hier direkt raus und nicht durch saveDB(). */
    case 'radioSkip': {
      var rs = radioWeiter(clean(op.sender, 40));
      if (!rs) return { error: 'Sender nicht gefunden', code: 404 };
      pushFeed('Radio weitergeschaltet', 'admin');
      return { radio: rs, state: publicState() };
    }

    case 'radioPick': {
      var rp = radioWaehlen(clean(op.sender, 40), clean(op.track, 40));
      if (!rp) return { error: 'Sender nicht gefunden', code: 404 };
      if (rp.error) return { error: rp.error, code: 400 };
      pushFeed('Radio: Stück gewählt', 'admin');
      return { radio: rp, state: publicState() };
    }

    case 'wipe': {
      var keepPin = db.settings.adminPin;     // PIN überlebt das Löschen
      db = emptyDB();
      db.settings.adminPin = keepPin;
      sessions.clear();
      break;
    }

    default:
      return { error: 'Unbekannte Operation: ' + type, code: 400 };
  }

  saveDB();
  return { state: publicState() };
}

/* ─────────────── HTTP ─────────────── */

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  /* Ohne diesen Eintrag gingen alle Karten und Symbole als
     application/octet-stream raus. Chrome errät den Typ und zeigt sie
     trotzdem, Safari ist da deutlich strenger. */
  '.webp': 'image/webp',
  /* Eigene Klänge aus assets/sfx — siehe assets/sfx/README.md */
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJSON(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [], size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > 64 * 1024) { reject(new Error('Body zu groß')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('Ungültiges JSON')); }
    });
    req.on('error', reject);
  });
}

/* Nur diese Ordner gehen nach draussen. Alles andere im Projektordner —
   server.js, Dockerfile, .env, data/ — bleibt privat, auch wenn jemand den
   Pfad errät. */
var PUBLIC_DIRS = { css: 1, js: 1, assets: 1 };
var PUBLIC_FILES = { 'index.html': 1, 'favicon.ico': 1, 'robots.txt': 1 };

function serveStatic(req, res, urlPath) {
  var rel;
  try { rel = decodeURIComponent(urlPath.split('?')[0]); }
  catch (e) { res.writeHead(400); res.end('Ungültiger Pfad'); return; }
  if (rel === '/' || rel === '') rel = '/index.html';

  var parts = path.normalize(rel).split('/').filter(Boolean);
  var ok = parts.length > 1
    ? (PUBLIC_DIRS[parts[0]] === 1)
    : (parts.length === 1 && PUBLIC_FILES[parts[0]] === 1);
  if (!ok || parts.indexOf('..') >= 0) {
    res.writeHead(404); res.end('Nicht gefunden');
    return;
  }

  var file = path.join(ROOT, parts.join('/'));
  if (file.indexOf(ROOT + path.sep) !== 0) {          // kein Ausbruch
    res.writeHead(403); res.end('Verboten');
    return;
  }
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Nicht gefunden'); return; }
    var typ = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

    /* Teilstuecke ausliefern.

       Fuer ein Bild von zwoelf Kilobyte spielt das keine Rolle, fuer ein
       Musikstueck von zwoelf Megabyte schon: der Browser fordert Musik
       stueckweise an und bricht die Verbindung ab, sobald er genug im Puffer
       hat. Ohne Range-Antwort schickt der Server jedes Mal die ganze Datei,
       der Browser wirft den Rest weg — und Vorspulen geht gar nicht, weil er
       nicht mitten in die Datei springen kann. */
    var bereich = null;
    var rq = req.headers.range;
    if (rq) {
      var m = /^bytes=(\d*)-(\d*)$/.exec(String(rq).trim());
      if (m && (m[1] || m[2])) {
        var von, bis;
        if (m[1]) {                       // "bytes=500-"  oder  "bytes=500-999"
          von = parseInt(m[1], 10);
          bis = m[2] ? parseInt(m[2], 10) : st.size - 1;
        } else {                          // "bytes=-500" — die letzten 500
          von = st.size - parseInt(m[2], 10);
          bis = st.size - 1;
        }
        if (von < 0) von = 0;
        if (bis >= st.size) bis = st.size - 1;
        if (von > bis || von >= st.size) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + st.size });
          res.end();
          return;
        }
        bereich = { von: von, bis: bis };
      }
    }

    if (bereich) {
      res.writeHead(206, {
        'Content-Type': typ,
        'Content-Length': bereich.bis - bereich.von + 1,
        'Content-Range': 'bytes ' + bereich.von + '-' + bereich.bis + '/' + st.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, { start: bereich.von, end: bereich.bis }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': typ,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

function handleRequest(req, res) {
  var url = req.url || '/';

  /* Liegt die Seite in einem Unterpfad, kommt der auch in der URL an —
     ausser der Proxy hat ihn schon abgeschnitten. Beides ist erlaubt. */
  if (BASE_PATH) {
    if (url === BASE_PATH || url.indexOf(BASE_PATH + '?') === 0) {
      // Ohne Schrägstrich am Ende würde der Browser "css/style.css" auf der
      // Domain-Wurzel suchen statt im Unterpfad.
      res.writeHead(301, { Location: BASE_PATH + '/' + url.slice(BASE_PATH.length) });
      return res.end();
    }
    if (url.indexOf(BASE_PATH + '/') === 0) url = url.slice(BASE_PATH.length);
  }

  /* Für Healthcheck und Monitoring — verrät nichts über die Spieler. */
  if (url === '/api/health') {
    return sendJSON(res, 200, {
      ok: true,
      players: Object.keys(db.players).length,
      uptime: Math.round(process.uptime())
    });
  }

  if (url === '/api/state' && req.method === 'GET') {
    return sendJSON(res, 200, publicState());
  }

  /* ── Konto anlegen ── */
  if (url === '/api/auth/register' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      var name = clean(body.name, 18).trim();
      var pw = String(body.password || '');
      if (name.length < 2) return sendJSON(res, 400, { error: 'Name braucht mindestens 2 Zeichen' });
      if (pw.length < 4) return sendJSON(res, 400, { error: 'Passwort braucht mindestens 4 Zeichen' });
      if (nameTaken(name)) return sendJSON(res, 409, { error: 'Diesen Namen gibt es schon — melde dich an' });

      var np = newPlayer(name, body.avatar);
      np.pw = hashPw(pw);
      db.players[np.id] = np;
      statLogin(np.id);
      pushFeed(np.name + ' betritt das Casino mit ' + START_BALANCE + ' Chips', 'admin');
      saveDB();
      sendJSON(res, 200, { session: newSession(np.id), playerId: np.id, state: publicState() });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Anmelden ── */
  if (url === '/api/auth/login' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      var name = clean(body.name, 18).trim();
      var key = loginKey(req, name);
      var wait = loginBlocked(key);
      if (wait) {
        return sendJSON(res, 429, { error: 'Zu viele Fehlversuche — in ' + wait + ' Min. nochmal probieren' });
      }
      var p = findByName(name);
      // bewusst dieselbe Meldung fuer beide Faelle
      if (!p || !checkPw(String(body.password || ''), p.pw)) {
        loginFailed(key);
        return sendJSON(res, 401, { error: 'Name oder Passwort stimmt nicht' });
      }
      loginOk(key);
      statLogin(p.id);
      saveDB();
      sendJSON(res, 200, { session: newSession(p.id), playerId: p.id, state: publicState() });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Statistik ausfuehren ──
     Die Rohdaten, aus denen die Kurven entstehen: jede Runde, jede
     Anmeldung, dazu das Party-Protokoll und eine Namensliste, damit aus den
     Kennungen wieder Namen werden. Der Browser baut daraus die Datei. */
  if (url === '/api/statexport' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      if (!validToken(body.token)) return sendJSON(res, 403, { error: 'Nur der Admin darf das' });
      var namen = {};
      Object.keys(db.players).forEach(function (k) { namen[k] = db.players[k].name; });
      sendJSON(res, 200, {
        stand: Date.now(),
        namen: namen,
        runden: db.runden,
        logins: db.logins,
        partyLog: db.partyLog || []
      });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Was laeuft gerade im Radio? ──
     Offen fuer jeden: es steht ohnehin gleich im Musikfenster. Ohne
     Sender in der Adresse kommt die Liste der Sender, die hier laufen —
     daran erkennt der Browser, welcher Sender synchron geht und welcher
     bei ihm allein spielt. */
  if (url.indexOf('/api/radio') === 0 && req.method === 'GET') {
    var rFrage = (url.split('?')[1] || '');
    var rId = '';
    rFrage.split('&').forEach(function (teil) {
      var st = teil.split('=');
      if (st[0] === 'sender') { try { rId = decodeURIComponent(st[1] || ''); } catch (e) { rId = ''; } }
    });
    if (!rId) {
      var alle = (sfxPack && Array.isArray(sfxPack.radio) ? sfxPack.radio : [])
        .filter(function (s) { return s && s.id; })
        .map(function (s) { return s.id; });
      return sendJSON(res, 200, { sender: alle, jetzt: Date.now() });
    }
    var stand = radioStand(rId);
    if (!stand) return sendJSON(res, 404, { error: 'Sender läuft nicht auf dem Server' });
    return sendJSON(res, 200, stand);
  }

  /* ── Protokoll der Partys ──
     Die Liste kommt schlank: Name, Zeitraum, Art und Teilnehmerzahl. Erst
     wenn eine Sitzung ausgewaehlt wird, geht der ganze Datensatz raus. */
  if (url === '/api/partys' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      if (!validToken(body.token)) return sendJSON(res, 403, { error: 'Nur der Admin darf das' });
      var log = Array.isArray(db.partyLog) ? db.partyLog : [];
      var id = clean(body.id, 40).trim();
      if (id) {
        var eine = log.filter(function (x) { return x.id === id; })[0];
        if (!eine) return sendJSON(res, 404, { error: 'Diese Party steht nicht im Protokoll' });
        return sendJSON(res, 200, { party: eine });
      }
      sendJSON(res, 200, {
        liste: log.map(function (x) {
          return {
            id: x.id, name: x.name, von: x.von, bis: x.bis,
            eigeneChips: !!x.eigeneChips, startChips: x.startChips,
            leute: (x.spieler || []).length,
            sieger: (x.spieler || [])[0] ? x.spieler[0].name : ''
          };
        })
      });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Statistik fuer das Admin-Panel ──
     Ausgewertet wird auf dem Server: der Browser bekaeme sonst bis zu
     60.000 Einzelrunden geschickt, nur um daraus vierzig Punkte zu malen. */
  if (url === '/api/stats' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      if (!validToken(body.token)) return sendJSON(res, 403, { error: 'Nur der Admin darf das' });

      var jetzt = Date.now();
      var spanne = Math.max(0, int(body.spanne));          // 0 = alles
      var nurSpieler = clean(body.spieler, 40);
      var nurSpiel = clean(body.spiel, 24);
      var EIMER = 40;

      /* ── Zeitraster ──
         Wichtig: die Eimergrenzen haengen *nicht* an der aktuellen Uhrzeit.
         Frueher war der Anfang „jetzt minus Spanne" und die Breite daraus
         gerechnet — damit verschob sich bei jedem Aktualisieren das ganze
         Raster um die verstrichenen Sekunden, dieselben Runden fielen in
         andere Eimer, und die Balken sprangen, obwohl sich an den Daten
         nichts geaendert hatte. Jetzt liegt das Raster fest: die Breite
         folgt allein der gewaehlten Spanne, und das Ende wird auf die
         naechste Rasterkante aufgerundet. Zwischen zwei Abrufen aendert
         sich damit hoechstens der letzte, noch laufende Eimer. */
      var breite, ende, anfang;
      if (spanne) {
        breite = Math.max(60000, Math.ceil(spanne / EIMER));
      } else {
        /* Ohne Spanne: vom ersten Ereignis bis jetzt. Die Breite wird auf
           volle Minuten gerundet, sonst wanderte sie mit jeder Sekunde. */
        var frueh = jetzt - 3600000;
        if (db.runden.length) frueh = Math.min(frueh, db.runden[0].t);
        if (db.logins.length) frueh = Math.min(frueh, db.logins[0].t);
        breite = Math.max(60000, Math.ceil((jetzt - frueh) / EIMER / 60000) * 60000);
      }
      ende = Math.ceil(jetzt / breite) * breite;
      anfang = ende - EIMER * breite;

      /* Gezaehlt wird genau das Fenster, das auch gezeichnet wird — sonst
         passten Kopfzeile und Kurve nicht zueinander. */
      var runden = db.runden.filter(function (r) {
        if (r.t < anfang) return false;
        if (nurSpieler && r.p !== nurSpieler) return false;
        if (nurSpiel && r.g !== nurSpiel) return false;
        return true;
      });
      var logins = db.logins.filter(function (l) {
        return l.t >= anfang && (!nurSpieler || l.p === nurSpieler);
      });

      var punkte = [];
      for (var i = 0; i < EIMER; i++) {
        punkte.push({ t: anfang + i * breite, einsatz: 0, gewinn: 0, runden: 0, logins: 0 });
      }
      function eimer(t) {
        var i = Math.floor((t - anfang) / breite);
        return punkte[i < 0 ? 0 : (i >= EIMER ? EIMER - 1 : i)];
      }

      var proSpiel = {}, proSpieler = {};
      var einsatzGes = 0, gewinnGes = 0;
      runden.forEach(function (r) {
        var b = eimer(r.t);
        b.einsatz += r.e; b.gewinn += r.w; b.runden++;
        einsatzGes += r.e; gewinnGes += r.w;

        var g = proSpiel[r.g] || (proSpiel[r.g] = { id: r.g, einsatz: 0, gewinn: 0, runden: 0 });
        g.einsatz += r.e; g.gewinn += r.w; g.runden++;

        var sp = proSpieler[r.p] || (proSpieler[r.p] = { id: r.p, einsatz: 0, gewinn: 0, runden: 0 });
        sp.einsatz += r.e; sp.gewinn += r.w; sp.runden++;
      });
      logins.forEach(function (l) { eimer(l.t).logins++; });

      function liste(obj, mitName) {
        return Object.keys(obj).map(function (k) {
          var x = obj[k];
          x.netto = x.gewinn - x.einsatz;                     // aus Sicht der Spieler
          x.quote = x.einsatz ? x.gewinn / x.einsatz : 0;
          if (mitName) x.name = db.players[k] ? db.players[k].name : '—';
          return x;
        }).sort(function (a, b) { return b.einsatz - a.einsatz; });
      }

      var wach = {};
      runden.forEach(function (r) { wach[r.p] = 1; });

      sendJSON(res, 200, {
        von: anfang, bis: ende, breite: breite,
        punkte: punkte,
        spiele: liste(proSpiel, false),
        spieler: liste(proSpieler, true),
        gesamt: {
          runden: runden.length,
          einsatz: einsatzGes,
          gewinn: gewinnGes,
          netto: gewinnGes - einsatzGes,
          quote: einsatzGes ? gewinnGes / einsatzGes : 0,
          logins: logins.length,
          aktive: Object.keys(wach).length,
          spieler: Object.keys(db.players).length
        }
      });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Laeuft die Sitzung noch? ── */
  if (url === '/api/auth/me' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      var id = sessionPlayer(body.session);
      if (!id) return sendJSON(res, 401, { error: 'Sitzung abgelaufen' });
      sendJSON(res, 200, { playerId: id, state: publicState() });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Abmelden ── */
  if (url === '/api/auth/logout' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      if (body.session) sessions.delete(body.session);
      sendJSON(res, 200, { ok: true });
    }, function () { sendJSON(res, 200, { ok: true }); });
  }

  /* ── Eigenes Passwort aendern ── */
  if (url === '/api/auth/password' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      var id = sessionPlayer(body.session);
      if (!id) return sendJSON(res, 401, { error: 'Nicht angemeldet' });
      var p = db.players[id];
      if (!checkPw(String(body.oldPassword || ''), p.pw)) {
        return sendJSON(res, 401, { error: 'Altes Passwort stimmt nicht' });
      }
      var np = String(body.newPassword || '');
      if (np.length < 4) return sendJSON(res, 400, { error: 'Passwort braucht mindestens 4 Zeichen' });
      p.pw = hashPw(np);
      saveDB();
      sendJSON(res, 200, { ok: true });
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  if (url === '/api/admin/login' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      if (clean(body.pin, 12) === db.settings.adminPin) {
        sendJSON(res, 200, { token: issueToken() });
      } else {
        sendJSON(res, 401, { error: 'Falsche PIN' });
      }
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  if (url === '/api/op' && req.method === 'POST') {
    return readBody(req).then(function (body) {
      var out = applyOp(body);
      if (out.error) sendJSON(res, out.code || 400, { error: out.error, state: publicState() });
      else sendJSON(res, 200, out);
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  /* ── Mehrspieler ──
     Alles laeuft ueber die Sitzung: ohne Anmeldung sitzt niemand am Tisch.
     Der Zustand kommt aus mp.js, hier steht nur die Zustellung. */
  if (url.indexOf('/api/mp/') === 0 && req.method === 'POST') {
    return readBody(req).then(function (body) {
      var me = sessionPlayer(body.session);
      if (!me) return sendJSON(res, 401, { error: 'Nicht angemeldet' });
      mp.touch(me);

      var teil = url.slice('/api/mp/'.length);

      /* Der Kontostand gehoert in jede Antwort, auch in die Langabfrage.
         Das Konto aendert sich naemlich auch ohne Zutun des Spielers: wer zu
         lange weg ist, wird vom Tisch geholt und bekommt seinen Stapel
         zurueck. Ohne diese Zeile stuende in der Kopfleiste weiter die alte
         Zahl — es sah aus, als wuerde beim Mehrspieler gar nichts abgebucht
         und nichts gutgeschrieben. Den ganzen Spielerstand mitzuschicken
         waere zu teuer: die Langabfrage kommt bei einem laufenden Tisch
         mehrmals je Sekunde zurueck. */
      function guthaben() {
        return db.players[me] ? db.players[me].balance : null;
      }

      if (teil === 'lobby') {
        var seit = Number(body.since) || 0;
        return mp.wait(seit, function () {
          sendJSON(res, 200, {
            lobby: mp.lobby(me),
            tisch: body.table ? mp.view(body.table, me) : null,
            guthaben: guthaben()
          });
        });
      }

      if (teil === 'table') {
        var seit2 = Number(body.since) || 0;
        return mp.wait(seit2, function () {
          var t = mp.view(body.table, me);
          if (!t) {
            return sendJSON(res, 404, {
              error: 'Diesen Tisch gibt es nicht mehr', guthaben: guthaben()
            });
          }
          sendJSON(res, 200, { tisch: t, v: mp.seq(), guthaben: guthaben() });
        });
      }

      /* Aufloesen ist die einzige Sache hier, die nicht der eigenen Sitzung
         gehoert — deshalb haengt sie am Admin-Token und nicht am Spieler. */
      if (teil === 'aufloesen') {
        if (!validToken(body.token)) {
          return sendJSON(res, 403, { error: 'Nur der Admin darf das' });
        }
        var weg = mp.aufloesen(body.table, 'Vom Admin aufgelöst');
        if (weg.error) return sendJSON(res, weg.code || 400, { error: weg.error });
        pushFeed('👑 ADMIN: ' + (weg.art === 'party' ? 'Party' : 'Tisch') + ' "' +
                 weg.name + '" aufgelöst', 'admin');
        return sendJSON(res, 200, Object.assign({ state: publicState() }, weg));
      }

      var out;
      if (teil === 'create') out = mp.create(me, body);
      else if (teil === 'join') out = mp.join(me, body);
      else if (teil === 'leave') out = mp.leave(me);
      else if (teil === 'action') out = mp.action(me, body);
      else return sendJSON(res, 404, { error: 'Unbekannter Endpunkt' });

      if (out.error) return sendJSON(res, out.code || 400, { error: out.error, state: publicState() });
      sendJSON(res, 200, Object.assign({ state: publicState() }, out));
    }, function (e) { sendJSON(res, 400, { error: e.message }); });
  }

  if (url.indexOf('/api/') === 0) return sendJSON(res, 404, { error: 'Unbekannter Endpunkt' });

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  serveStatic(req, res, url);
}

/* ─────────────── Serverstart ─────────────── */

var tls = readTLS();
var server;

if (tls) {
  server = https.createServer(tls, handleRequest);

  /* Let's Encrypt erneuert alle 60 Tage. Ohne Nachladen wuerde der Server
     mit dem alten Zertifikat weiterlaufen, bis jemand neu startet. */
  var reloadTimer = null;
  function scheduleReload() {
    clearTimeout(reloadTimer);          // certbot schreibt beide Dateien kurz nacheinander
    reloadTimer = setTimeout(function () {
      var fresh = readTLS();
      if (!fresh) return;
      try {
        server.setSecureContext(fresh);
        console.log('[gambaking] Zertifikat neu geladen (' + new Date().toLocaleString('de-DE') + ')');
      } catch (e) {
        console.error('[gambaking] Zertifikat konnte nicht uebernommen werden:', e.message);
      }
    }, 2000);
  }
  [SSL_CERT, SSL_KEY].forEach(function (file) {
    try {
      fs.watch(file, scheduleReload);
    } catch (e) {
      console.warn('[gambaking] ' + file + ' wird nicht ueberwacht (' + e.code + ') — ' +
                   'nach der Erneuerung den Server neu starten.');
    }
  });

  /* Optional: Port 80 leitet auf https um */
  if (REDIRECT_PORT) {
    http.createServer(function (req, res) {
      var host = String(req.headers.host || '').replace(/:\d+$/, '');
      var suffix = (PORT === 443 ? '' : ':' + PORT);
      res.writeHead(301, { Location: 'https://' + host + suffix + (req.url || '/') });
      res.end();
    }).listen(REDIRECT_PORT, HOST, function () {
      console.log('   Weiterleitung: http://…:' + REDIRECT_PORT + ' → https');
    }).on('error', function (e) {
      console.error('[gambaking] Weiterleitung auf Port ' + REDIRECT_PORT +
                    ' nicht moeglich (' + e.code + ').');
    });
  }
} else {
  server = http.createServer(handleRequest);
}

server.listen(PORT, HOST, function () {
  var scheme = tls ? 'https' : 'http';
  console.log('👑 GambaKing läuft auf ' + scheme + '://localhost:' + PORT);
  if (tls) {
    console.log('   TLS aktiv: ' + SSL_CERT);
  } else {
    console.log('   Ohne TLS — für HTTPS: SSL_DOMAIN=deine.domain node server.js');
  }
  if (BASE_PATH) console.log('   Unterpfad: ' + BASE_PATH + '/ (hinter Reverse-Proxy)');
  if (TRUST_PROXY) console.log('   X-Forwarded-For wird ausgewertet');
  console.log('   Daten: ' + DATA_FILE);
  console.log('   Admin-PIN: ' + db.settings.adminPin + '  (überschreibbar mit GAMBAKING_PIN=…)');
});

/* Docker schickt beim Stoppen SIGTERM — vorher noch schnell speichern. */
['SIGTERM', 'SIGINT'].forEach(function (sig) {
  process.on(sig, function () {
    console.log('[gambaking] ' + sig + ' — Daten sichern und beenden.');
    /* Chips, die gerade als Stapel auf einem Tisch liegen, gehoeren dem
       Spieler. Die Tische leben nur im Speicher — ohne Rueckbuchung waeren
       sie nach dem Neustart weg. */
    var zurueck = mp.shutdown();
    if (zurueck) console.log('[gambaking] ' + zurueck + ' Chips von Tischen zurückgebucht.');
    flushDB();
    server.close(function () { process.exit(0); });
    setTimeout(function () { process.exit(0); }, 3000).unref();
  });
});

server.on('error', function (e) {
  if (e.code === 'EACCES') {
    console.error('[gambaking] Port ' + PORT + ' braucht Rechte. Entweder als root starten, ' +
                  'oder besser: einen hohen Port nehmen und davor einen Reverse-Proxy setzen.');
  } else if (e.code === 'EADDRINUSE') {
    console.error('[gambaking] Port ' + PORT + ' ist schon belegt.');
  } else {
    console.error('[gambaking] Server-Fehler:', e.message);
  }
  process.exit(1);
});
