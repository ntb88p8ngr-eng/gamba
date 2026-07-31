#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Server
   Hält Spieler, Chips und Feed zentral, damit das Leaderboard
   für alle gleich ist. Ohne Abhängigkeiten: nur Node.
       node server.js        →  http://localhost:3000
   ═══════════════════════════════════════════════════════════ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var PORT = Number(process.env.PORT) || 3000;
var HOST = process.env.HOST || '0.0.0.0';
var ROOT = __dirname;
var DATA_DIR = path.join(ROOT, 'data');
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
    settings: { adminPin: process.env.GAMBAKING_PIN || '1337' }
  };
}

function loadDB() {
  try {
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    var db = JSON.parse(raw);
    db.players = db.players || {};
    db.feed = db.feed || [];
    db.settings = Object.assign(emptyDB().settings, db.settings || {});
    return db;
  } catch (e) {
    return emptyDB();
  }
}

var db = loadDB();
var saveTimer = null;

function saveDB() {
  if (saveTimer) return;                      // gebündelt schreiben
  saveTimer = setTimeout(function () {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      var tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DATA_FILE);          // atomar ersetzen
    } catch (e) {
      console.error('[gambaking] Speichern fehlgeschlagen:', e.message);
    }
  }, 120);
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

var MAX_LEVEL = 30;

function xpForLevel(level) {
  if (level <= 1) return 0;
  var n = level - 1;
  return 280 * n + 60 * n * (n - 1);
}
function levelOf(xp) {
  var l = 1;
  while (l < MAX_LEVEL && (xp || 0) >= xpForLevel(l + 1)) l++;
  return l;
}
/** Aufstiege abrechnen: pro Level 100 x Level an Chips. */
function settleLevels(p) {
  var lvl = levelOf(p.xp || 0);
  var claimed = p.claimedLevel || 1;
  var reward = 0;
  while (claimed < lvl) { claimed++; reward += 100 * claimed; }
  if (reward > 0) {
    p.balance += reward;
    p.granted += reward;
    p.peak = Math.max(p.peak, p.balance);
  }
  p.claimedLevel = claimed;
  return reward;
}

function pushFeed(text, type) {
  db.feed.unshift({ t: Date.now(), text: clean(text, 160), type: clean(type, 12) });
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
  return { players: safe, feed: db.feed, startBalance: START_BALANCE };
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

/* ─────────────── Operationen ─────────────── */

var ADMIN_OPS = { grant: 1, grantXp: 1, deletePlayer: 1, resetAll: 1, setPin: 1, luck: 1, wipe: 1, resetPassword: 1 };
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
        p.biggestWin = Math.max(p.biggestWin, win - stake);
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
      pushFeed(op.text, op.kind);
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
      p.luck = clamp(int(op.luck), 0, 100);
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

function serveStatic(req, res, urlPath) {
  var rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  var file = path.join(ROOT, path.normalize(rel));
  if (file.indexOf(ROOT) !== 0 || file.indexOf(DATA_DIR) === 0) {   // kein Ausbruch, keine DB
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

var server = http.createServer(function (req, res) {
  var url = req.url || '/';

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
      var p = findByName(clean(body.name, 18).trim());
      // bewusst dieselbe Meldung fuer beide Faelle
      if (!p || !checkPw(String(body.password || ''), p.pw)) {
        return sendJSON(res, 401, { error: 'Name oder Passwort stimmt nicht' });
      }
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

  if (url.indexOf('/api/') === 0) return sendJSON(res, 404, { error: 'Unbekannter Endpunkt' });

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, function () {
  console.log('👑 GambaKing läuft auf http://localhost:' + PORT);
  console.log('   Daten: ' + DATA_FILE);
  console.log('   Admin-PIN: ' + db.settings.adminPin + '  (überschreibbar mit GAMBAKING_PIN=…)');
});
