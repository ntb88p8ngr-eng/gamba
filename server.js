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
    /* spielLuck: Feinjustierung je Spiel, 0..100 mit 50 als neutral. Was
       nicht drinsteht, laeuft neutral — deshalb ein leeres Objekt und keine
       Liste aller Spiele: welche es gibt, weiss der Browser. */
    settings: { adminPin: process.env.GAMBAKING_PIN || '1337', spielLuck: {} }
  };
}

function loadDB() {
  try {
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    var db = JSON.parse(raw);
    db.players = db.players || {};
    db.feed = db.feed || [];
    db.settings = Object.assign(emptyDB().settings, db.settings || {});
    if (!db.settings.spielLuck || typeof db.settings.spielLuck !== 'object') db.settings.spielLuck = {};
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
    spielLuck: db.settings.spielLuck || {}
  };
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

/* ─────────────── Operationen ─────────────── */

var ADMIN_OPS = { grant: 1, grantXp: 1, deletePlayer: 1, resetPlayer: 1, resetAll: 1, setPin: 1, luck: 1, gameLuck: 1, wipe: 1, resetPassword: 1 };
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
      Object.keys(db.players).forEach(function (k) {
        var x = db.players[k];
        x.balance = START_BALANCE;
        x.granted = 0; x.wagered = 0; x.returned = 0;
        x.plays = 0; x.wins = 0; x.losses = 0;
        x.biggestWin = 0; x.peak = START_BALANCE;
        x.xp = 0; x.claimedLevel = 1;
        x.lastBailout = 0;
      });
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

    case 'setPin': {
      var pin = clean(op.pin, 12).trim();
      if (!pin) return { error: 'PIN darf nicht leer sein', code: 400 };
      db.settings.adminPin = pin;
      break;
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
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache'
    });
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
      sendJSON(res, 200, { session: newSession(p.id), playerId: p.id, state: publicState() });
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
