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
    lastBonus: 0,
    created: Date.now()
  };
}

var MAX_LEVEL = 30;

function xpForLevel(level) {
  if (level <= 1) return 0;
  var n = level - 1;
  return 100 * n + 25 * n * (n - 1);
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

/** Was der Client zu sehen bekommt — die PIN bleibt hier. */
function publicState() {
  return { players: db.players, feed: db.feed, startBalance: START_BALANCE };
}

/* ─────────────── Operationen ─────────────── */

var ADMIN_OPS = { grant: 1, grantXp: 1, deletePlayer: 1, resetAll: 1, setPin: 1, luck: 1, wipe: 1 };

function applyOp(op) {
  var type = op && op.type;
  if (!type) return { error: 'Keine Operation angegeben' };

  if (ADMIN_OPS[type] && !validToken(op.token)) {
    return { error: 'Nur der Admin darf das', code: 403 };
  }

  var p = op.id ? db.players[op.id] : null;
  var needsPlayer = { wager: 1, payout: 1, bailout: 1, bonus: 1, xp: 1, grant: 1, grantXp: 1, deletePlayer: 1, luck: 1 };
  if (needsPlayer[type] && !p) return { error: 'Spieler nicht gefunden', code: 404 };

  switch (type) {

    case 'create': {
      if (op.id && db.players[op.id]) break;          // schon angelegt
      var np = newPlayer(op.name, op.avatar, op.id);
      db.players[np.id] = np;
      break;
    }

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

    case 'deletePlayer': {
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
