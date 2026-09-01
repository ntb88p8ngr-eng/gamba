/* ═══════════ 19. BACCARAT ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var SUITS = [
    { s: '♠', red: false }, { s: '♥', red: true },
    { s: '♦', red: true }, { s: '♣', red: false }
  ];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* Baccarat laeuft klassisch aus dem Achter-Schlitten. */
  function newShoe() {
    var shoe = [];
    for (var d = 0; d < 8; d++)
      SUITS.forEach(function (su) {
        RANKS.forEach(function (r) { shoe.push({ r: r, s: su.s, red: su.red }); });
      });
    for (var i = shoe.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = shoe[i]; shoe[i] = shoe[j]; shoe[j] = t;
    }
    return shoe;
  }

  /* Bild und Zehn zaehlen null, das Ass eins. */
  function pip(c) {
    if (c.r === 'A') return 1;
    if (['10', 'J', 'Q', 'K'].indexOf(c.r) >= 0) return 0;
    return Number(c.r);
  }
  /* Nur die letzte Stelle zaehlt — aus 7 + 8 wird 5, nicht 15. */
  function total(hand) {
    return hand.reduce(function (a, c) { return a + pip(c); }, 0) % 10;
  }

  var MODES = [
    { id: 'player', label: '🔵 PLAYER', mult: 2,    hint: 'Zahlt 1:1. Gewinnt, wenn die Spielerhand naeher an 9 liegt.' },
    /* Ohne die uebliche 5-%-Kommission — im Spielsalon zahlt die Bank hier
       voll aus. Das macht Banker rechnerisch zur besten Wette am Tisch. */
    { id: 'banker', label: '🔴 BANKER', mult: 2,    hint: 'Zahlt 1:1, ohne Kommission — und gewinnt etwas oefter als Player.' },
    { id: 'tie',    label: '🟢 TIE',    mult: 9,    hint: 'Zahlt 8:1, trifft aber selten. Bei Gleichstand kassiert nur diese Wette.' }
  ];

  GK.registerGame({
    id: 'baccarat',
    name: 'Baccarat Royale',
    emoji: '🎴',
    icon: 'baccarat',
    blurb: 'Punto Banco wie im Salon. Setz auf Player, Banker oder Tie — und lass die Karten sprechen.',
    badge: '8:1 TIE',
    color: '#ffd12e',
    rules: [
      'Beide Seiten bekommen zwei Karten. Wer naeher an <b>9</b> liegt, gewinnt.',
      'Nur die <b>letzte Stelle</b> zaehlt: 7 + 8 = 15 → <b>5</b>. Bild und Zehn zaehlen null, das Ass eins.',
      '<b>Player</b> und <b>Banker</b> zahlen beide 1:1, ohne Kommission. <b>Tie</b> zahlt 8:1.',
      'Bei <b>8 oder 9</b> aus den ersten zwei Karten steht die Hand sofort — das ist eine <b>Naturelle</b>.',
      'Ob eine dritte Karte kommt, entscheidet die Tabelle, nicht du. Zurücklehnen und zuschauen.',
      'Bei Gleichstand bekommst du deinen Einsatz auf Player oder Banker <b>zurück</b>.'
    ],
    mount: function (root, resume) {
      var stopped = false;
      var shoe = newShoe();
      var playerHand = [], bankerHand = [], stake = 0, running = false;
      var mode = MODES[0];
      var history = [];

      var bet = GK.betPanel({ start: 25 });
      var themePicker = GK.cardThemePicker();

      var bankerCards = el('div', { class: 'hand' });
      var playerCards = el('div', { class: 'hand' });
      var bankerScore = el('span', { class: 'bj-score', text: '—' });
      var playerScore = el('span', { class: 'bj-score', text: '—' });
      var resultBox = GK.resultBox();
      var histBar = el('div', { class: 'bac-hist' });

      var bankerSide = el('div', { class: 'bj-side' }, [
        el('h4', {}, ['🔴 BANKER', bankerScore]),
        bankerCards
      ]);
      var playerSide = el('div', { class: 'bj-side' }, [
        el('h4', {}, ['🔵 PLAYER', playerScore]),
        playerCards
      ]);
      var felt = el('div', { class: 'bj-felt' }, [bankerSide, playerSide]);

      var modeBtns = [];
      var modePick = el('div', { class: 'mode-pick' }, MODES.map(function (m) {
        var b = el('button', { class: 'rbet' + (m.id === mode.id ? ' sel' : '') }, [
          m.label, el('small', { text: m.mult + '×' })
        ]);
        b.addEventListener('click', function () {
          if (running) return;
          mode = m; syncMode(); GK.sfx('chip');
        });
        modeBtns.push({ m: m, b: b });
        return b;
      }));
      var modeHint = el('p', { class: 'hint', text: mode.hint });

      var dealBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎴 KARTEN GEBEN' });

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [
          felt,
          el('div', { style: 'height:10px' }),
          el('div', { class: 'bet-label', text: 'LETZTE RUNDEN' }),
          el('div', { style: 'height:6px' }),
          histBar
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:14px' }),
          el('div', { class: 'bet-label', text: 'DEINE WETTE' }),
          el('div', { style: 'height:6px' }),
          modePick,
          el('div', { style: 'height:8px' }),
          modeHint,
          el('div', { style: 'height:12px' }),
          themePicker.el,
          el('div', { style: 'height:14px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          dealBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 8 Decks. Die dritte Karte folgt fester Tabelle — <b>Banker</b> gewinnt etwas oefter als Player und zahlt hier trotzdem voll aus.' })
        ])
      ]);
      root.appendChild(stage);

      function syncMode() {
        modeBtns.forEach(function (x) { x.b.classList.toggle('sel', x.m.id === mode.id); });
        modeHint.textContent = mode.hint;
      }

      function drawCard() {
        if (shoe.length < 20) shoe = newShoe();
        return shoe.pop();
      }

      function render(revealed) {
        bankerCards.innerHTML = '';
        bankerHand.forEach(function (c) { bankerCards.appendChild(GK.cardEl(c)); });
        playerCards.innerHTML = '';
        playerHand.forEach(function (c) { playerCards.appendChild(GK.cardEl(c)); });
        playerScore.textContent = playerHand.length ? total(playerHand) : '—';
        bankerScore.textContent = bankerHand.length ? total(bankerHand) : '—';
        if (revealed) {
          playerSide.classList.toggle('win', total(playerHand) > total(bankerHand));
          bankerSide.classList.toggle('win', total(bankerHand) > total(playerHand));
        } else {
          playerSide.classList.remove('win');
          bankerSide.classList.remove('win');
        }
      }

      function pushHistory(who) {
        history.unshift(who);
        if (history.length > 14) history.pop();
        histBar.innerHTML = '';
        history.forEach(function (h) {
          histBar.appendChild(el('div', { class: 'bac-bead ' + h, text: h === 'player' ? 'P' : (h === 'banker' ? 'B' : 'T') }));
        });
      }

      function setRunning(v) {
        running = v;
        dealBtn.disabled = v;
        bet.disable(v);
        modeBtns.forEach(function (x) { x.b.disabled = v; });
      }

      /* Die Ziehregeln von Punto Banco. Der Spieler zieht auf 0–5. Was die
         Bank dann tut, haengt nicht nur an ihrer eigenen Summe, sondern auch
         an der dritten Karte des Spielers — daher die Fallunterscheidung. */
      function bankerDraws(bankerTotal, playerThird) {
        if (playerThird === null) return bankerTotal <= 5;
        var v = pip(playerThird);
        if (bankerTotal <= 2) return true;
        if (bankerTotal === 3) return v !== 8;
        if (bankerTotal === 4) return v >= 2 && v <= 7;
        if (bankerTotal === 5) return v >= 4 && v <= 7;
        if (bankerTotal === 6) return v >= 6 && v <= 7;
        return false;
      }

      /* Reihum aufdecken, damit man dem Blatt beim Entstehen zusehen kann. */
      function runSteps(steps, done) {
        var i = 0;
        (function next() {
          if (stopped) return;
          if (i >= steps.length) { setTimeout(done, 380); return; }
          steps[i++]();
          render(false);
          GK.sfx('card');
          snapshot();
          setTimeout(next, 380);
        })();
      }

      function deal() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Baccarat')) return;

        playerHand = []; bankerHand = [];
        render(false);
        GK.setResult(resultBox, 'Karten laufen…', '');
        setRunning(true);
        GK.sfx('spin');
        snapshot();

        runSteps([
          function () { playerHand.push(drawCard()); },
          function () { bankerHand.push(drawCard()); },
          function () { playerHand.push(drawCard()); },
          function () { bankerHand.push(drawCard()); }
        ], thirdCards);
      }

      function thirdCards() {
        if (stopped) return;
        var pt = total(playerHand), bt = total(bankerHand);

        if (pt >= 8 || bt >= 8) {           // Naturelle, beide Haende stehen
          settle();
          return;
        }

        var steps = [], playerThird = null;
        if (pt <= 5) {
          playerThird = drawCard();
          steps.push(function () { playerHand.push(playerThird); });
        }
        steps.push(function () {
          if (bankerDraws(total(bankerHand), playerThird)) bankerHand.push(drawCard());
        });
        runSteps(steps, settle);
      }

      function settle() {
        if (stopped) return;
        var pt = total(playerHand), bt = total(bankerHand);
        var winner = pt > bt ? 'player' : (bt > pt ? 'banker' : 'tie');
        render(true);

        var win = 0, kind, msg;
        var side = winner === 'player' ? 'Player' : (winner === 'banker' ? 'Banker' : 'Gleichstand');

        if (winner === mode.id) {
          win = Math.floor(stake * mode.mult);
          kind = 'win';
          msg = side + ' ' + Math.max(pt, bt) + ' — gewonnen! +' + GK.fmt(win - stake);
        } else if (winner === 'tie') {
          /* Auf Player oder Banker gesetzt und es steht unentschieden: der
             Einsatz kommt zurueck, nur die Tie-Wette kassiert. */
          win = stake;
          kind = 'push';
          msg = 'Gleichstand bei ' + pt + ' — Einsatz zurück';
        } else {
          win = 0;
          kind = 'lose';
          msg = side + ' gewinnt mit ' + Math.max(pt, bt) + ' gegen ' + Math.min(pt, bt);
        }

        GK.payout(win, { stake: stake });
        GK.logPlay('Baccarat Royale', stake, win);
        GK.setResult(resultBox, msg, kind);
        pushHistory(winner);

        if (kind === 'win') GK.celebrate(win - stake, win / Math.max(1, stake));
        else if (kind === 'lose') { GK.sfx('lose'); GK.shake(felt); }
        else GK.sfx('coin');

        setRunning(false);
        GK.clearGameState('baccarat');
      }

      /* ── Unterbrochene Runde ──
         Hier entscheidet niemand mehr etwas, die Karten laufen von selbst.
         Gesichert werden die schon liegenden Blaetter und der Schlitten; beim
         Wiederaufnehmen laeuft die Runde einfach zu Ende. Ohne Schlitten
         waeren die naechsten Karten neu gewuerfelt. */
      function snapshot() {
        if (!running) { GK.clearGameState('baccarat'); return; }
        GK.saveGameState('baccarat', {
          stake: stake, mode: mode.id, shoe: shoe,
          player: playerHand, banker: bankerHand
        });
      }

      function restore(st) {
        if (!st || !st.player) return false;
        stake = st.stake;
        shoe = st.shoe && st.shoe.length ? st.shoe : shoe;
        playerHand = st.player; bankerHand = st.banker || [];
        for (var i = 0; i < MODES.length; i++) if (MODES[i].id === st.mode) mode = MODES[i];
        bet.set && bet.set(stake);
        syncMode();
        setRunning(true);
        render(false);
        GK.setResult(resultBox, 'Weiter geht’s — die Runde von vorhin.', '');
        GK.toast('Unterbrochene Runde fortgesetzt · Einsatz ' + GK.fmt(stake), 'gold', '🎴');

        /* Erst die ersten zwei Blaetter je Seite auffuellen, dann laeuft der
           normale Ablauf weiter. */
        var fehlen = [];
        while (playerHand.length + fehlen.filter(function (f) { return f === 'p'; }).length < 2) fehlen.push('p');
        while (bankerHand.length + fehlen.filter(function (f) { return f === 'b'; }).length < 2) fehlen.push('b');
        var steps = fehlen.map(function (w) {
          return function () { (w === 'p' ? playerHand : bankerHand).push(drawCard()); };
        });
        setTimeout(function () {
          if (stopped) return;
          if (steps.length) runSteps(steps, thirdCards);
          else if (playerHand.length === 2 && bankerHand.length === 2) thirdCards();
          else settle();
        }, 700);
        return true;
      }

      dealBtn.addEventListener('click', function () { GK.sfx('click'); deal(); });

      syncMode();
      render(false);
      restore(resume);
      GK.onWhile('cardtheme', playerCards, function () { render(false); });
      return function () { stopped = true; snapshot(); };
    }
  });
})(window.GK);
