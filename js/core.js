/* ═══════════════════════════════════════════════════════════
   GAMBAKING — core engine
   State, storage, audio, effects, bet controls, game registry.
   Kein Echtgeld. Alles lokal. Alles Fantasy.
   ═══════════════════════════════════════════════════════════ */
(function (window) {
  'use strict';

  var GK = window.GK = {};
  var KEY = 'gambaking:v1';
  var START_BALANCE = 500;
  var BAILOUT = 50; // Mitleids-Chips wenn komplett pleite (einmal pro Tag)
  var DAY = 24 * 3600 * 1000;

  GK.START_BALANCE = START_BALANCE;

  /* ─────────────────────────── HELPERS ─────────────────────────── */
  var $ = GK.$ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = GK.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  GK.el = function (tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  };

  GK.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  GK.rnd = function (a, b) { return a + Math.random() * (b - a); };
  GK.rndInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  GK.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  GK.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  GK.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  GK.fmt = function (n) {
    n = Math.round(n);
    return n.toLocaleString('de-DE');
  };
  GK.fmtSigned = function (n) { return (n > 0 ? '+' : '') + GK.fmt(n); };
  GK.fmtX = function (n) { return (Math.round(n * 100) / 100).toFixed(2) + '×'; };

  /* ─────────────────────────── STATE ─────────────────────────── */
  /*
     Spieler, Chips und Feed liegen auf dem Server (siehe server.js) — nur so
     sehen alle dasselbe Leaderboard. Lokal bleibt eine Kopie als Offline-
     Fallback plus die Geräte-Einstellungen (wer hier gerade spielt, Ton an/aus).
  */
  var DEVICE_KEY = 'gambaking:device';

  var defaultState = function () {
    return {
      currentId: null,
      players: {},
      feed: [],
      /* Quote je Spiel, 0..100 mit 50 als neutral. Was fehlt, laeuft neutral. */
      spielLuck: {},
      settings: { sound: true, volume: 50, adminPin: '1337', chaos: true, cardTheme: 'eerie' },
      admin: false
    };
  };

  var state = GK.state = defaultState();

  /** Nur dieses Gerät betreffend — nie auf dem Server. */
  function loadDevice() {
    try {
      var d = JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}');
      if (d.currentId) state.currentId = d.currentId;
      if (d.sound !== undefined) state.settings.sound = d.sound;
      if (d.volume !== undefined) state.settings.volume = d.volume;
      if (d.cardTheme && GK.cardThemeById(d.cardTheme)) state.settings.cardTheme = d.cardTheme;
    } catch (e) {}
  }
  function saveDevice() {
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify({
        currentId: state.currentId,
        sound: state.settings.sound,
        volume: state.settings.volume,
        cardTheme: state.settings.cardTheme
      }));
    } catch (e) {}
  }

  /** Offline-Kopie (und Datenquelle, wenn kein Server läuft). */
  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.players = parsed.players || {};
        state.feed = parsed.feed || [];
        state.spielLuck = parsed.spielLuck || {};
        state.settings = Object.assign(state.settings, parsed.settings || {});
      }
    } catch (e) { /* korrupte Daten -> frischer Start */ }
  }
  function saveLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        players: state.players, feed: state.feed, spielLuck: state.spielLuck,
        settings: { adminPin: state.settings.adminPin }
      }));
    } catch (e) { /* z.B. privater Modus */ }
  }

  GK.save = function () { saveDevice(); saveLocal(); };

  /* ───────────────── UNTERBROCHENE RUNDEN ─────────────────
     Zwei Dinge halten hier fest, was passiert, wenn jemand mitten in einer
     Runde in die Lobby geht oder das Fenster zumacht:

     1. Der Spielstand — was ein Spiel selbst wegschreibt, um beim naechsten
        Oeffnen genau dort weiterzumachen.
     2. Der offene Einsatz — was wager() abgezogen und payout() noch nicht
        verrechnet hat. Bleibt eine Runde ohne Spielstand liegen, kommen die
        Chips zurueck. Verlieren kann man sie durchs Schliessen also nicht.

     Beides haengt an der Spieler-id, damit sich zwei Konten auf demselben
     Geraet nicht in die Quere kommen. */
  var RESUME_KEY = 'gambaking:resume';

  function resumeAll() {
    try { return JSON.parse(localStorage.getItem(RESUME_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function resumeWrite(all) {
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(all)); } catch (e) {}
  }
  function resumeSlot() {
    var p = GK.player();
    return p ? p.id : null;
  }

  /** Spielstand einer laufenden Runde sichern. */
  GK.saveGameState = function (gameId, data) {
    var slot = resumeSlot();
    if (!slot || !gameId) return;
    var all = resumeAll();
    if (!all[slot]) all[slot] = { games: {}, stake: null };
    all[slot].games[gameId] = { at: Date.now(), data: data };
    resumeWrite(all);
  };

  /** Gesicherten Spielstand holen — oder null. */
  GK.loadGameState = function (gameId) {
    var slot = resumeSlot();
    if (!slot || !gameId) return null;
    var e = resumeAll()[slot];
    var s = e && e.games && e.games[gameId];
    return s ? s.data : null;
  };

  GK.hasGameState = function (gameId) { return GK.loadGameState(gameId) !== null; };

  /** Runde ist abgeschlossen — Spielstand wegwerfen. */
  GK.clearGameState = function (gameId) {
    var slot = resumeSlot();
    if (!slot || !gameId) return;
    var all = resumeAll();
    if (all[slot] && all[slot].games) {
      delete all[slot].games[gameId];
      resumeWrite(all);
    }
  };

  /* Offener Einsatz. Mehrere wager()-Aufrufe in derselben Runde — Doppeln
     beim Blackjack, jede Setzrunde beim Poker — summieren sich auf. */
  function openStakeGet() {
    var slot = resumeSlot();
    if (!slot) return null;
    var e = resumeAll()[slot];
    return (e && e.stake) || null;
  }
  function openStakeSet(v) {
    var slot = resumeSlot();
    if (!slot) return;
    var all = resumeAll();
    if (!all[slot]) all[slot] = { games: {}, stake: null };
    all[slot].stake = v;
    resumeWrite(all);
  }

  function openStakeAdd(gameId, amount) {
    if (!gameId) return;
    var cur = openStakeGet();
    if (cur && cur.game === gameId) cur.amount += amount;
    else cur = { game: gameId, amount: amount };
    openStakeSet(cur);
  }

  /**
   * Ergebnis vormerken, das schon feststeht.
   *
   * Bei Rad, Walze, Kugel und Muenze faellt die Entscheidung in dem Moment,
   * in dem gesetzt wird — die Animation zeigt sie nur noch. Wer dazwischen
   * rausgeht, soll damit nichts umgehen koennen. Das Spiel meldet den
   * Ausgang deshalb sofort hier an; bleibt die Runde liegen, wird genau
   * dieser Betrag ausgezahlt statt der Einsatz erstattet.
   *
   * @param {number} win   Auszahlung, 0 bei Verlust
   * @param {number} stake Einsatz der Runde, fuer die Statistik
   */
  GK.commitResult = function (win, stake) {
    var cur = openStakeGet();
    if (!cur) return;
    cur.win = Math.floor(win) || 0;
    cur.resultStake = Math.floor(stake) || cur.amount;
    openStakeSet(cur);
  };

  /**
   * Eine liegengebliebene Runde aufloesen.
   *
   * Drei Faelle, in dieser Reihenfolge:
   *   1. Das Spiel hat einen Stand gesichert — dann laeuft die Runde spaeter
   *      weiter und der Einsatz bleibt stehen.
   *   2. Der Ausgang stand schon fest — dann wird er ausgezahlt, gewonnen wie
   *      verloren. Rausgehen bringt also keinen Vorteil.
   *   3. Weder noch — Einsatz zurueck, denn dann kann ihn niemand mehr
   *      gewinnen.
   *
   * @param {string} [gameId] nur diese Runde pruefen; ohne Angabe die offene
   * @returns {{chips:number, settled:boolean, stake:number}|null}
   *   settled=true heisst: zu Ende gespielt. settled=false: erstattet.
   */
  GK.resolveOpenStake = function (gameId, zwingend) {
    var cur = openStakeGet();
    if (!cur || !cur.amount) return null;
    if (gameId && cur.game !== gameId) return null;
    if (GK.hasGameState(cur.game)) {
      /* Normalerweise laeuft die Runde spaeter weiter. Am Ende einer Party
         gibt es aber kein Spaeter: der Einsatz kam aus der Party-Kasse, und
         die wird gleich abgeraeumt. Ein gesicherter Stand wuerde die Runde
         ins normale Casino tragen und dort aufs Konto verrechnet. */
      if (!zwingend) return null;
      GK.clearGameState(cur.game);
    }

    var p = GK.player();
    if (!p) return null;

    if (cur.win !== undefined) {                  // Ausgang stand schon fest
      var win = cur.win, st = cur.resultStake;
      openStakeSet(null);
      GK.payout(win, { stake: st });
      return { chips: win, settled: true, stake: st };
    }

    var back = Math.floor(cur.amount);
    openStakeSet(null);
    /* In der Party ging der Einsatz aus der Party-Kasse — dorthin muss er
       auch zurueck. Aufs Konto gebucht waere er aus dem Nichts entstanden. */
    if (kasse) {
      kasse.chips += back;
      GK.updateHUD(back);
      return { chips: back, settled: false, stake: back };
    }
    p.balance += back;
    GK.commit('payout', { id: p.id, amount: back, stake: back });
    GK.updateHUD(back);
    return { chips: back, settled: false, stake: back };
  };

  /** Wieviel steht gerade in einer unbeendeten Runde? */
  GK.openStake = function () { return openStakeGet(); };

  /** Serverstand übernehmen. Gibt zurück, ob sich etwas geändert hat. */
  GK.adoptState = function (s) {
    if (!s || !s.players) return false;
    var before = JSON.stringify([state.players, state.feed, state.spielLuck]);
    state.players = s.players;
    state.feed = s.feed || [];
    state.spielLuck = s.spielLuck || {};
    if (state.currentId && !state.players[state.currentId]) state.currentId = null;
    GK.save();
    return JSON.stringify([state.players, state.feed, state.spielLuck]) !== before;
  };

  /**
   * Änderung festschreiben: lokal spiegeln und — wenn ein Server da ist —
   * als Operation dorthin schicken. Der Server ist die verbindliche Quelle.
   */
  GK.commit = function (type, payload) {
    GK.save();
    if (GK.net && GK.net.online) return GK.net.op(type, payload);
    return Promise.resolve(null);
  };

  /** Start: Server suchen, sonst lokal weitermachen. */
  GK.init = function () {
    loadDevice();
    loadLocal();
    state.admin = false;                       // Admin-Modus nie persistent
    applyCardThemeVar();
    if (!GK.net) return Promise.resolve(false);
    return GK.net.probe().then(function (online) {
      if (!online) loadLocal();                // Serverstand hat lokale Kopie nicht ersetzt
      return online;
    });
  };

  /** Nur der Admin — löscht alles (Server oder lokal). */
  GK.wipe = function () {
    if (GK.net && GK.net.online) {
      return GK.net.op('wipe', {}).then(function () {
        try { localStorage.removeItem(KEY); } catch (e) {}
        try { localStorage.removeItem(DEVICE_KEY); } catch (e) {}
      });
    }
    try { localStorage.removeItem(KEY); } catch (e) {}
    try { localStorage.removeItem(DEVICE_KEY); } catch (e) {}
    state = GK.state = defaultState();
    return Promise.resolve();
  };

  /* ─────────────────────────── PLAYERS ─────────────────────────── */
  GK.AVATARS = ['👑', '🐉', '🦄', '👽', '🤡', '🐸', '🦊', '🐙', '🤖', '👻', '🦁', '🐼', '🍄', '🌶️', '💀', '🧙', '🐝', '🦖', '🎃', '🍀'];

  GK.newPlayer = function (name, avatar) {
    var p = {
      id: GK.uid(),
      name: String(name || 'Spieler').slice(0, 18),
      avatar: avatar || GK.pick(GK.AVATARS),
      balance: START_BALANCE,
      granted: 0,       // vom Admin geschenkte Chips (zählen nicht als Profit)
      wagered: 0,
      returned: 0,
      plays: 0,
      wins: 0,
      losses: 0,
      biggestWin: 0,
      biggestWinGame: '',
      peak: START_BALANCE,
      luck: 50,         // 0-100, nur der Admin dreht daran
      xp: 0,
      claimedLevel: 1,
      lastBonus: 0,
      created: Date.now()
    };
    p.lastBailout = 0;
    state.players[p.id] = p;
    state.currentId = p.id;
    GK.save();          // im Server-Modus legt /api/auth/register das Konto an
    return p;
  };

  GK.player = function () { return state.players[state.currentId] || null; };
  GK.playerList = function () {
    return Object.keys(state.players).map(function (k) { return state.players[k]; });
  };
  /* Ein freier Spielerwechsel gibt es nicht mehr — seit es Konten mit
     Passwort gibt, laeuft das ueber Abmelden und neu Anmelden. */
  GK.deletePlayer = function (id) {
    delete state.players[id];
    if (state.currentId === id) {
      var rest = GK.playerList();
      state.currentId = rest.length ? rest[0].id : null;
    }
    GK.commit('deletePlayer', { id: id });
    GK.emit('player-changed');
  };

  /* ─────────────────────────── LEVEL & XP ─────────────────────────── */
  /*
     XP gibt es fürs Spielen — Einsatz zählt, Gewinne zählen extra. Jedes Level
     bringt Chips und schaltet irgendwann neue Spiele frei. Die Formel steht
     identisch in server.js, damit beide Seiten dasselbe rechnen.
  */
  /* Nach oben offen — die 999 ist nur eine Notbremse, damit kein Zähler
     endlos läuft, wenn jemand absurd viel XP geschenkt bekommt. */
  GK.MAX_LEVEL = 999;

  /* Bis Level 30 wird jede Stufe teurer als die vorige. Danach bliebe es
     quadratisch und höhere Level wären praktisch unerreichbar — deshalb
     kostet ab dort jede weitere Stufe so viel wie der Sprung auf 30. Bei
     Level 30 gehen beide Formeln nahtlos ineinander über. */
  var FLAT_FROM = 30;
  var FLAT_BASE = 280 * (FLAT_FROM - 1) + 60 * (FLAT_FROM - 1) * (FLAT_FROM - 2);
  var FLAT_STEP = 280 + 120 * (FLAT_FROM - 1);

  /** Gesamt-XP, die man braucht, um dieses Level zu erreichen. */
  GK.xpForLevel = function (level) {
    if (level <= 1) return 0;
    if (level <= FLAT_FROM) {
      var n = level - 1;
      return 280 * n + 60 * n * (n - 1);
    }
    return FLAT_BASE + (level - FLAT_FROM) * FLAT_STEP;
  };

  GK.levelOf = function (xp) {
    var l = 1;
    while (l < GK.MAX_LEVEL && (xp || 0) >= GK.xpForLevel(l + 1)) l++;
    return l;
  };

  GK.TITLES = [
    { min: 150, title: 'Mythos', icon: '☄️' },
    { min: 100, title: 'Unsterblicher', icon: '💫' },
    { min: 75, title: 'Glücksgott', icon: '🔱' },
    { min: 50, title: 'Neon-Fürst', icon: '🌆' },
    { min: 35, title: 'Chip-Baron', icon: '🏰' },
    { min: 25, title: 'Großmeister', icon: '⚜️' },
    { min: 20, title: 'GambaKing', icon: '👑' },
    { min: 15, title: 'Legende', icon: '🌟' },
    { min: 10, title: 'Casino-Hai', icon: '🦈' },
    { min: 6, title: 'Hochroller', icon: '💸' },
    { min: 3, title: 'Zocker', icon: '🎲' },
    { min: 1, title: 'Chip-Küken', icon: '🐣' }
  ];
  GK.titleOf = function (level) {
    for (var i = 0; i < GK.TITLES.length; i++) if (level >= GK.TITLES[i].min) return GK.TITLES[i];
    return GK.TITLES[GK.TITLES.length - 1];
  };

  /** Fortschritt im aktuellen Level: {level, xp, need, have, pct, title} */
  GK.levelInfo = function (p) {
    p = p || GK.player();
    if (!p) return null;
    var xp = p.xp || 0;
    var lvl = GK.levelOf(xp);
    var base = GK.xpForLevel(lvl);
    var next = GK.xpForLevel(lvl + 1);
    var span = Math.max(1, next - base);
    return {
      level: lvl,
      xp: xp,
      have: xp - base,
      need: span,
      pct: lvl >= GK.MAX_LEVEL ? 100 : GK.clamp(((xp - base) / span) * 100, 0, 100),
      max: lvl >= GK.MAX_LEVEL,
      title: GK.titleOf(lvl)
    };
  };

  /** Belohnung fürs Aufsteigen — ab Level 30 gedeckelt, sonst wäre der
      nach oben offene Fortschritt eine Chip-Quelle ohne Ende. */
  GK.levelReward = function (level) { return 100 * Math.min(level, FLAT_FROM); };

  /** XP gutschreiben; steigt der Spieler auf, gibt es Chips und Konfetti. */
  GK.addXP = function (amount) {
    var p = GK.player();
    if (!p || amount <= 0) return;
    amount = Math.floor(amount);
    var before = GK.levelOf(p.xp || 0);
    p.xp = (p.xp || 0) + amount;
    var after = GK.levelOf(p.xp);

    if (after > before) {
      var reward = 0;
      for (var l = before + 1; l <= after; l++) reward += GK.levelReward(l);
      p.balance += reward;
      p.granted = (p.granted || 0) + reward;
      p.peak = Math.max(p.peak, p.balance);
      p.claimedLevel = after;
      GK.emit('level-up', { level: after, reward: reward });
    }
    GK.commit('xp', { id: p.id, amount: amount });
    GK.emit('xp');
  };

  /* profit = alles was der Spieler selbst erspielt hat (ohne Admin-Geschenke) */
  GK.profitOf = function (p) { return p.balance - START_BALANCE - (p.granted || 0); };
  GK.rtpOf = function (p) { return p.wagered > 0 ? (p.returned / p.wagered) * 100 : 0; };

  /* ─────────────────────────── EVENTS ─────────────────────────── */
  var listeners = {};
  GK.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  GK.emit = function (ev, data) { (listeners[ev] || []).forEach(function (f) { f(data); }); };

  /* ─────────────────────────── MONEY ─────────────────────────── */

  /**
   * Party-Kasse.
   *
   * Im Partymodus spielen alle dieselben Einzelspiele, aber mit demselben
   * Startguthaben — verglichen wird der Gewinn, nicht das Konto. Die Chips
   * dafür kommen nicht vom Konto und gehen auch nicht dorthin zurück: das
   * Konto bleibt während einer Party unangetastet.
   *
   * Statt jedes der neunzehn Spiele anzufassen, hängt der Wechsel hier an
   * der einen Stelle, durch die jeder Einsatz und jede Auszahlung läuft.
   * Solange eine Party läuft, rechnet wager/payout gegen diese Kasse und
   * schickt nichts an den Server — sonst wüchse das echte Konto mit.
   */
  var kasse = null;
  GK.partyKasse = function (start, nachschub) {
    if (start === null) { kasse = null; GK.updateHUD(); return null; }
    if (start !== undefined) {
      kasse = { chips: Math.floor(start), start: Math.floor(start),
                /* satz = was es bei Pleite geschenkt gibt (0 = aus),
                   nachschub = wieviel davon bisher zusammenkam. */
                satz: Math.max(0, Math.floor(nachschub || 0)), nachschub: 0,
                runden: 0, besterWin: 0, letzterWin: 0 };
      GK.updateHUD();
    }
    return kasse;
  };

  /** Gewinn in der Party: was übrig ist, ohne Startgeld und ohne Geschenke. */
  GK.partyGewinn = function () {
    return kasse ? kasse.chips - kasse.start - kasse.nachschub : 0;
  };

  /**
   * Nachschub in der Party: wer blank ist, bekommt gratis weiter Chips.
   *
   * Damit sitzt niemand die halbe Party daneben, nur weil er sich früh
   * verzockt hat. Für die Rangliste zählt das Geschenk nicht — es wird vom
   * Gewinn abgezogen, sonst führte am Ende, wer am öftesten pleite ging.
   */
  function pruefeNachschub() {
    if (!kasse || kasse.satz < 1) return;
    /* Nicht erst bei glatt null: mit drei Chips im Sack kommt man in kein
       Spiel mehr rein, weil jeder Tisch einen Mindesteinsatz hat. Ein
       Hundertstel des Startguthabens liegt sicher darunter. */
    var grenze = Math.max(1, Math.floor(kasse.start / 100));
    if (kasse.chips >= grenze) return;
    /* Reicht ein Satz nicht bis über die Grenze, gibt es mehrere auf einmal —
       aber höchstens zehn, damit eine krumme Einstellung nicht ausufert. */
    var stapel = Math.min(10, Math.ceil((grenze - kasse.chips) / kasse.satz));
    var gabe = stapel * kasse.satz;
    kasse.chips += gabe;
    kasse.nachschub += gabe;
    GK.updateHUD(gabe);
    GK.sfx('coin');
    GK.toast('Blank! Nachschub vom Haus: +' + GK.fmt(gabe) + ' Chips 🎁', 'gold', '🎁');
    GK.emit('party-nachschub', { betrag: gabe, gesamt: kasse.nachschub });
  }
  /** Wieviel gerade zur Verfügung steht — Party-Kasse oder Konto. */
  GK.chips = function () {
    if (kasse) return kasse.chips;
    var p = GK.player();
    return p ? p.balance : 0;
  };

  GK.canBet = function (amount) {
    if (!kasse && !GK.player()) return false;
    return amount >= 1 && amount <= GK.chips();
  };

  /** Einsatz abziehen. Gibt false zurück wenn es nicht reicht. */
  GK.wager = function (amount, game) {
    var p = GK.player();
    amount = Math.floor(amount);
    if (!p || amount < 1) return false;
    if (amount > GK.chips()) {
      GK.toast('Nicht genug Chips! 😅', 'bad', '🪙');
      GK.sfx('error');
      return false;
    }
    if (kasse) {
      kasse.chips -= amount;
      kasse.runden++;
      openStakeAdd(GK.currentGame, amount);
      GK.updateHUD(-amount);
      return true;
    }
    p.balance -= amount;
    p.wagered += amount;
    p.plays++;
    /* Ab hier gilt der Einsatz als offen, bis payout() ihn verrechnet.
       Gebucht wird auf die Spiel-id, nicht auf den Anzeigenamen im zweiten
       Parameter — nur die id passt zum gesicherten Spielstand. */
    openStakeAdd(GK.currentGame, amount);
    GK.commit('wager', { id: p.id, amount: amount });
    /* XP fürs Mitspielen. Zwei Bremsen:
       - Die Wurzel statt des geraden Betrags: wer das Hundertfache setzt,
         bekommt das Zehnfache an XP, nicht das Hundertfache. Vorher war ein
         einziger dicker Einsatz mehr wert als eine halbe Stunde spielen.
       - Ein Faktor je Spiel (xpFaktor in der Registry). Plinko wirft pro
         Runde mehrere Kugeln und bucht für jede einen eigenen Einsatz —
         ohne Bremse sammelt es ein Vielfaches der anderen Spiele. */
    var roh = Math.min(40, Math.max(2, Math.round(Math.sqrt(amount) * 1.3)));
    var sp = GK.gameById(GK.currentGame);
    GK.addXP(Math.max(1, Math.round(roh * ((sp && sp.xpFaktor) || 1))));
    GK.updateHUD(-amount);
    return true;
  };

  /** Auszahlung gutschreiben (0 = verloren). */
  GK.payout = function (amount, meta) {
    var p = GK.player();
    amount = Math.floor(amount);
    if (!p) return;

    var einsatz = Math.floor((meta && meta.stake) || 0);
    /* Runde ist verrechnet — der Einsatz ist damit nicht mehr offen. */
    openStakeSet(null);

    if (kasse) {
      kasse.chips += Math.max(0, amount);
      var gewinn = Math.max(0, amount) - einsatz;
      kasse.letzterWin = gewinn;
      if (gewinn > kasse.besterWin) kasse.besterWin = gewinn;
      GK.updateHUD(amount > 0 ? amount : 0);
      /* Erst der Nachschub, dann die Meldung: so geht der aufgefüllte Stand
         gleich mit an die Rangliste. */
      pruefeNachschub();
      GK.emit('party-runde', { gewinn: gewinn, einsatz: einsatz });
      return;
    }
    if (amount > 0) {
      p.balance += amount;
      p.returned += amount;
      p.peak = Math.max(p.peak, p.balance);
      var net = amount - ((meta && meta.stake) || 0);
      if (net > p.biggestWin) {
        p.biggestWin = net;
        /* Wo der dickste Einzelgewinn herkam — das Leaderboard zeigt es an. */
        p.biggestWinGame = GK.currentGame || p.biggestWinGame || '';
      }
      p.wins++;
      if (net > 0) GK.addXP(8 + Math.min(25, Math.floor(net / 50)));   // Bonus-XP für Gewinne
    } else {
      p.losses++;
    }
    GK.commit('payout', { id: p.id, amount: amount, stake: (meta && meta.stake) || 0,
                          game: GK.currentGame || '' });
    GK.updateHUD(amount > 0 ? amount : 0);
    GK.checkBroke();
  };

  /** Wer alles verloren hat, bekommt Mitleids-Chips — einmal pro Tag. */
  GK.bailoutLeft = function (p) {
    p = p || GK.player();
    if (!p) return 0;
    var left = (p.lastBailout || 0) + DAY - Date.now();
    return left > 0 ? left : 0;
  };

  GK.checkBroke = function () {
    var p = GK.player();
    /* In der Party gibt es keine Mitleids-Chips: alle starten gleich, und wer
       alles verspielt, hat eben verspielt. Sonst wäre das Leaderboard wertlos. */
    if (kasse) return;
    if (!p || p.balance >= 1) return;

    var wait = GK.bailoutLeft(p);
    if (wait > 0) {
      GK.toast('Blank! Mitleids-Chips gibt es in ' + Math.ceil(wait / 3600000) + ' Std. wieder 💀', 'bad', '💀');
      GK.sfx('lose');
      GK.emit('broke');
      return;
    }

    p.lastBailout = Date.now();
    p.balance = BAILOUT;
    p.granted = (p.granted || 0) + BAILOUT;
    GK.commit('bailout', { id: p.id });
    GK.updateHUD(BAILOUT);
    GK.toast('Komplett pleite! Die Krone leiht dir ' + BAILOUT + ' Chips 👑', 'gold', '🆘');
    GK.logFeed(p.name + ' war pleite und bekam ' + BAILOUT + ' Mitleids-Chips', 'admin');
    GK.sfx('coin');
  };

  /** Tagesbonus — darf jeder selbst holen, der Server prüft den Abstand. */
  GK.claimBonus = function () {
    var p = GK.player();
    if (!p) return Promise.resolve(false);
    if (Date.now() - (p.lastBonus || 0) < DAY) return Promise.resolve(false);
    p.lastBonus = Date.now();
    p.balance += 250;
    p.granted = (p.granted || 0) + 250;
    p.peak = Math.max(p.peak, p.balance);
    GK.updateHUD(250);
    return GK.commit('bonus', { id: p.id }).then(function () { return true; });
  };

  /** Admin: Chips schenken/abziehen. */
  GK.grant = function (playerId, amount, silent) {
    var p = state.players[playerId];
    if (!p) return;
    amount = Math.floor(amount);
    p.balance = Math.max(0, p.balance + amount);
    p.granted = (p.granted || 0) + amount;
    p.peak = Math.max(p.peak, p.balance);
    GK.commit('grant', { id: p.id, amount: amount, silent: !!silent });
    GK.updateHUD(amount);
    if (!silent) {
      GK.logFeed('👑 ADMIN: ' + p.name + ' ' + (amount >= 0 ? 'bekommt ' : 'verliert ') + GK.fmt(Math.abs(amount)) + ' Chips', 'admin');
      GK.toast(p.name + ': ' + GK.fmtSigned(amount) + ' Chips', amount >= 0 ? 'gold' : 'bad', amount >= 0 ? '💸' : '✂️');
      GK.sfx(amount >= 0 ? 'cash' : 'error');
      if (amount >= 0) GK.emojiRain(['💸', '🪙', '💰'], 18);
    }
    GK.emit('player-changed');
  };

  /* ─────────────────────────── LUCK ─────────────────────────── */

  /**
   * Zwei Regler wirken auf dasselbe Glueck:
   *
   *   - der persoenliche (p.luck) — er verschiebt einen einzelnen Spieler,
   *   - die Quote je Spiel (state.spielLuck) — sie verschiebt ein Spiel fuer
   *     alle, damit sich einzelne Spiele nachjustieren lassen, ohne jedem
   *     Spieler einzeln am Glueck zu drehen.
   *
   * Beide zaehlen als Abweichung von 50 und werden addiert: ein Spieler auf
   * 60 in einem Spiel auf 60 landet bei 70.
   */
  GK.gameLuck = function (id) {
    var w = state.spielLuck ? state.spielLuck[id || GK.currentGame] : undefined;
    return w === undefined ? 50 : w;
  };

  /** Auf Zehntel gerundet und in 0..100 gehalten — so fein wie die Regler. */
  GK.luckWert = function (v) {
    var n = Math.round((Number(v) || 0) * 10) / 10;
    return Math.max(0, Math.min(100, n));
  };

  /** Quote eines Spiels setzen (nur Admin). 50 heisst neutral. */
  GK.setGameLuck = function (id, wert) {
    if (!id) return Promise.resolve(null);
    state.spielLuck = state.spielLuck || {};
    wert = GK.luckWert(wert);
    if (wert === 50) delete state.spielLuck[id];
    else state.spielLuck[id] = wert;
    return GK.commit('gameLuck', { game: id, luck: wert });
  };

  /** Alle Spiele zurueck auf neutral. */
  GK.resetGameLuck = function () {
    state.spielLuck = {};
    return GK.commit('gameLuck', { alle: true });
  };

  /** Das Glueck, das gerade wirklich zaehlt — 0..100, 50 ist neutral. */
  GK.luckOf = function (gameId) {
    var pl = GK.player();
    var eigen = (pl && pl.luck !== undefined) ? pl.luck : 50;
    return Math.max(0, Math.min(100, eigen + (GK.gameLuck(gameId) - 50)));
  };

  /** Biegt eine Wahrscheinlichkeit anhand des Luck-Werts (50 = neutral). */
  GK.luckify = function (p, gameId) {
    var pl = GK.player();
    if (!pl) return p;
    var l = GK.luckOf(gameId);
    var bias = (l - 50) / 50; // -1 .. +1
    if (bias === 0) return p;
    if (bias > 0) return p + (1 - p) * bias * 0.6;
    return p * (1 + bias * 0.6);
  };
  GK.luckRoll = function (prob, gameId) { return Math.random() < GK.luckify(prob, gameId); };



  /* ─────────────────────────── FEED ─────────────────────────── */
  /**
   * Eintrag in die Aktionsliste.
   *
   * party: Nummer der Party, wenn das in einer Party passiert ist. Die Liste
   * unten in der Spielhalle zeigt waehrend einer Party nur deren eigene
   * Zeilen; ausserhalb stehen sie mit einem "Party:" davor zwischen den
   * normalen. Ohne die Nummer liefen beide Welten durcheinander.
   */
  GK.logFeed = function (text, type, party) {
    var e = { t: Date.now(), text: text, type: type || '' };
    if (party) e.party = party;
    state.feed.unshift(e);
    if (state.feed.length > 40) state.feed.length = 40;
    GK.commit('feed', { text: text, kind: type || '', party: party || '' });
    GK.emit('feed');
  };

  GK.logPlay = function (game, stake, win) {
    var p = GK.player();
    if (!p) return;
    var net = win - stake;
    var txt;
    if (net > 0) txt = p.name + ' gewinnt ' + GK.fmt(net) + ' bei ' + game;
    else if (net === 0) txt = p.name + ' spielt ' + game + ' — Unentschieden';
    else txt = p.name + ' verliert ' + GK.fmt(-net) + ' bei ' + game;
    var inParty = (GK.party && GK.party.an && GK.party.id) || null;
    GK.logFeed(txt, net > 0 ? 'win' : (net < 0 ? 'lose' : ''), inParty);
  };

  /* ─────────────────────────── AUDIO ─────────────────────────── */
  var Sound = GK.sound = {
    ctx: null,
    master: null,
    ready: false,
    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        /* 'interactive' bittet um den kleinsten Ausgabepuffer. Ohne den Wunsch
           waehlt vor allem iOS einen grossen Puffer und der Ton kommt hoerbar
           nach dem Bild. Aeltere Browser kennen die Angabe nicht — dann greift
           der Aufruf ohne Argument. */
        try { this.ctx = new AC({ latencyHint: 'interactive' }); }
        catch (e) { this.ctx = new AC(); }
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.ready = true;
        this.applyVolume();
      } catch (e) { this.ready = false; }
    },
    applyVolume: function () {
      if (!this.master) return;
      var v = state.settings.volume;
      this.master.gain.value = (v === undefined ? 50 : v) / 100 * 0.45;
    },
    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    enabled: function () { return state.settings.sound !== false; },

    tone: function (o) {
      if (!this.ready || !this.enabled()) return;
      var ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + (o.dur || 0.15));
      var vol = (o.vol === undefined ? 0.3 : o.vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + (o.dur || 0.15) + 0.03);
    },

    noise: function (o) {
      if (!this.ready || !this.enabled()) return;
      o = o || {};
      var ctx = this.ctx, dur = o.dur || 0.2, t0 = ctx.currentTime + (o.delay || 0);
      var buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = o.filter || 'lowpass';
      f.frequency.value = o.freq || 900;
      var g = ctx.createGain();
      g.gain.setValueAtTime(o.vol === undefined ? 0.22 : o.vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + dur);
    }
  };

  var SFX = {
    click:   function () { Sound.tone({ freq: 520, to: 760, dur: 0.07, type: 'square', vol: 0.16 }); },
    hover:   function () { Sound.tone({ freq: 880, dur: 0.04, type: 'sine', vol: 0.07 }); },
    chip:    function () { Sound.noise({ dur: 0.09, freq: 2600, filter: 'highpass', vol: 0.14 }); Sound.tone({ freq: 1400, to: 900, dur: 0.07, type: 'sine', vol: 0.12 }); },
    spin:    function () { Sound.tone({ freq: 180, to: 620, dur: 0.5, type: 'sawtooth', vol: 0.12 }); },
    tick:    function () { Sound.tone({ freq: 1500, dur: 0.03, type: 'square', vol: 0.09 }); },
    reel:    function () { Sound.tone({ freq: 300, to: 160, dur: 0.12, type: 'triangle', vol: 0.18 }); Sound.noise({ dur: 0.08, freq: 1200, vol: 0.1 }); },
    card:    function () { Sound.noise({ dur: 0.12, freq: 3200, filter: 'highpass', vol: 0.16 }); },
    coin:    function () { [1046, 1318, 1568].forEach(function (f, i) { Sound.tone({ freq: f, dur: 0.11, type: 'sine', vol: 0.2, delay: i * 0.05 }); }); },
    cash:    function () { [784, 988, 1174, 1568].forEach(function (f, i) { Sound.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.2, delay: i * 0.06 }); }); },
    win:     function () { [523, 659, 784, 1046].forEach(function (f, i) { Sound.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.2, delay: i * 0.075 }); }); },
    bigwin:  function () { [523, 659, 784, 1046, 1318, 1568, 2093].forEach(function (f, i) { Sound.tone({ freq: f, dur: 0.22, type: 'square', vol: 0.22, delay: i * 0.085 }); }); },
    jackpot: function () {
      [523, 784, 1046, 784, 1046, 1318, 1046, 1318, 1568, 2093].forEach(function (f, i) {
        Sound.tone({ freq: f, dur: 0.2, type: 'square', vol: 0.22, delay: i * 0.1 });
        Sound.tone({ freq: f * 1.5, dur: 0.2, type: 'triangle', vol: 0.1, delay: i * 0.1 });
      });
    },
    lose:    function () { Sound.tone({ freq: 300, to: 90, dur: 0.5, type: 'sawtooth', vol: 0.2 }); },
    error:   function () { Sound.tone({ freq: 160, dur: 0.16, type: 'square', vol: 0.2 }); Sound.tone({ freq: 120, dur: 0.2, type: 'square', vol: 0.18, delay: 0.12 }); },
    boom:    function () { Sound.noise({ dur: 0.55, freq: 380, vol: 0.4 }); Sound.tone({ freq: 120, to: 40, dur: 0.5, type: 'sawtooth', vol: 0.28 }); },
    gem:     function () { Sound.tone({ freq: 1200, to: 1900, dur: 0.13, type: 'sine', vol: 0.2 }); },
    rocket:  function () { Sound.noise({ dur: 0.35, freq: 700, vol: 0.14 }); },
    /* dumpfer Hufschlag auf Rasen — leicht variiert, damit 5 Pferde nach Feld klingen */
    hoof:    function () {
      var v = 0.09 + Math.random() * 0.05;
      Sound.noise({ dur: 0.05, freq: 300 + Math.random() * 120, filter: 'lowpass', vol: v });
      Sound.tone({ freq: 92 + Math.random() * 26, to: 50, dur: 0.07, type: 'sine', vol: v * 1.2 });
    },
    /* Startglocke */
    startbell: function () {
      [1046, 1568].forEach(function (f, i) {
        Sound.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.16, delay: i * 0.09 });
      });
    },
    whoosh:  function () { Sound.noise({ dur: 0.3, freq: 1500, filter: 'bandpass', vol: 0.16 }); },
    /* Pinguin-Watscheln: zwei tiefe, gedämpfte Schritte auf dem Eis. Bewusst
       ohne Höhen — ein Zischen bei jedem Sprung nervt schnell. */
    waddle:  function () {
      [0, 0.1].forEach(function (d, i) {
        Sound.tone({ freq: 128 - i * 18, to: 62 - i * 8, dur: 0.13, type: 'sine', vol: 0.24, delay: d });
        Sound.noise({ dur: 0.05, freq: 420, filter: 'lowpass', vol: 0.08, delay: d });
      });
    },
    /* Mitternachts-Mysterium: eine Seele setzt sich auf den Altar — tiefes
       Anschwellen statt hellem Klick, sonst klingt die Gruft wie ein Automat. */
    soul:    function () {
      Sound.tone({ freq: 196, to: 294, dur: 0.34, type: 'sine', vol: 0.2 });
      Sound.tone({ freq: 98, to: 147, dur: 0.4, type: 'triangle', vol: 0.13, delay: 0.02 });
      Sound.noise({ dur: 0.26, freq: 620, filter: 'bandpass', vol: 0.05, delay: 0.04 });
    },
    /* Eine Kerze geht aus: kurzer Luftzug, kein Knall */
    snuff:   function () {
      Sound.noise({ dur: 0.24, freq: 680, filter: 'lowpass', vol: 0.17 });
      Sound.tone({ freq: 280, to: 110, dur: 0.2, type: 'sine', vol: 0.1 });
    },
    /* Der Drache regt sich: tiefes, anschwellendes Knurren kurz vorm Erwachen */
    growl:   function () {
      Sound.tone({ freq: 68, to: 92, dur: 0.5, type: 'sawtooth', vol: 0.22 });
      Sound.noise({ dur: 0.42, freq: 260, filter: 'lowpass', vol: 0.16 });
      Sound.tone({ freq: 140, to: 110, dur: 0.35, type: 'triangle', vol: 0.1, delay: 0.08 });
    },
    /* Spannung: langsam ansteigender Ton, wenn nur noch eine Walze fehlt und
       der Bonus zum Greifen nah ist. Bewusst leise und ohne Hoehen — er soll
       ziehen, nicht stechen. */
    tension: function () {
      Sound.tone({ freq: 180, to: 620, dur: 1.1, type: 'triangle', vol: 0.16 });
      Sound.tone({ freq: 90, to: 310, dur: 1.15, type: 'sine', vol: 0.11, delay: 0.03 });
      Sound.noise({ dur: 0.9, freq: 1400, filter: 'bandpass', vol: 0.05, delay: 0.1 });
    },
    /* Freispiele ausgeloest: heller Aufstieg mit Nachschlag */
    freespin: function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        Sound.tone({ freq: f, dur: 0.26, type: 'square', vol: 0.2, delay: i * 0.09 });
        Sound.tone({ freq: f * 2, dur: 0.2, type: 'triangle', vol: 0.09, delay: i * 0.09 + 0.02 });
      });
      Sound.noise({ dur: 0.5, freq: 3000, filter: 'highpass', vol: 0.1, delay: 0.45 });
    },
    /* Ein einzelner Freispiel-Dreh startet — kurzer Anstoss statt Fanfare */
    freespin2: function () {
      Sound.tone({ freq: 660, to: 990, dur: 0.16, type: 'triangle', vol: 0.14 });
    },
    /* Landung auf der Scholle: kurzer Bass-Plumps plus Eisknirschen */
    plop:    function () {
      Sound.tone({ freq: 190, to: 78, dur: 0.16, type: 'sine', vol: 0.26 });
      Sound.noise({ dur: 0.07, freq: 900, filter: 'lowpass', vol: 0.1 });
    }
  };

  /* Die Namen aller eingebauten Klaenge — das Sound-Pack liest sie aus, um
     zu zeigen, was ueberhaupt austauschbar ist. */
  GK.SFX_NAMES = SFX;

  /** Welches Spiel gerade offen ist; das Sound-Pack kann darauf hoeren. */
  GK.currentGame = null;

  /**
   * Einen Ton spielen.
   *
   * Zuerst darf das Sound-Pack ran (assets/sfx/sounds.json). Nur wenn dort
   * nichts fuer diesen Namen hinterlegt ist oder die Datei noch nicht im
   * Speicher liegt, uebernimmt der eingebaute Synthesizer. Damit laesst sich
   * jeder Klang einzeln austauschen, ohne dass etwas verstummt.
   *
   * @param {string} name  Klangname, siehe GK.SFX_NAMES
   * @param {string} [gameId]  Spiel-Kontext; ohne Angabe gilt GK.currentGame
   */
  /** Liegt fuer diesen Ton eine eigene Datei bereit? Siehe pack.isFile. */
  GK.sfxFromFile = function (name, gameId) {
    return !!(GK.sfxPack && GK.sfxPack.isFile && GK.sfxPack.isFile(name, gameId));
  };

  GK.sfx = function (name, gameId) {
    Sound.init();
    Sound.resume();
    if (GK.sfxPack) {
      try { if (GK.sfxPack.play(name, gameId)) return; } catch (e) {}
    }
    if (SFX[name]) { try { SFX[name](); } catch (e) {} }
  };

  /**
   * Klickfolge einer ausrollenden Scheibe: am Anfang schnell, zum Schluss
   * immer träger — so wie sich das Rad auch dreht.
   *
   * Die Animationen laufen mit einer ease-out-Kurve, die Scheibe legt also
   * gleiche Winkel in immer längeren Abständen zurück. Ein Klick pro Segment
   * heißt: gleichmäßig über den Weg verteilt, nicht über die Zeit. Umgekehrt
   * zu p(x) = 1-(1-x)³ liegt der k-te Klick also bei 1-(1-k/n)^⅓.
   * Klicks, die dichter als minGap zusammenfallen, fallen weg — sonst wird
   * aus dem Anfang ein Surren.
   *
   * Gibt eine Funktion zum Abbrechen zurück.
   */
  GK.tickRun = function (count, duration, opts) {
    opts = opts || {};
    var sound = opts.sound || 'tick';
    var minGap = opts.minGap === undefined ? 95 : opts.minGap;
    var timers = [];
    var last = -Infinity;
    for (var i = 1; i <= count; i++) {
      var t = duration * (1 - Math.pow(1 - i / count, 1 / 3));
      if (t - last < minGap) continue;
      last = t;
      timers.push(setTimeout(function () { GK.sfx(sound); }, t));
    }
    return function () { timers.forEach(clearTimeout); };
  };

  GK.toggleSound = function () {
    state.settings.sound = !state.settings.sound;
    GK.save();
    if (state.settings.sound) GK.sfx('coin');
    return state.settings.sound;
  };

  /** Lautstärke 0–100 → Master-Gain. */
  GK.setVolume = function (v, preview) {
    state.settings.volume = GK.clamp(Math.round(Number(v) || 0), 0, 100);
    Sound.applyVolume();
    saveDevice();
    if (preview && state.settings.sound && state.settings.volume > 0) GK.sfx('tick');
    return state.settings.volume;
  };
  GK.volume = function () { return state.settings.volume; };

  /* ─────────────────────────── VISUAL FX ─────────────────────────── */
  var canvas, ctx2d, particles = [], rafId = null;

  function initCanvas() {
    canvas = $('#fx-canvas');
    if (!canvas) return;
    ctx2d = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }
  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function tickParticles() {
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += p.g;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;
      if (p.life <= 0 || p.y > canvas.height + 60) { particles.splice(i, 1); continue; }
      ctx2d.save();
      ctx2d.translate(p.x, p.y);
      ctx2d.rotate(p.rot);
      ctx2d.globalAlpha = Math.min(1, p.life / 40);
      if (p.text) {
        ctx2d.font = p.size + 'px serif';
        ctx2d.textAlign = 'center';
        ctx2d.fillText(p.text, 0, 0);
      } else {
        ctx2d.fillStyle = p.color;
        ctx2d.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx2d.restore();
    }
    if (particles.length) rafId = requestAnimationFrame(tickParticles);
    else { rafId = null; ctx2d.clearRect(0, 0, canvas.width, canvas.height); }
  }
  function ensureLoop() { if (!rafId && particles.length) rafId = requestAnimationFrame(tickParticles); }

  var CONFETTI_COLORS = ['#ff2fd0', '#8b3bff', '#00e5ff', '#7cff3b', '#ffd12e', '#ff8a00', '#ff3b6b'];

  GK.confetti = function (count, origin) {
    if (!ctx2d) return;
    count = count || 90;
    var ox = origin ? origin.x : canvas.width / 2;
    var oy = origin ? origin.y : canvas.height * 0.35;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: ox, y: oy,
        vx: GK.rnd(-11, 11), vy: GK.rnd(-16, -3),
        g: 0.34, rot: GK.rnd(0, 6.28), vr: GK.rnd(-0.3, 0.3),
        size: GK.rnd(7, 16), color: GK.pick(CONFETTI_COLORS), life: GK.rndInt(70, 140)
      });
    }
    ensureLoop();
  };

  GK.burst = function (emojis, count, origin) {
    if (!ctx2d) return;
    count = count || 24;
    var ox = origin ? origin.x : canvas.width / 2;
    var oy = origin ? origin.y : canvas.height / 2;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: ox, y: oy,
        vx: GK.rnd(-9, 9), vy: GK.rnd(-14, -2),
        g: 0.32, rot: GK.rnd(0, 6.28), vr: GK.rnd(-0.2, 0.2),
        size: GK.rnd(20, 38), text: GK.pick(emojis), life: GK.rndInt(60, 120)
      });
    }
    ensureLoop();
  };

  GK.emojiRain = function (emojis, count) {
    var host = $('#emoji-rain');
    if (!host) return;
    count = count || 24;
    for (var i = 0; i < count; i++) {
      (function (i) {
        setTimeout(function () {
          var e = document.createElement('div');
          e.className = 'rain-emoji';
          e.textContent = GK.pick(emojis);
          e.style.left = GK.rnd(0, 96) + 'vw';
          e.style.fontSize = GK.rnd(1.4, 3.2) + 'rem';
          var dur = GK.rnd(2.2, 4.2);
          e.style.animationDuration = dur + 's';
          host.appendChild(e);
          setTimeout(function () { e.remove(); }, dur * 1000 + 200);
        }, i * 90);
      })(i);
    }
  };

  GK.floatNum = function (amount, x, y) {
    var d = document.createElement('div');
    d.className = 'float-num';
    d.textContent = GK.fmtSigned(amount);
    d.style.color = amount >= 0 ? '#7cff3b' : '#ff3b6b';
    d.style.left = (x || window.innerWidth / 2) + 'px';
    d.style.top = (y || window.innerHeight / 2) + 'px';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1150);
  };

  GK.shake = function (el, strong) {
    el = el || document.getElementById('main');
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, strong ? 700 : 460);
  };

  /* ─────────────────────────── TOASTS ─────────────────────────── */
  GK.toast = function (msg, kind, emoji) {
    var host = $('#toasts');
    if (!host) return;
    var t = GK.el('div', { class: 'toast ' + (kind || '') }, [
      GK.el('span', { class: 'toast-emoji', text: emoji || '🎲' }),
      GK.el('span', { text: msg })
    ]);
    host.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 320);
    }, 3400);
    while (host.children.length > 4) host.removeChild(host.firstChild);
  };

  /* ─────────────────────────── HUD ─────────────────────────── */
  GK.updateHUD = function (delta) {
    var p = GK.player();
    var bal = $('#balance-value'), nm = $('#player-name'), av = $('#player-avatar');
    if (bal) {
      /* Während einer Party zählt die Party-Kasse — das Konto ruht solange. */
      bal.textContent = kasse ? GK.fmt(kasse.chips) : (p ? GK.fmt(p.balance) : '0');
      var chip = $('#hud-balance');
      if (chip && delta) {
        chip.classList.remove('balance-pop');
        void chip.offsetWidth;
        chip.classList.add('balance-pop');
        var r = chip.getBoundingClientRect();
        GK.floatNum(delta, r.left + r.width / 2, r.bottom + 6);
      }
    }
    if (nm) nm.textContent = p ? p.name : 'Gast';
    if (av) av.textContent = p ? p.avatar : '👤';
    GK.emit('hud');
  };

  /* ─────────────────────────── MODAL ─────────────────────────── */
  var modalOnClose = null;

  GK.modal = function (opts) {
    var root = $('#modal-root'), content = $('#modal-content');
    if (!root || !content) return;
    content.innerHTML = '';
    if (opts.icon && GK.hasIcon(opts.icon)) content.appendChild(GK.el('div', { class: 'modal-icon', html: GK.iconHTML(opts.icon) }));
    else if (opts.emoji) content.appendChild(GK.el('span', { class: 'modal-emoji', text: opts.emoji }));
    if (opts.title) content.appendChild(GK.el('h3', { text: opts.title }));
    if (opts.text) content.appendChild(GK.el('p', { html: opts.text }));
    (opts.nodes || []).forEach(function (n) { content.appendChild(n); });
    /* weit: breiter Dialog fuer Panels mit vielen Reglern. Auf dem Handy
       aendert die Klasse nichts — dort greift sie erst ab 900 px. */
    var kasten = root.querySelector('.modal');
    if (kasten) kasten.classList.toggle('weit', !!opts.weit);
    root.hidden = false;
    root.querySelector('.modal-x').style.display = opts.locked ? 'none' : '';
    $$('[data-close]', root).forEach(function (b) { b.style.pointerEvents = opts.locked ? 'none' : ''; });
    modalOnClose = opts.onClose || null;
    GK.sfx('whoosh');
    var focusable = content.querySelector('input,select,button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 120);
  };

  GK.closeModal = function () {
    var root = $('#modal-root');
    if (!root || root.hidden) return;
    root.hidden = true;
    var cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  };

  /* ─────────────────────────── BET PANEL ─────────────────────────── */
  /**
   * Wiederverwendbares Einsatz-Widget.
   * opts: { start, min, max, label, onChange }
   */
  GK.betPanel = function (opts) {
    opts = opts || {};
    var min = opts.min || 1;
    var maxFn = function () {
      var cap = opts.max || Infinity;
      /* GK.chips statt p.balance: im Partymodus zaehlt die Party-Kasse. */
      return Math.max(min, Math.min(cap, GK.chips() || min));
    };

    var input = GK.el('input', {
      class: 'bet-input', type: 'number', min: min, step: 1,
      value: Math.min(opts.start || 10, maxFn())
    });

    function clampVal(v) {
      v = Math.floor(Number(v) || 0);
      return GK.clamp(v, min, Math.max(min, maxFn()));
    }
    function setVal(v, quiet) {
      input.value = clampVal(v);
      if (!quiet) { GK.sfx('chip'); }
      if (opts.onChange) opts.onChange(Number(input.value));
    }

    input.addEventListener('change', function () { setVal(input.value, true); });
    input.addEventListener('blur', function () { setVal(input.value, true); });

    /* cls markiert die Knöpfe, die in der schmalen Handy-Leiste wegfallen —
       +10 und +100 sind dort durch ½, 2× und +50 abgedeckt. */
    function qb(label, fn, title, cls) {
      return GK.el('button', {
        class: 'chip-btn ' + (cls || ''), type: 'button', title: title || '',
        onClick: function () { fn(); }
      }, [label]);
    }

    var quick = GK.el('div', { class: 'bet-quick' }, [
      qb('½', function () { setVal(Math.floor(Number(input.value) / 2)); }, 'Halbieren'),
      qb('2×', function () { setVal(Number(input.value) * 2); }, 'Verdoppeln'),
      qb('+10', function () { setVal(Number(input.value) + 10); }, '', 'qb-extra'),
      qb('+50', function () { setVal(Number(input.value) + 50); }),
      qb('+100', function () { setVal(Number(input.value) + 100); }, '', 'qb-extra'),
      qb('MIN', function () { setVal(min); }),
      qb('ALL IN 🔥', function () { setVal(maxFn()); }, 'Alles setzen', 'qb-allin')
    ]);

    var wrap = GK.el('div', { class: 'bet-panel' }, [
      GK.el('div', { class: 'bet-label', text: opts.label || 'DEIN EINSATZ' }),
      GK.el('div', { class: 'bet-row' }, [input]),
      quick
    ]);

    var api = {
      el: wrap,
      value: function () { return clampVal(input.value); },
      set: function (v) { setVal(v, true); },
      disable: function (on) {
        input.disabled = !!on;
        $$('button', quick).forEach(function (b) { b.disabled = !!on; });
      },
      refresh: function () { input.value = clampVal(input.value); }
    };
    // nur solange das Widget im DOM hängt (Spielwechsel räumt sich so selbst auf)
    GK.on('hud', function () { if (input.isConnected && !input.disabled) api.refresh(); });
    return api;
  };

  /* ─────────────────────────── SPIELKARTEN ─────────────────────────── */
  /*
     Blackjack, Poker und jedes künftige Kartenspiel teilen sich ihre
     Kartenblätter als Bilddateien unter assets/cards/themes/<theme>/
     (z. B. „QH.webp" für Herz-Dame, „back.webp" für die Rückseite). Beide
     Spiele führen ihre Farben als Zeichen ♠♥♦♣ — hier wird das auf den
     Dateibuchstaben übersetzt, damit die Spielmodule ihre Datenstruktur
     behalten können.

     Jedes Theme bringt sein eigenes Seitenverhältnis mit (die Community-
     Kartenblätter sind deutlich breiter als das ursprüngliche schmale Set),
     deshalb setzt setCardTheme eine CSS-Variable, statt das Verhältnis fest
     in games.css zu verdrahten.
  */
  var SUIT_FILE = { '♥': 'H', '♦': 'D', '♣': 'C', '♠': 'S' };

  GK.CARD_THEMES = [
    { id: 'juggler',    name: 'Juggler',    aspect: '260/364' },
    { id: 'excaliber',  name: 'Excaliber',  aspect: '260/364' },
    { id: 'eerie',      name: 'Eerie',      aspect: '260/364' },
    { id: 'prismnight', name: 'Prismnight', aspect: '260/364' }
  ];

  /* Feste Blätter ausserhalb der Deck-Auswahl. Watten gehört ein deutsches
     Blatt, und das ist deutlich schmaler als ein französisches: 0.54 statt
     0.71. Ohne eigenes Seitenverhältnis steckte die Karte in einer viel zu
     breiten Kachel, mit weissen Streifen links und rechts — sie sah aus, als
     hätte sie die falsche Grösse. Der Wert ist von tools/build-watten.py aus
     der Vorlage gemessen und wird dort beim Schneiden ausgegeben. */
  GK.CARD_DECKS = {
    watten: { aspect: '260/478' }
  };

  GK.cardThemeById = function (id) {
    for (var i = 0; i < GK.CARD_THEMES.length; i++) if (GK.CARD_THEMES[i].id === id) return GK.CARD_THEMES[i];
    return null;
  };
  GK.cardTheme = function () {
    return GK.cardThemeById(state.settings.cardTheme) || GK.CARD_THEMES[0];
  };

  function applyCardThemeVar() {
    document.documentElement.style.setProperty('--card-ar', GK.cardTheme().aspect);
  }

  /** Deck-Theme wechseln — gilt sofort für jedes offene Kartenspiel. */
  GK.setCardTheme = function (id) {
    if (!GK.cardThemeById(id) || id === state.settings.cardTheme) return;
    state.settings.cardTheme = id;
    saveDevice();
    applyCardThemeVar();
    GK.emit('cardtheme', id);
  };

  /**
   * Eine Spielkarte als Element.
   * card = { r: 'A'..'K', s: '♠♥♦♣' }, hidden = Rückseite, cls = Zusatzklassen
   */
  GK.cardEl = function (card, hidden, cls, deck) {
    var e = GK.el('div', { class: 'card ' + (cls || '') + (hidden ? ' back' : '') });
    var file = hidden ? 'back' : (card.r + (SUIT_FILE[card.s] || 'S'));
    /* deck umgeht die Deck-Auswahl. Watten braucht das: dort gehoert ein
       deutsches Blatt hin, und ein franzoesisches waere schlicht das falsche
       Spiel. Der Ordner liegt deshalb ausserhalb von themes/ und taucht in
       der Auswahl gar nicht erst auf. */
    var pfad = deck
      ? 'assets/cards/' + deck + '/'
      : 'assets/cards/themes/' + GK.cardTheme().id + '/';
    var img = GK.el('img', { src: pfad + file + '.webp', alt: '', draggable: 'false' });
    if (deck) {
      img.setAttribute('data-deck', deck);
      /* Ein festes Blatt bringt sein eigenes Seitenverhältnis mit — sonst
         gälte das des gewählten Themes und die Karte bekäme weisse Streifen.
         Das Attribut steht zusätzlich auf der Karte selbst, damit games.css
         die Breite anpassen kann: ein schmaleres Blatt wird bei gleicher
         Breite höher, und der Tisch wüchse sonst über den Schirm. */
      e.setAttribute('data-deck', deck);
      var eigen = GK.CARD_DECKS[deck];
      if (eigen) e.style.setProperty('--card-ar', eigen.aspect);
      /* Fehlt das eigene Blatt noch, greift das gewohnte Deck. Besser ein
         franzoesisches Bild als ein kaputtes. */
      img.addEventListener('error', function () {
        if (img.getAttribute('data-ersatz')) return;
        img.setAttribute('data-ersatz', '1');
        img.removeAttribute('data-deck');
        e.removeAttribute('data-deck');
        e.style.removeProperty('--card-ar');
        img.src = 'assets/cards/themes/' + GK.cardTheme().id + '/' + file + '.webp';
      });
    }
    e.appendChild(img);
    return e;
  };

  /**
   * Lupe — das Hover für Geräte ohne Hover.
   *
   * Am Schreibtisch wird eine Karte groß, sobald der Zeiger darauf liegt. Auf
   * dem Handy gibt es keinen Zeiger, und gerade dort sind die Karten am
   * kleinsten. Wer hier länger auf einer Karte bleibt, bekommt dasselbe: sie
   * wächst, solange der Finger liegt, und geht beim Loslassen zurück.
   *
   * Zwei Dinge, die leicht schiefgehen:
   *
   *   1. Das Halten darf nicht als Zug durchgehen. Sonst legt man beim
   *      Nachschauen versehentlich eine Karte. Nach dem Loslassen wird der
   *      Klick deshalb einmal geschluckt.
   *   2. Wer scrollt, berührt dabei fast immer irgendeine Karte. Rutscht der
   *      Finger, bevor die Zeit um ist, passiert deshalb gar nichts.
   *
   * Vergrößert wird nicht die Karte selbst, sondern eine Kopie über dem Tisch.
   * Der Mehrspieler-Tisch baut sich bei jeder Aktualisierung neu auf und
   * räumte die vergrößerte Karte sonst mitten im Hinsehen weg; außerdem kann
   * eine Kopie über den Rand ihrer Reihe hinauswachsen, die Karte selbst nicht.
   *
   * Angemeldet wird nur auf Berührungen. Eine Maus braucht das nicht, für sie
   * gibt es das echte Hover in games.css.
   */
  (function lupe() {
    var HALTEN = 350;     // so lange muss der Finger liegen bleiben
    var WACKELN = 12;     // so weit darf er dabei rutschen
    var SPERRE = 400;     // so lange gilt der Klick danach als verbraucht
    var GROESSE = 200;    // so breit soll die Karte in der Lupe werden
    var uhr = null, kopie = null, vonX = 0, vonY = 0, sperreBis = 0;

    /** Eine Kopie der Karte, groß und über allem. */
    function zeigen(el) {
      var k = el.getBoundingClientRect();
      if (!k.width) return;
      /* So weit, dass man sie lesen kann, aber nie über den halben Schirm. */
      var ziel = Math.min(GROESSE, window.innerWidth * 0.46, window.innerHeight * 0.3
        * (k.width / k.height));
      var mal = Math.max(1.35, Math.min(3.2, ziel / k.width));

      /* Wächst die Karte aus dem Bild, wächst sie eben zur anderen Seite. */
      var halb = k.width * (mal - 1) / 2;
      var x = k.left - halb < 4 ? 'left'
        : (k.right + halb > window.innerWidth - 4 ? 'right' : 'center');
      var hoch = k.height * (mal - 1) / 2;
      var y = k.top - hoch < 4 ? 'top'
        : (k.bottom + hoch > window.innerHeight - 4 ? 'bottom' : 'center');

      kopie = el.cloneNode(true);
      kopie.className = el.className.replace(/\bfrisch\b/, '') + ' lupe';
      kopie.style.left = k.left + 'px';
      kopie.style.top = k.top + 'px';
      kopie.style.width = k.width + 'px';
      kopie.style.height = k.height + 'px';
      kopie.style.transformOrigin = x + ' ' + y;
      kopie.style.setProperty('--lupe', mal.toFixed(2));
      document.body.appendChild(kopie);
      /* Erst im nächsten Bild groß werden, sonst gibt es keinen Übergang. */
      requestAnimationFrame(function () {
        if (kopie) kopie.classList.add('gross');
      });
    }

    function abbrechen() {
      if (uhr) { clearTimeout(uhr); uhr = null; }
    }

    function zurueck() {
      abbrechen();
      if (!kopie) return;
      if (kopie.parentNode) kopie.parentNode.removeChild(kopie);
      kopie = null;
      /* Der Klick kommt erst nach dem Loslassen. Statt einen Zuhörer scharf
         zu stellen, der womöglich nie auslöst und dann irgendwann den
         falschen Klick frisst, gilt hier nur ein kurzes Zeitfenster. */
      sperreBis = Date.now() + SPERRE;
    }

    document.addEventListener('click', function (ev) {
      if (Date.now() >= sperreBis) return;
      sperreBis = 0;
      ev.stopPropagation();
      ev.preventDefault();
    }, true);

    document.addEventListener('touchstart', function (ev) {
      zurueck();
      if (ev.touches.length !== 1) return;
      var ziel = ev.target.closest && ev.target.closest('.card:not(.slot)');
      if (!ziel) return;
      vonX = ev.touches[0].clientX;
      vonY = ev.touches[0].clientY;
      uhr = setTimeout(function () {
        uhr = null;
        zeigen(ziel);
      }, HALTEN);
    }, { passive: true });

    document.addEventListener('touchmove', function (ev) {
      if (!uhr || !ev.touches.length) return;
      if (Math.abs(ev.touches[0].clientX - vonX) > WACKELN ||
          Math.abs(ev.touches[0].clientY - vonY) > WACKELN) abbrechen();
    }, { passive: true });

    /* Auf touchend allein ist kein Verlass: genau beim langen Druck wertet
       der Browser die Geste als seine eigene und beendet die Berührung mit
       pointerup, ohne je ein touchend zu schicken — die Kopie bliebe dann am
       Schirm kleben. Deshalb zählt hier jedes Loslassen, egal unter welchem
       Namen es kommt. */
    ['touchend', 'touchcancel', 'pointerup', 'pointercancel']
      .forEach(function (name) {
        document.addEventListener(name, zurueck, { passive: true });
      });

    /* Android blendet beim langen Halten sein Kontextmenü ein — dieselbe
       Geste, mit der man hier die Karte gross macht. */
    document.addEventListener('contextmenu', function (ev) {
      if (ev.target.closest && ev.target.closest('.card')) ev.preventDefault();
    });
  }());

  /**
   * Deck gewechselt? Dann sofort alle liegenden Karten umstellen.
   *
   * Die Spiele bauen ihre Karten einmal auf und rühren sie danach nicht mehr
   * an — ohne das hier sah man das neue Deck erst bei der nächsten Hand, und
   * am Mehrspieler-Tisch teils gar nicht. Der Pfad einer Karte unterscheidet
   * sich nur im Theme-Ordner, deshalb reicht es, genau diesen Teil zu
   * ersetzen. Die Vorschaubilder im Umschalter selbst liegen nicht in einer
   * .card und bleiben deshalb unberührt — jedes zeigt ja sein eigenes Deck.
   */
  GK.on('cardtheme', function (id) {
    /* Karten mit eigenem Deck (Watten) sind von der Auswahl ausgenommen. */
    $$('.card img:not([data-deck])').forEach(function (img) {
      var neu = img.getAttribute('src').replace(/\/themes\/[^/]+\//, '/themes/' + id + '/');
      if (neu !== img.getAttribute('src')) img.setAttribute('src', neu);
    });
  });

  /**
   * Wiederverwendbarer Deck-Theme-Umschalter für Kartenspiele. Rendert die
   * Rückseiten aller Themes als klickbare Kacheln; die Auswahl ist global
   * (gilt geräteweit für alle Kartenspiele), nicht pro Spiel.
   */
  GK.cardThemePicker = function () {
    var thumbs = {};
    var wrap = GK.el('div', { class: 'cardtheme-picker' }, [
      GK.el('div', { class: 'bet-label', text: 'KARTENDECK' }),
      GK.el('div', { class: 'cardtheme-row' }, GK.CARD_THEMES.map(function (t) {
        var thumb = GK.el('button', {
          class: 'cardtheme-thumb', type: 'button', title: t.name,
          onClick: function () { GK.sfx('chip'); GK.setCardTheme(t.id); }
        }, [
          GK.el('img', { src: 'assets/cards/themes/' + t.id + '/back.webp', alt: t.name, draggable: 'false' }),
          GK.el('span', { text: t.name })
        ]);
        thumbs[t.id] = thumb;
        return thumb;
      }))
    ]);
    function sync() {
      var cur = state.settings.cardTheme;
      GK.CARD_THEMES.forEach(function (t) { thumbs[t.id].classList.toggle('sel', t.id === cur); });
    }
    sync();
    GK.on('cardtheme', sync);
    return { el: wrap };
  };

  /* ─────────────────────────── RUBBELFELD ─────────────────────────── */
  /**
   * Ein freirubbelbares Feld. Liegt hier, weil sich beide Rubbellos-Spiele
   * dieselbe Canvas-Mechanik teilen — dreimal dieselben 90 Zeilen wären sonst
   * dreimal dieselbe Fehlerquelle.
   *
   * opts: { onReveal, cls }
   * Rückgabe: { el, arm(html), reveal(), isDone(), reset(html) }
   */
  GK.scratchTile = function (opts) {
    opts = opts || {};
    var under = GK.el('div', { class: 'sym-under' });
    var cv = GK.el('canvas');
    var wrap = GK.el('div', { class: 'stile ' + (opts.cls || '') }, [under, cv]);
    var ctx = cv.getContext('2d');
    var drawing = false, strokes = 0, done = true, lastP = null;

    var BRUSH = 0.27;      // Pinselradius relativ zur Feldbreite
    var REVEAL_AT = 0.32;  // ab hier springt das Feld von selbst auf

    function paintCover() {
      var r = wrap.getBoundingClientRect();
      cv.width = Math.max(60, r.width) * 2;
      cv.height = Math.max(60, r.height) * 2;
      var g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
      g.addColorStop(0, '#c9c9d8');
      g.addColorStop(0.4, '#8d8da5');
      g.addColorStop(0.6, '#e6e6f2');
      g.addColorStop(1, '#7a7a94');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(43,10,77,.55)';
      ctx.font = 'bold ' + Math.round(cv.width * 0.24) + 'px Bungee, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cv.width / 2, cv.height / 2);
      cv.style.display = '';
    }

    function pos(ev) {
      var r = cv.getBoundingClientRect();
      var t = ev.touches ? ev.touches[0] : ev;
      return {
        x: (t.clientX - r.left) * (cv.width / r.width),
        y: (t.clientY - r.top) * (cv.height / r.height)
      };
    }

    function scratch(ev) {
      if (done) return;
      var p = pos(ev);
      var r = cv.width * BRUSH;
      ctx.globalCompositeOperation = 'destination-out';

      // Strich zwischen letztem und aktuellem Punkt ziehen, damit schnelles
      // Wischen keine Lücken lässt (sonst muss man ewig nachrubbeln)
      if (lastP) {
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lastP.x, lastP.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      lastP = p;

      strokes++;
      if (strokes % 4 === 0) GK.sfx('hover');
      if (strokes % 3 === 0) checkReveal();
    }

    function checkReveal() {
      if (!done && progress() > REVEAL_AT) reveal();
    }

    function progress() {
      try {
        var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        var clear = 0, total = 0;
        for (var i = 3; i < d.length; i += 4 * 40) { total++; if (d[i] === 0) clear++; }
        return total ? clear / total : 0;
      } catch (e) { return 1; }
    }

    function reveal() {
      if (done) return;
      done = true;
      cv.style.display = 'none';
      wrap.classList.add('revealed');
      GK.sfx('gem');
      if (opts.onReveal) opts.onReveal();
    }

    function release() {
      drawing = false;
      lastP = null;
      checkReveal();          // auch nach einem kurzen Wisch sofort prüfen
    }

    cv.addEventListener('mousedown', function (e) { drawing = true; lastP = null; scratch(e); });
    cv.addEventListener('mousemove', function (e) { if (drawing) scratch(e); });
    window.addEventListener('mouseup', function () { if (drawing) release(); });
    cv.addEventListener('touchstart', function (e) { drawing = true; lastP = null; scratch(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { if (drawing) scratch(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchend', function () { if (drawing) release(); });

    return {
      el: wrap,
      arm: function (html) {
        under.innerHTML = html;
        wrap.classList.remove('revealed');
        done = false;
        strokes = 0;
        lastP = null;
        paintCover();
      },
      reveal: reveal,
      isDone: function () { return done; },
      reset: function (html) {
        under.innerHTML = html === undefined ? GK.iconHTML('question') : html;
        done = true;
        cv.style.display = 'none';
        wrap.classList.remove('revealed');
      }
    };
  };

  /* ─────────────────────────── GAME REGISTRY ─────────────────────────── */
  GK.games = [];
  GK.registerGame = function (def) { GK.games.push(def); };
  GK.gameById = function (id) {
    for (var i = 0; i < GK.games.length; i++) if (GK.games[i].id === id) return GK.games[i];
    return null;
  };

  /** Spiele mit minLevel sind erst ab dem passenden Level spielbar. */
  GK.isUnlocked = function (game) {
    if (!game || !game.minLevel) return true;
    var p = GK.player();
    return GK.levelOf(p ? p.xp : 0) >= game.minLevel;
  };
  GK.unlockedGames = function () { return GK.games.filter(GK.isUnlocked); };

  /** kleine Helfer für Spiel-Module */
  GK.panel = function (children, cls) { return GK.el('div', { class: 'panel ' + (cls || '') }, children); };
  GK.resultBox = function () { return GK.el('div', { class: 'result', text: 'Setz deine Chips und leg los!' }); };
  GK.setResult = function (box, text, kind) {
    box.className = 'result ' + (kind || '');
    box.textContent = text;
  };

  /** Gewinn feiern — Effekte skalieren mit dem Multiplikator. */
  GK.celebrate = function (netWin, mult) {
    mult = mult || 0;
    if (mult >= 15 || netWin >= 2000) {
      GK.sfx('jackpot');
      GK.confetti(220);
      GK.emojiRain(['👑', '💎', '🤑', '💰', '🔥', '🎉'], 30);
      GK.toast('MEGA JACKPOT! +' + GK.fmt(netWin) + ' Chips!', 'gold', '👑');
    } else if (mult >= 5 || netWin >= 500) {
      GK.sfx('bigwin');
      GK.confetti(130);
      GK.burst(['💰', '🎉', '⭐'], 20);
      GK.toast('Dicker Win! +' + GK.fmt(netWin) + ' Chips', 'win', '🤑');
    } else {
      GK.sfx('win');
      GK.confetti(55);
      GK.toast('Gewonnen! +' + GK.fmt(netWin) + ' Chips', 'win', '🎉');
    }
  };

  GK.initFX = initCanvas;

})(window);
