/* ═══════════ 14. KÖNIGS-POKER — Texas Hold'em gegen drei KI-Gegner (ab Level 10) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var SUITS = [
    { s: '♠', red: false }, { s: '♥', red: true },
    { s: '♦', red: true }, { s: '♣', red: false }
  ];
  var RANKS = [
    ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8],
    ['9', 9], ['10', 10], ['J', 11], ['Q', 12], ['K', 13], ['A', 14]
  ];

  var CATS = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße',
              'Flush', 'Full House', 'Vierling', 'Straight Flush'];

  function newDeck() {
    var d = [];
    SUITS.forEach(function (su) {
      RANKS.forEach(function (r) { d.push({ r: r[0], v: r[1], s: su.s, red: su.red }); });
    });
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  /* ─────────────── Handbewertung ───────────────
     score5 gibt eine einzige Zahl zurück: Kategorie mal eine Million plus die
     Beikarten. Damit lassen sich zwei Hände einfach vergleichen. */

  function score5(cards) {
    var vs = [], suits = {}, cnt = {};
    cards.forEach(function (c) {
      vs.push(c.v);
      suits[c.s] = (suits[c.s] || 0) + 1;
      cnt[c.v] = (cnt[c.v] || 0) + 1;
    });
    var flush = Object.keys(suits).length === 1;

    // erst nach Häufigkeit sortieren, bei Gleichstand nach Höhe
    var groups = Object.keys(cnt).map(Number).sort(function (a, b) {
      return cnt[b] - cnt[a] || b - a;
    });

    var uniq = groups.slice().sort(function (a, b) { return b - a; });
    var straight = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straight = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straight = 5;   // A-2-3-4-5
    }

    var pattern = groups.map(function (g) { return cnt[g]; }).join('');
    var cat;
    if (straight && flush) cat = 8;
    else if (pattern === '41') cat = 7;
    else if (pattern === '32') cat = 6;
    else if (flush) cat = 5;
    else if (straight) cat = 4;
    else if (pattern === '311') cat = 3;
    else if (pattern === '221') cat = 2;
    else if (pattern === '2111') cat = 1;
    else cat = 0;

    var order = (cat === 4 || cat === 8) ? [straight] : groups;
    var packed = 0, i;
    for (i = 0; i < 5; i++) packed = packed * 15 + (order[i] || 0);
    return cat * 1000000 + packed;
  }

  /** Beste Fünf aus beliebig vielen Karten (hier fünf bis sieben). */
  function bestHand(cards) {
    var best = -1, bestFive = null;
    var n = cards.length, idx = [0, 1, 2, 3, 4];
    if (n < 5) return { score: -1, cat: -1, five: [], name: '—' };
    while (true) {
      var five = idx.map(function (i) { return cards[i]; });
      var sc = score5(five);
      if (sc > best) { best = sc; bestFive = five; }
      // nächste Kombination durchzählen
      var k = 4;
      while (k >= 0 && idx[k] === n - 5 + k) k--;
      if (k < 0) break;
      idx[k]++;
      for (var j = k + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
    }
    var cat = Math.floor(best / 1000000);
    var name = CATS[cat];
    if (cat === 8 && best % 1000000 >= 14 * 15 * 15 * 15 * 15) name = 'Royal Flush';
    return { score: best, cat: cat, five: bestFive, name: name };
  }

  /* ─────────────── Wie gut ist die Hand? ───────────────
     Ergibt 0..1 und steuert damit die KI. Vor dem Flop zählen Höhe, Paar,
     gleiche Farbe und Abstand — danach die tatsächliche Hand plus Draws. */

  function preflopStrength(a, b) {
    var hi = Math.max(a.v, b.v), lo = Math.min(a.v, b.v);
    if (a.v === b.v) return GK.clamp(0.5 + (a.v - 2) / 12 * 0.5, 0, 1);
    var s = (hi - 2) / 12 * 0.42 + (lo - 2) / 12 * 0.18;
    if (a.s === b.s) s += 0.09;
    var gap = hi - lo - 1;
    if (gap === 0) s += 0.07;
    else if (gap === 1) s += 0.04;
    else s -= gap * 0.02;
    return GK.clamp(s, 0.02, 0.99);
  }

  /** Zuschlag für Flush- und Straßen-Draws, solange noch Karten kommen. */
  function drawBonus(all) {
    var suits = {}, vals = {}, bonus = 0;
    all.forEach(function (c) { suits[c.s] = (suits[c.s] || 0) + 1; vals[c.v] = 1; });
    Object.keys(suits).forEach(function (k) { if (suits[k] === 4) bonus += 0.14; });
    var u = Object.keys(vals).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i + 3 < u.length; i++) {
      if (u[i + 3] - u[i] === 3) { bonus += 0.10; break; }        // beidseitig offen
      if (u[i + 3] - u[i] === 4) { bonus += 0.05; break; }        // Bauchschuss
    }
    return Math.min(0.2, bonus);
  }

  function strengthOf(hole, board) {
    if (!board.length) return preflopStrength(hole[0], hole[1]);
    var all = hole.concat(board);
    var ev = bestHand(all);
    var base = [0.12, 0.30, 0.52, 0.68, 0.80, 0.86, 0.93, 0.98, 1][ev.cat];
    var s = base + (ev.score % 1000000) / 759375 * 0.06;
    if (board.length < 5) s += drawBonus(all);
    return Math.min(1, s);
  }

  /* ─────────────── Die drei Gegner ───────────────
     call  = ab welcher Handstärke mitgegangen wird
     raise = ab wann erhöht wird
     bluff = wie oft ohne alles erhöht wird */
  var BOTS = [
    { name: 'Baron von Bluff', icon: 'flame',  color: '#ff2fd0', call: 0.40, raise: 0.70, bluff: 0.15,
      says: ['Ich rieche Angst.', 'Das war zu leicht.', 'Chips sind nur Konfetti.'] },
    { name: 'Gräfin Eiskalt',  icon: 'gem',    color: '#00e5ff', call: 0.58, raise: 0.82, bluff: 0.03,
      says: ['Geduld ist eine Waffe.', 'Ich warte auf Besseres.', 'Wie erwartet.'] },
    { name: 'Onkel Kalle',     icon: 'clover', color: '#7cff3b', call: 0.28, raise: 0.90, bluff: 0.07,
      says: ['Ach komm, ich schau mal.', 'Einmal ist keinmal!', 'Hab ich doch gesagt.'] }
  ];

  var MAX_RAISES = 2;      // höchstens zwei Erhöhungen pro Runde
  var RAKE = 0.08;         // Anteil des Pots fürs Haus — nur wenn ein Flop kam

  /**
   * Entscheidung eines Gegners: Handstärke gegen Pot-Odds und Charakter.
   * ctx = { board, need, pot, street, raises, soft }
   * soft ist der Admin-Luck-Zuschlag: je höher, desto öfter steigen sie aus.
   */
  function botDecide(bot, cards, ctx) {
    var s = strengthOf(cards, ctx.board);
    if (ctx.need > 0 && ctx.soft > 0 && Math.random() < ctx.soft) return 'fold';

    var odds = ctx.need > 0 ? ctx.need / (ctx.pot + ctx.need) : 0;
    var needed = bot.call + odds * 0.6 - ctx.street * 0.02;
    var bluffing = Math.random() < bot.bluff;

    if (ctx.raises < MAX_RAISES && (s >= bot.raise || (bluffing && s > 0.25))) return 'raise';
    if (ctx.need === 0) return 'check';
    return s >= needed ? 'call' : 'fold';
  }

  GK.registerGame({
    id: 'poker',
    name: 'Königs-Poker',
    emoji: '♠️',
    icon: 'poker',
    blurb: "Texas Hold'em gegen drei sture KI-Gegner. Bluffen erlaubt, Zittern inklusive.",
    badge: 'HOLD\'EM',
    color: '#00e5ff',
    minLevel: 10,
    rules: [
      "Texas Hold'em: zwei eigene Karten, fünf offene in der Mitte — die beste <b>Fünf aus sieben</b> gewinnt.",
      'Dein Einsatz ist der <b>Grundeinsatz</b> (Big Blind). Der Geber wechselt jede Hand.',
      'Vier Runden: <b>Preflop, Flop, Turn, River</b>. Erhöhungen kosten vor dem Turn 1×, danach 2× den Grundeinsatz.',
      'Pro Runde sind <b>höchstens zwei Erhöhungen</b> erlaubt — teurer als 13× dein Grundeinsatz kann eine Hand nicht werden.',
      'Vom gewonnenen Pot behält das Haus <b>8 % Rake</b> — aber nur, wenn es überhaupt zum Flop kam.',
      'Passen kostet nichts außer dem, was schon im Pot liegt. <b>Wer gut passt, gewinnt.</b>'
    ],
    mount: function (root) {
      var stopped = false;
      var timers = [];
      function wait(ms, fn) {
        var t = setTimeout(function () {
          if (stopped) return;
          fn();
        }, ms);
        timers.push(t);
        return t;
      }

      var deck = [], board = [], pot = 0, stake = 0, street = 0;
      var button = Math.floor(Math.random() * 4);
      var running = false, showdown = false;
      var toCall = 0, raises = 0, onHumanAction = null;

      /* Sitz 0 bist du, danach im Uhrzeigersinn die drei Gegner. */
      var seats = [{ me: true, name: 'DU', icon: 'crown', color: '#ffd12e' }].concat(
        BOTS.map(function (b) {
          return { me: false, name: b.name, icon: b.icon, color: b.color, bot: b };
        })
      );
      seats.forEach(function (p, i) {
        p.idx = i; p.cards = []; p.bet = 0; p.total = 0;
        p.folded = false; p.acted = false; p.tag = ''; p.win = false;
      });

      /* ── Aufbau ── */
      var bet = GK.betPanel({ start: 20, min: 2, label: 'GRUNDEINSATZ (BIG BLIND)' });
      var themePicker = GK.cardThemePicker();
      var potEl = el('div', { class: 'pk-pot' }, [
        el('span', { class: 'pk-pot-label', text: 'POT' }),
        el('span', { class: 'pk-pot-val', text: '0' })
      ]);
      var boardEl = el('div', { class: 'pk-board-cards' });
      var commentary = el('div', { class: 'commentary', text: '„Setz dich, der Tisch wartet."' });

      function seatEl(p) {
        p.cardsEl = el('div', { class: 'pk-cards' });
        p.tagEl = el('span', { class: 'pk-tag' });
        p.betEl = el('span', { class: 'pk-in', text: '' });
        p.el = el('div', { class: 'pk-seat' + (p.me ? ' me' : ''), style: '--sc:' + p.color }, [
          el('div', { class: 'pk-head' }, [
            el('span', { class: 'pk-ava', html: GK.iconHTML(p.icon) }),
            el('span', { class: 'pk-name', text: p.name }),
            p.tagEl
          ]),
          p.cardsEl,
          el('div', { class: 'pk-foot' }, [p.betEl, el('span', { class: 'pk-dealer', text: 'D' })])
        ]);
        p.dealerEl = p.el.querySelector('.pk-dealer');
        return p.el;
      }

      var botRow = el('div', { class: 'pk-bots' }, seats.slice(1).map(seatEl));
      var table = el('div', { class: 'poker-table' }, [
        botRow,
        el('div', { class: 'pk-middle' }, [potEl, boardEl]),
        el('div', { class: 'pk-mine' }, [seatEl(seats[0])])
      ]);

      var resultBox = GK.resultBox();
      var foldBtn = el('button', { class: 'btn btn-ghost', text: '🏳️ PASSEN' });
      var callBtn = el('button', { class: 'btn btn-lime', text: '✔️ CHECK' });
      var raiseBtn = el('button', { class: 'btn', text: '🔥 ERHÖHEN' });
      var actions = el('div', { class: 'bj-actions' }, [foldBtn, callBtn, raiseBtn]);
      var dealBtn = el('button', { class: 'btn btn-gold btn-full', text: '♠️ NEUE HAND' });
      var handInfo = el('div', { class: 'pk-handinfo', text: '' });

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([table, el('div', { style: 'height:10px' }), commentary]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          themePicker.el,
          el('div', { style: 'height:12px' }),
          handInfo,
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          dealBtn,
          el('div', { style: 'height:10px' }),
          actions,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Der Geber (<b>D</b>) rückt jede Hand weiter. Das Haus nimmt <b>8 % Rake</b> — aber nur, wenn ein Flop fällt.' })
        ])
      ]);
      root.appendChild(stage);

      /* ── Darstellung ── */

      function cardEl(c, hidden, mini) {
        return GK.cardEl(c, hidden, mini ? 'mini' : '');
      }

      function render() {
        potEl.querySelector('.pk-pot-val').textContent = GK.fmt(pot);

        // Karten nur neu bauen, wenn sich wirklich etwas geändert hat —
        // sonst läuft bei jedem Klick die Austeil-Animation neu
        var key = board.length + (showdown ? 'x' : '');
        if (boardEl._key !== key) {
          boardEl._key = key;
          boardEl.innerHTML = '';
          for (var i = 0; i < 5; i++) {
            boardEl.appendChild(board[i] ? cardEl(board[i]) : el('div', { class: 'card slot' }));
          }
        }

        seats.forEach(function (p) {
          var open = p.me || showdown;
          var k = p.cards.length + (open ? 'o' : '') + (p.folded ? 'f' : '');
          if (p.cardsEl._key !== k) {
            p.cardsEl._key = k;
            p.cardsEl.innerHTML = '';
            p.cards.forEach(function (c) { p.cardsEl.appendChild(cardEl(c, !open, !p.me)); });
          }
          p.tagEl.textContent = p.tag;
          p.tagEl.className = 'pk-tag' + (p.folded ? ' out' : '') + (p.win ? ' won' : '');
          p.betEl.textContent = p.total ? 'im Pot: ' + GK.fmt(p.total) : '';
          p.el.classList.toggle('folded', p.folded);
          p.el.classList.toggle('turn', p.turn === true);
          p.el.classList.toggle('winner', p.win);
          p.dealerEl.hidden = p.idx !== button;
        });

        if (running && seats[0].cards.length && board.length) {
          var ev = bestHand(seats[0].cards.concat(board));
          handInfo.textContent = 'Deine Hand: ' + ev.name;
        } else if (running) {
          handInfo.textContent = 'Deine Hand: ' + seats[0].cards.map(function (c) { return c.r + c.s; }).join(' ');
        } else {
          handInfo.textContent = '';
        }
      }

      function say(text) { commentary.textContent = '„' + text + '"'; }

      function setActions(on) {
        var me = seats[0];
        foldBtn.disabled = !on;
        callBtn.disabled = !on;
        raiseBtn.disabled = !on;
        if (!on) {
          // Beschriftung zurücksetzen, sonst stehen dort noch die Beträge
          // der letzten Entscheidung
          callBtn.textContent = '✔️ CHECK / MITGEHEN';
          raiseBtn.textContent = '🔥 ERHÖHEN';
          return;
        }
        var need = toCall - me.bet;
        var step = stake * (street >= 2 ? 2 : 1);
        callBtn.textContent = need > 0 ? '📞 MITGEHEN (' + GK.fmt(need) + ')' : '✔️ CHECK';
        raiseBtn.textContent = '🔥 ERHÖHEN (' + GK.fmt(need + step) + ')';
        if (need > 0 && !GK.canBet(need)) {
          callBtn.disabled = true;
          raiseBtn.disabled = true;
          say('Dir fehlen die Chips zum Mitgehen — du kannst nur passen.');
        } else if (raises >= MAX_RAISES || !GK.canBet(need + step)) {
          raiseBtn.disabled = true;
        }
      }

      /* ── Chips in den Pot ── */

      function put(p, amount) {
        amount = Math.floor(amount);
        if (amount <= 0) return true;
        if (p.me && !GK.wager(amount, 'Königs-Poker')) return false;
        p.bet += amount;
        p.total += amount;
        pot += amount;
        GK.sfx('chip');
        return true;
      }

      function alive() { return seats.filter(function (p) { return !p.folded; }); }

      /* ── Eine Setzrunde ──
         Gehandelt wird reihum, bis alle entweder gepasst haben oder denselben
         Betrag im Pot liegen haben. Wer erhöht, schickt alle anderen noch mal
         an den Zug. */

      function bettingRound(firstIdx, done) {
        raises = 0;
        seats.forEach(function (p) { p.acted = false; });
        var idx = firstIdx;

        function needsAction(p) { return !p.folded && (!p.acted || p.bet < toCall); }

        function next() {
          if (stopped) return;
          seats.forEach(function (p) { p.turn = false; });
          if (alive().length < 2) { render(); return done(); }

          var p = null;
          for (var i = 0; i < 4; i++) {
            var q = seats[(idx + i) % 4];
            if (needsAction(q)) { p = q; idx = q.idx; break; }
          }
          if (!p) { render(); return done(); }

          p.turn = true;
          render();
          if (p.me) {
            setActions(true);
            onHumanAction = function (a) {
              onHumanAction = null;
              setActions(false);
              apply(p, a);
            };
          } else {
            wait(GK.rndInt(650, 1150), function () { apply(p, botMove(p)); });
          }
        }

        function apply(p, action) {
          var need = toCall - p.bet;
          var step = stake * (street >= 2 ? 2 : 1);
          // Erhöhen geht nicht mehr? Dann wird daraus ein Mitgehen.
          if (action === 'raise' && raises >= MAX_RAISES) action = 'call';

          if (action === 'raise') {
            if (put(p, need + step)) {
              toCall += step;
              raises++;
              p.tag = need > 0 ? 'ERHÖHT' : 'SETZT';
              say(p.name + (p.me ? ' erhöhst' : ' erhöht') + ' auf ' + GK.fmt(toCall) + '.');
              seats.forEach(function (q) { if (q !== p && !q.folded) q.acted = false; });
            } else {
              action = 'fold';        // Chips reichen doch nicht
            }
          } else if (action === 'call' || action === 'check') {
            if (need > 0) {
              if (put(p, need)) {
                p.tag = 'GEHT MIT';
                say(p.name + (p.me ? ' gehst' : ' geht') + ' mit ' + GK.fmt(need) + ' mit.');
              } else {
                action = 'fold';
              }
            } else {
              p.tag = 'CHECK';
              say(p.name + ' schiebt.');
            }
          }

          if (action === 'fold') {
            p.folded = true;
            p.tag = 'PASSE';
            say(p.name + ' passt.');
            GK.sfx('card');
          }

          p.acted = true;
          p.turn = false;
          idx = (p.idx + 1) % 4;
          render();
          wait(420, next);
        }

        next();
      }

      function botMove(p) {
        return botDecide(p.bot, p.cards, {
          board: board, need: toCall - p.bet, pot: pot, street: street, raises: raises,
          // Admin-Luck macht den Tisch weich: die Gegner steigen öfter aus
          soft: GK.luckify(0.5) - 0.5
        });
      }

      /* ── Ablauf einer Hand ── */

      function newHand() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.canBet(stake)) {
          GK.toast('Für diesen Grundeinsatz reichen die Chips nicht', 'bad', '🪙');
          GK.sfx('error');
          return;
        }

        deck = newDeck();
        board = [];
        pot = 0; street = 0; toCall = 0; showdown = false;
        button = (button + 1) % 4;
        seats.forEach(function (p) {
          p.cards = []; p.bet = 0; p.total = 0;
          p.folded = false; p.acted = false; p.tag = ''; p.win = false; p.turn = false;
        });

        running = true;
        dealBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, 'Karten laufen…', '');
        boardEl._key = null;
        render();

        // Blinds setzen
        var sb = seats[(button + 1) % 4], bb = seats[(button + 2) % 4];
        var small = Math.ceil(stake / 2);
        if (!put(sb, small)) return abort();
        if (!put(bb, stake)) return abort();
        sb.tag = 'SMALL BLIND';
        bb.tag = 'BIG BLIND';
        toCall = stake;
        say('Blinds stehen — ' + GK.fmt(small) + ' und ' + GK.fmt(stake) + '.');

        // je zwei Karten austeilen
        var order = [];
        for (var k = 0; k < 8; k++) order.push(seats[(button + 1 + k) % 4]);
        order.forEach(function (p, i) {
          wait(140 * i, function () {
            p.cards.push(deck.pop());
            GK.sfx('card');
            render();
            if (i === 7) wait(400, function () { bettingRound((button + 3) % 4, afterPreflop); });
          });
        });
      }

      function abort() {
        running = false;
        dealBtn.disabled = false;
        bet.disable(false);
        if (seats[0].total > 0) {
          GK.payout(0, { stake: seats[0].total });
          GK.logPlay('Königs-Poker', seats[0].total, 0);
        }
        GK.setResult(resultBox, 'Hand abgebrochen — zu wenig Chips', 'lose');
      }

      /** Zwischen den Runden: neue Karten aufdecken und weiter setzen. */
      function street2(count, label, nextFn) {
        street++;
        seats.forEach(function (p) { p.bet = 0; if (!p.folded) p.tag = ''; });
        toCall = 0;
        if (alive().length < 2) return settle();

        for (var i = 0; i < count; i++) {
          (function (i) {
            wait(260 * i, function () {
              board.push(deck.pop());
              GK.sfx('card');
              render();
            });
          })(i);
        }
        wait(260 * count + 260, function () {
          say(label);
          bettingRound((button + 1) % 4, nextFn);
        });
      }

      function afterPreflop() {
        if (alive().length < 2) return settle();
        street2(3, 'Der Flop liegt.', afterFlop);
      }
      function afterFlop() {
        if (alive().length < 2) return settle();
        street2(1, 'Turn.', afterTurn);
      }
      function afterTurn() {
        if (alive().length < 2) return settle();
        street2(1, 'River — letzte Runde.', settle);
      }

      /* ── Abrechnung ── */

      function settle() {
        if (stopped) return;
        var me = seats[0];
        var left = alive();
        var winners;

        if (left.length === 1) {
          winners = left;
        } else {
          showdown = true;
          left.forEach(function (p) { p.ev = bestHand(p.cards.concat(board)); });
          var top = Math.max.apply(null, left.map(function (p) { return p.ev.score; }));
          winners = left.filter(function (p) { return p.ev.score === top; });
        }
        winners.forEach(function (p) { p.win = true; p.tag = 'GEWINNT'; });
        seats.forEach(function (p) { p.turn = false; });

        // „No flop, no drop" — ohne Flop nimmt das Haus nichts
        var rake = board.length >= 3 ? Math.floor(pot * RAKE) : 0;
        var share = Math.floor((pot - rake) / winners.length);

        var iWon = winners.indexOf(me) >= 0;
        var win = iWon ? share : 0;
        // Wer vor dem Blind gepasst hat, hat nichts riskiert — das ist keine
        // gespielte Runde und gehört weder in die Statistik noch in den Feed.
        if (me.total > 0) {
          GK.payout(win, { stake: me.total });
          GK.logPlay('Königs-Poker', me.total, win);
        }

        render();

        var net = win - me.total;
        var msg;
        if (iWon) {
          var how = left.length === 1 ? 'Alle passen' : me.ev.name;
          msg = how + ' — Pot ' + GK.fmt(share) + (net >= 0 ? ' (+' : ' (') + GK.fmt(net) + ')';
          GK.setResult(resultBox, msg, net > 0 ? 'win' : 'push');
          if (net > 0) GK.celebrate(net, me.total ? win / me.total : 1);
          else GK.sfx('coin');
        } else {
          var w = winners[0];
          msg = w.name + ' gewinnt' + (showdown ? ' mit ' + w.ev.name : ' — alle anderen passen') +
                ' (' + GK.fmt(me.total) + ' verloren)';
          GK.setResult(resultBox, msg, 'lose');
          GK.sfx('lose');
          GK.shake(table);
          if (!w.me && w.bot) say(GK.pick(w.bot.says));
        }
        if (showdown && iWon) say('Du zeigst ' + me.ev.name + ' — der Pot gehört dir.');

        running = false;
        setActions(false);
        dealBtn.disabled = false;
        bet.disable(false);
      }

      /* ── Bedienung ── */
      foldBtn.addEventListener('click', function () {
        if (onHumanAction) { GK.sfx('click'); onHumanAction('fold'); }
      });
      callBtn.addEventListener('click', function () {
        if (onHumanAction) { GK.sfx('click'); onHumanAction('call'); }
      });
      raiseBtn.addEventListener('click', function () {
        if (onHumanAction) { GK.sfx('click'); onHumanAction('raise'); }
      });
      dealBtn.addEventListener('click', function () { GK.sfx('click'); newHand(); });

      setActions(false);
      render();
      GK.on('cardtheme', function () { if (boardEl.isConnected) render(); });

      return function () {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    }
  });
})(window.GK);
