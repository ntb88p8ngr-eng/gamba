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
  var BAILOUT = 50; // Mitleids-Chips wenn komplett pleite

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
  var defaultState = function () {
    return {
      currentId: null,
      players: {},
      feed: [],
      settings: { sound: true, adminPin: '1337', chaos: true },
      admin: false
    };
  };

  var state = GK.state = defaultState();

  GK.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state = GK.state = Object.assign(defaultState(), parsed);
        state.settings = Object.assign(defaultState().settings, parsed.settings || {});
        state.admin = false; // Admin-Modus nie persistent
      }
    } catch (e) { /* korrupte Daten -> frischer Start */ }
    return state;
  };

  GK.save = function () {
    try {
      var copy = Object.assign({}, state);
      delete copy.admin;
      localStorage.setItem(KEY, JSON.stringify(copy));
    } catch (e) { /* z.B. privater Modus */ }
  };

  GK.wipe = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = GK.state = defaultState();
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
      peak: START_BALANCE,
      luck: 50,         // 0-100, nur der Admin dreht daran
      lastBonus: 0,
      created: Date.now()
    };
    state.players[p.id] = p;
    state.currentId = p.id;
    GK.save();
    return p;
  };

  GK.player = function () { return state.players[state.currentId] || null; };
  GK.playerList = function () {
    return Object.keys(state.players).map(function (k) { return state.players[k]; });
  };
  GK.switchPlayer = function (id) {
    if (!state.players[id]) return;
    state.currentId = id;
    GK.save();
    GK.updateHUD();
    GK.emit('player-changed');
  };
  GK.deletePlayer = function (id) {
    delete state.players[id];
    if (state.currentId === id) {
      var rest = GK.playerList();
      state.currentId = rest.length ? rest[0].id : null;
    }
    GK.save();
    GK.emit('player-changed');
  };

  /* profit = alles was der Spieler selbst erspielt hat (ohne Admin-Geschenke) */
  GK.profitOf = function (p) { return p.balance - START_BALANCE - (p.granted || 0); };
  GK.rtpOf = function (p) { return p.wagered > 0 ? (p.returned / p.wagered) * 100 : 0; };

  /* ─────────────────────────── EVENTS ─────────────────────────── */
  var listeners = {};
  GK.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  GK.emit = function (ev, data) { (listeners[ev] || []).forEach(function (f) { f(data); }); };

  /* ─────────────────────────── MONEY ─────────────────────────── */
  GK.canBet = function (amount) {
    var p = GK.player();
    if (!p) return false;
    return amount >= 1 && amount <= p.balance;
  };

  /** Einsatz abziehen. Gibt false zurück wenn es nicht reicht. */
  GK.wager = function (amount, game) {
    var p = GK.player();
    amount = Math.floor(amount);
    if (!p || amount < 1) return false;
    if (amount > p.balance) {
      GK.toast('Nicht genug Chips! 😅', 'bad', '🪙');
      GK.sfx('error');
      return false;
    }
    p.balance -= amount;
    p.wagered += amount;
    p.plays++;
    GK.save();
    GK.updateHUD(-amount);
    return true;
  };

  /** Auszahlung gutschreiben (0 = verloren). */
  GK.payout = function (amount, meta) {
    var p = GK.player();
    amount = Math.floor(amount);
    if (!p) return;
    if (amount > 0) {
      p.balance += amount;
      p.returned += amount;
      p.peak = Math.max(p.peak, p.balance);
      var net = amount - ((meta && meta.stake) || 0);
      if (net > p.biggestWin) p.biggestWin = net;
      p.wins++;
    } else {
      p.losses++;
    }
    GK.save();
    GK.updateHUD(amount > 0 ? amount : 0);
    GK.checkBroke();
  };

  /** Wer wirklich alles verloren hat, bekommt Mitleids-Chips. */
  GK.checkBroke = function () {
    var p = GK.player();
    if (!p || p.balance >= 1) return;
    p.balance = BAILOUT;
    p.granted = (p.granted || 0) + BAILOUT;
    GK.save();
    GK.updateHUD(BAILOUT);
    GK.toast('Komplett pleite! Die Krone leiht dir ' + BAILOUT + ' Chips 👑', 'gold', '🆘');
    GK.logFeed(p.name + ' war pleite und bekam ' + BAILOUT + ' Mitleids-Chips', 'admin');
    GK.sfx('coin');
  };

  /** Admin: Chips schenken/abziehen. */
  GK.grant = function (playerId, amount, silent) {
    var p = state.players[playerId];
    if (!p) return;
    amount = Math.floor(amount);
    p.balance = Math.max(0, p.balance + amount);
    p.granted = (p.granted || 0) + amount;
    p.peak = Math.max(p.peak, p.balance);
    GK.save();
    GK.updateHUD(amount);
    if (!silent) {
      GK.logFeed('👑 ADMIN: ' + p.name + ' ' + (amount >= 0 ? 'bekommt ' : 'verliert ') + GK.fmt(Math.abs(amount)) + ' Chips', 'admin');
      GK.toast(p.name + ': ' + GK.fmtSigned(amount) + ' Chips', amount >= 0 ? 'gold' : 'bad', amount >= 0 ? '💸' : '✂️');
      GK.sfx(amount >= 0 ? 'cash' : 'error');
      if (amount >= 0) GK.emojiRain(['💸', '🪙', '💰'], 18);
    }
    GK.emit('player-changed');
  };

  /* ─────────────────────────── LUCK (Admin-Cheat) ─────────────────────────── */
  /** Biegt eine Wahrscheinlichkeit anhand des Luck-Werts (50 = neutral). */
  GK.luckify = function (p) {
    var pl = GK.player();
    if (!pl) return p;
    var l = (pl.luck === undefined ? 50 : pl.luck);
    var bias = (l - 50) / 50; // -1 .. +1
    if (bias === 0) return p;
    if (bias > 0) return p + (1 - p) * bias * 0.6;
    return p * (1 + bias * 0.6);
  };
  GK.luckRoll = function (prob) { return Math.random() < GK.luckify(prob); };

  /* ─────────────────────────── FEED ─────────────────────────── */
  GK.logFeed = function (text, type) {
    state.feed.unshift({ t: Date.now(), text: text, type: type || '' });
    if (state.feed.length > 40) state.feed.length = 40;
    GK.save();
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
    GK.logFeed(txt, net > 0 ? 'win' : (net < 0 ? 'lose' : ''));
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
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
        this.ready = true;
      } catch (e) { this.ready = false; }
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
    whoosh:  function () { Sound.noise({ dur: 0.3, freq: 1500, filter: 'bandpass', vol: 0.16 }); }
  };

  GK.sfx = function (name) {
    Sound.init();
    Sound.resume();
    if (SFX[name]) { try { SFX[name](); } catch (e) {} }
  };

  GK.toggleSound = function () {
    state.settings.sound = !state.settings.sound;
    GK.save();
    if (state.settings.sound) GK.sfx('coin');
    return state.settings.sound;
  };

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
      bal.textContent = p ? GK.fmt(p.balance) : '0';
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
    if (opts.emoji) content.appendChild(GK.el('span', { class: 'modal-emoji', text: opts.emoji }));
    if (opts.title) content.appendChild(GK.el('h3', { text: opts.title }));
    if (opts.text) content.appendChild(GK.el('p', { html: opts.text }));
    (opts.nodes || []).forEach(function (n) { content.appendChild(n); });
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
      var p = GK.player();
      var cap = opts.max || Infinity;
      return Math.max(min, Math.min(cap, p ? p.balance : min));
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

    function qb(label, fn, title) {
      return GK.el('button', {
        class: 'chip-btn', type: 'button', title: title || '',
        onClick: function () { fn(); }
      }, [label]);
    }

    var quick = GK.el('div', { class: 'bet-quick' }, [
      qb('½', function () { setVal(Math.floor(Number(input.value) / 2)); }, 'Halbieren'),
      qb('2×', function () { setVal(Number(input.value) * 2); }, 'Verdoppeln'),
      qb('+10', function () { setVal(Number(input.value) + 10); }),
      qb('+50', function () { setVal(Number(input.value) + 50); }),
      qb('+100', function () { setVal(Number(input.value) + 100); }),
      qb('MIN', function () { setVal(min); }),
      qb('ALL IN 🔥', function () { setVal(maxFn()); }, 'Alles setzen')
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

  /* ─────────────────────────── GAME REGISTRY ─────────────────────────── */
  GK.games = [];
  GK.registerGame = function (def) { GK.games.push(def); };
  GK.gameById = function (id) {
    for (var i = 0; i < GK.games.length; i++) if (GK.games[i].id === id) return GK.games[i];
    return null;
  };

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
