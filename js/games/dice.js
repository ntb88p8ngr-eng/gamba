/* ═══════════ 5. WÜRFELDUELL ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function makeDie(gold) {
    var d = el('div', { class: 'die' + (gold ? ' gold' : '') });
    for (var i = 0; i < 9; i++) d.appendChild(el('div', { class: 'pip off' }));
    return d;
  }
  function setDie(d, v) {
    var pips = d.children, on = PIPS[v] || [];
    for (var i = 0; i < 9; i++) pips[i].className = 'pip' + (on.indexOf(i) >= 0 ? '' : ' off');
  }

  var MODES = [
    { id: 'duel', label: '⚔️ Duell', mult: 1.8, hint: 'Deine Summe muss die des Dealers schlagen. Gleichstand = Einsatz zurück.' },
    { id: 'over', label: '⬆️ Über 7', mult: 2.15, hint: 'Deine beiden Würfel zusammen müssen mehr als 7 ergeben.' },
    { id: 'under', label: '⬇️ Unter 7', mult: 2.15, hint: 'Deine beiden Würfel zusammen müssen weniger als 7 ergeben.' },
    { id: 'seven', label: '🎯 Exakt 7', mult: 5.1, hint: 'Genau 7 — der riskante Held-Move.' }
  ];

  GK.registerGame({
    id: 'dice',
    name: 'Würfelduell',
    emoji: '🎲',
    icon: 'dice',
    blurb: 'Zwei Würfel, vier Wettarten und ein Dealer, der dich auslachen will.',
    badge: 'BIS 5.1×',
    color: '#8b3bff',
    rules: [
      '<b>Duell:</b> deine 2 Würfel gegen die des Dealers — höhere Summe gewinnt (1,8×). Gleichstand = Push.',
      '<b>Über 7 / Unter 7:</b> zahlt 2,15× wenn deine Summe passt. Eine exakte 7 verliert hier.',
      '<b>Exakt 7:</b> zahlt fette 5,1× — trifft aber nur in einem von sechs Würfen.'
    ],
    mount: function (root) {
      var stopped = false, rolling = false, mode = MODES[0];

      var bet = GK.betPanel({ start: 20 });
      var p1 = makeDie(true), p2 = makeDie(true);
      var d1 = makeDie(false), d2 = makeDie(false);
      [p1, p2, d1, d2].forEach(function (d) { setDie(d, 1); });

      var myTotal = el('div', { class: 'total-badge', text: '–' });
      var dealerTotal = el('div', { class: 'total-badge', text: '–' });
      var dealerRow = el('div', { class: 'dice-row' }, [d1, d2, dealerTotal]);
      var dealerBlock = el('div', {}, [
        el('div', { class: 'bet-label center', text: '🤵 DEALER' }),
        el('div', { style: 'height:8px' }),
        dealerRow
      ]);

      var table = el('div', { class: 'dice-table' }, [
        dealerBlock,
        el('div', { class: 'center vs-badge', text: '⚔️ VS ⚔️' }),
        el('div', {}, [
          el('div', { class: 'bet-label center', text: '🧑 DU' }),
          el('div', { style: 'height:8px' }),
          el('div', { class: 'dice-row' }, [p1, p2, myTotal])
        ])
      ]);

      var modeBtns = [];
      var modePick = el('div', { class: 'mode-pick' }, MODES.map(function (m) {
        var b = el('button', { class: 'rbet' + (m.id === 'duel' ? ' sel' : '') }, [
          m.label, el('small', { text: m.mult + '×' })
        ]);
        b.addEventListener('click', function () {
          mode = m; syncMode(); GK.sfx('chip');
        });
        modeBtns.push({ m: m, b: b });
        return b;
      }));

      var modeHint = el('p', { class: 'hint', text: MODES[0].hint });
      var resultBox = GK.resultBox();
      var rollBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎲 WÜRFELN' });

      function syncMode() {
        modeBtns.forEach(function (o) { o.b.classList.toggle('sel', o.m.id === mode.id); });
        modeHint.textContent = mode.hint;
        dealerBlock.style.display = mode.id === 'duel' ? '' : 'none';
      }

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([table]),
        GK.panel([
          el('div', { class: 'bet-label', text: 'WETTART' }),
          el('div', { style: 'height:8px' }),
          modePick,
          el('div', { style: 'height:8px' }),
          modeHint,
          el('div', { style: 'height:12px' }),
          bet.el,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          rollBtn
        ])
      ]);
      root.appendChild(stage);
      syncMode();

      /* Die Würfel rollen aus: die Abstände zwischen den Wechseln werden zum
         Schluss immer länger, statt bis zuletzt gleich schnell zu flackern. */
      function animate(dice, finals, done) {
        dice.forEach(function (d) { d.classList.add('rolling'); });
        var STEPS = 12, n = 0;

        function step() {
          if (stopped) return;
          n++;
          dice.forEach(function (d) { setDie(d, GK.rndInt(1, 6)); });
          if (n % 2 === 0) GK.sfx('tick');
          if (n >= STEPS) {
            dice.forEach(function (d, i) { d.classList.remove('rolling'); setDie(d, finals[i]); });
            GK.sfx('reel');
            done();
            return;
          }
          setTimeout(step, 55 + 240 * Math.pow(n / STEPS, 3));
        }
        setTimeout(step, 55);
      }

      function roll() {
        if (rolling || stopped) return;
        var stake = bet.value();
        if (!GK.wager(stake, 'Würfelduell')) return;

        rolling = true;
        rollBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, 'Die Würfel fliegen…', '');
        GK.sfx('whoosh');

        var mine = [GK.rndInt(1, 6), GK.rndInt(1, 6)];
        var theirs = [GK.rndInt(1, 6), GK.rndInt(1, 6)];

        /* Nachwurf zugunsten des Spielers — Grundwert 0, greift also nur über
           den Admin-Luck-Regler. Mit den früheren 8 % lag „Exakt 7" bei über
           120 % Auszahlungsquote. */
        if (GK.luckRoll(0)) {
          if (mode.id === 'seven') { mine = [GK.rndInt(1, 6), 0]; mine[1] = 7 - mine[0]; }
          else if (mode.id === 'over') mine = [GK.rndInt(4, 6), GK.rndInt(4, 6)];
          else if (mode.id === 'under') mine = [GK.rndInt(1, 3), GK.rndInt(1, 3)];
          else theirs = [GK.rndInt(1, 3), GK.rndInt(1, 3)];
        }

        var mineSum = mine[0] + mine[1], theirSum = theirs[0] + theirs[1];
        myTotal.textContent = '–';
        dealerTotal.textContent = '–';

        animate([p1, p2], mine, function () {
          if (stopped) return;
          myTotal.textContent = mineSum;
          if (mode.id === 'duel') {
            animate([d1, d2], theirs, function () {
              if (stopped) return;
              dealerTotal.textContent = theirSum;
              setTimeout(function () { finish(stake, mineSum, theirSum); }, 320);
            });
          } else {
            setTimeout(function () { finish(stake, mineSum, theirSum); }, 320);
          }
        });
      }

      function finish(stake, mineSum, theirSum) {
        var win = 0, msg = '', kind = 'lose';

        if (mode.id === 'duel') {
          if (mineSum > theirSum) { win = Math.floor(stake * mode.mult); msg = mineSum + ' schlägt ' + theirSum + ' 🏆'; kind = 'win'; }
          else if (mineSum === theirSum) { win = stake; msg = 'Gleichstand bei ' + mineSum + ' — Einsatz zurück'; kind = 'push'; }
          else { msg = theirSum + ' schlägt deine ' + mineSum + ' 😤'; }
        } else if (mode.id === 'over') {
          if (mineSum > 7) { win = Math.floor(stake * mode.mult); msg = mineSum + ' — über 7! 🎉'; kind = 'win'; }
          else msg = mineSum + ' — nicht über 7';
        } else if (mode.id === 'under') {
          if (mineSum < 7) { win = Math.floor(stake * mode.mult); msg = mineSum + ' — unter 7! 🎉'; kind = 'win'; }
          else msg = mineSum + ' — nicht unter 7';
        } else {
          if (mineSum === 7) { win = Math.floor(stake * mode.mult); msg = 'EXAKT 7! 🎯 5,5×'; kind = 'win'; }
          else msg = mineSum + ' — keine 7';
        }

        GK.payout(win, { stake: stake });
        GK.logPlay('Würfelduell', stake, win);
        GK.setResult(resultBox, msg + (kind === 'win' ? '  +' + GK.fmt(win - stake) : ''), kind);

        if (kind === 'win') GK.celebrate(win - stake, mode.mult);
        else if (kind === 'push') GK.sfx('coin');
        else { GK.sfx('lose'); GK.shake(table); }

        rolling = false;
        rollBtn.disabled = false;
        bet.disable(false);
      }

      rollBtn.addEventListener('click', function () { GK.sfx('click'); roll(); });
      return function () { stopped = true; };
    }
  });
})(window.GK);
