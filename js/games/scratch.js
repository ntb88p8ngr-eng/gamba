/* ═══════════ 10. RUNEN-RUBBELLOS ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* Gewinntabelle: Wahrscheinlichkeit für 3 Gleiche.
     Die Münze holt nur den Einsatz zurück, sorgt aber dafür, dass deutlich
     öfter etwas auf dem Los steht: 35 % statt vorher 26 % Treffer. */
  var PRIZES = [
    { sym: 'coin',   name: 'Münze',     mult: 1,  p: 0.120 },
    { sym: 'clover', name: 'Kleeblatt', mult: 2,  p: 0.130 },
    { sym: 'flame',  name: 'Flamme',    mult: 3,  p: 0.055 },
    { sym: 'gem',    name: 'Juwel',     mult: 5,  p: 0.030 },
    { sym: 'star',   name: 'Stern',     mult: 10, p: 0.010 },
    { sym: 'crown',  name: 'Krone',     mult: 20, p: 0.0045 }
  ];
  var ALL = PRIZES.map(function (p) { return p.sym; });
  function nameOf(id) {
    for (var i = 0; i < PRIZES.length; i++) if (PRIZES[i].sym === id) return PRIZES[i].name;
    return id;
  }

  /* Zieht die drei Runen. Liegt auf Modulebene, damit sich die Trefferquote
     ohne Browser nachrechnen lässt. */
  function rollSymbols() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < PRIZES.length; i++) {
      acc += GK.luckify(PRIZES[i].p);
      if (r < acc) return [PRIZES[i].sym, PRIZES[i].sym, PRIZES[i].sym];
    }
    // Niete — oft knapp daneben für den Nervenkitzel
    var a = GK.pick(ALL), b = GK.pick(ALL.filter(function (s) { return s !== a; }));
    var set = Math.random() < 0.55 ? [a, a, b] : [a, b, GK.pick(ALL.filter(function (s) { return s !== a && s !== b; })) || b];
    for (var j = set.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = set[j]; set[j] = set[k]; set[k] = t;
    }
    return set;
  }

  GK.registerGame({
    id: 'scratch',
    name: 'Runen-Rubbellos',
    emoji: '🎫',
    icon: 'ticket',
    blurb: 'Freirubbeln mit der Maus. Drei gleiche Runen und die Chips gehören dir.',
    badge: 'BIS 20×',
    color: '#ffd12e',
    rules: [
      'Kaufe ein Los und <b>rubbel die drei Felder frei</b> (Maus gedrückt halten oder wischen).',
      '<b>Drei gleiche Runen</b> zahlen den Multiplikator der Rune aus.',
      'Krone 20× · Stern 10× · Juwel 5× · Flamme 3× · Kleeblatt 2× · Münze 1× (Einsatz zurück)',
      'Alles andere ist eine Niete — aber Rubbeln macht trotzdem Spaß.'
    ],
    mount: function (root, resume) {
      var stopped = false, active = false, stake = 0, symbols = ['question', 'question', 'question'], revealedCount = 0;

      var bet = GK.betPanel({ start: 20 });
      var tiles = [];
      var tileRow = el('div', { class: 'scratch-tiles' });

      for (var i = 0; i < 3; i++) tiles.push(GK.scratchTile({ onReveal: onRevealed }));
      tiles.forEach(function (t) { tileRow.appendChild(t.el); });

      var card = el('div', { class: 'scratch-card' }, [
        el('div', { class: 'scratch-head', text: '✦ GAMBAKING RUNEN-LOS ✦' }),
        tileRow,
        el('div', { class: 'scratch-foot', text: '3 gleiche Runen = Gewinn' })
      ]);

      var payTable = el('div', { class: 'paytable' }, PRIZES.slice().reverse().map(function (p) {
        return el('div', { class: 'pay-item' }, [
          el('span', { class: 's', html: GK.iconHTML(p.sym) }),
          el('span', { class: 'm', text: p.mult + '×' })
        ]);
      }));

      var resultBox = GK.resultBox();
      var buyBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎫 LOS KAUFEN' });
      var revealBtn = el('button', { class: 'btn btn-ghost btn-full', text: '👁 ALLES AUFDECKEN' });
      revealBtn.disabled = true;

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [card, el('div', { style: 'height:12px' }), payTable]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          buyBtn,
          el('div', { style: 'height:8px' }),
          revealBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Halt die Maus gedrückt und wisch über die Felder. Ab rund <b>einem Drittel</b> freigerubbelt springt das Feld von selbst auf.' })
        ])
      ]);
      root.appendChild(stage);

      function buy() {
        if (active || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Rubbellos')) return;

        active = true;
        revealedCount = 0;
        symbols = rollSymbols();
        buyBtn.disabled = true;
        revealBtn.disabled = false;
        bet.disable(true);
        GK.setResult(resultBox, 'Jetzt freirubbeln! 🖐️', '');
        GK.sfx('chip');
        // Layout abwarten, dann Deckschicht malen
        requestAnimationFrame(function () {
          tiles.forEach(function (t, i) { t.arm(GK.iconHTML(symbols[i])); });
        });
        snapshot();
      }

      function onRevealed() {
        revealedCount++;
        snapshot();
        if (revealedCount >= 3) setTimeout(finish, 420);
      }

      function finish() {
        if (stopped || !active) return;
        active = false;
        var win = 0, prize = null;
        if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
          prize = PRIZES.filter(function (p) { return p.sym === symbols[0]; })[0];
          win = Math.floor(stake * (prize ? prize.mult : 0));
        }

        GK.payout(win, { stake: stake });
        GK.logPlay('Runen-Rubbellos', stake, win);

        if (win > stake) {
          GK.setResult(resultBox, '3× ' + nameOf(symbols[0]) + ' — ' + prize.mult + '× → +' + GK.fmt(win - stake), 'win');
          GK.celebrate(win - stake, prize.mult);
        } else if (win > 0) {
          // drei Münzen holen genau den Einsatz zurück — kein Gewinn, kein Verlust
          GK.setResult(resultBox, '3× ' + nameOf(symbols[0]) + ' — Einsatz zurück', 'push');
          GK.sfx('coin');
        } else {
          GK.setResult(resultBox, symbols.map(nameOf).join(' · ') + ' — Niete!', 'lose');
          GK.sfx('lose');
          GK.shake(card);
        }

        buyBtn.disabled = false;
        revealBtn.disabled = true;
        bet.disable(false);
        GK.clearGameState('scratch');
      }

      buyBtn.addEventListener('click', function () { GK.sfx('click'); buy(); });
      revealBtn.addEventListener('click', function () {
        GK.sfx('click');
        tiles.forEach(function (t) { if (!t.isDone()) t.reveal(); });
      });

      /* ── Unterbrochenes Los ──
         Die gezogenen Runen muessen mit, sonst wuerde beim Weiterrubbeln neu
         gewuerfelt — man koennte sich also ein besseres Los erzwingen. */
      function snapshot() {
        if (!active) { GK.clearGameState('scratch'); return; }
        GK.saveGameState('scratch', {
          stake: stake, symbols: symbols,
          done: tiles.map(function (t) { return t.isDone(); })
        });
      }

      function restore(st) {
        if (!st || !st.symbols) return false;
        stake = st.stake; symbols = st.symbols;
        active = true;
        revealedCount = 0;
        bet.set && bet.set(stake);
        buyBtn.disabled = true;
        revealBtn.disabled = false;
        bet.disable(true);
        requestAnimationFrame(function () {
          if (stopped) return;
          tiles.forEach(function (t, i) {
            t.arm(GK.iconHTML(symbols[i]));
            /* Schon freigeriebene Felder direkt aufdecken — das zaehlt ueber
               onRevealed auch den Zaehler wieder hoch. */
            if (st.done && st.done[i]) t.reveal();
          });
        });
        GK.setResult(resultBox, 'Weiter rubbeln — dein Los von vorhin.', '');
        GK.toast('Unterbrochenes Los fortgesetzt · Einsatz ' + GK.fmt(stake), 'gold', '🎫');
        return true;
      }

      tiles.forEach(function (t) { t.reset(); });
      restore(resume);
      return function () { stopped = true; snapshot(); };
    }
  });
})(window.GK);
