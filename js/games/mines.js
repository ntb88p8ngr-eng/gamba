/* ═══════════ 7. DRACHENHÖHLE (Mines) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var SIZE = 25; // 5x5

  GK.registerGame({
    id: 'mines',
    name: 'Drachenhöhle',
    emoji: '💎',
    icon: 'gem',
    blurb: 'Sammle Edelsteine im Drachenhort. Hinter jedem Feld lauert vielleicht ein Drache.',
    badge: 'BIS 200×',
    color: '#00e5ff',
    rules: [
      'Wähle wie viele <b>Drachen 🐉</b> im 5×5-Feld versteckt sind — mehr Drachen, höherer Multiplikator.',
      'Jedes aufgedeckte <b>Edelstein-Feld 💎</b> erhöht deinen Multiplikator.',
      'Du kannst <b>jederzeit auszahlen</b>. Der Multiplikator gilt ab dem ersten Fund.',
      'Ein Drache beendet die Runde sofort — Einsatz weg.'
    ],
    mount: function (root, resume) {
      var stopped = false, active = false;
      var mineCount = 3, stake = 0, mines = [], revealed = [], picks = 0;

      var bet = GK.betPanel({ start: 25 });

      var grid = el('div', { class: 'mine-grid' });
      var cells = [];
      for (var i = 0; i < SIZE; i++) {
        (function (i) {
          var c = el('button', { class: 'mine-cell', html: GK.iconHTML('question') });
          c.addEventListener('click', function () { pickCell(i); });
          cells.push(c);
          grid.appendChild(c);
        })(i);
      }

      var mineSelect = el('select', { class: 'input' });
      [1, 2, 3, 5, 8, 12, 18, 24].forEach(function (n) {
        var o = el('option', { value: n, text: n + ' Drache' + (n > 1 ? 'n' : '') });
        if (n === 3) o.selected = true;
        mineSelect.appendChild(o);
      });
      mineSelect.addEventListener('change', function () {
        mineCount = Number(mineSelect.value);
        syncStats();
        GK.sfx('chip');
      });

      var multBox = el('div', { class: 'info-box' }, [el('b', { text: '1.00×' }), el('span', { text: 'Multiplikator' })]);
      var nextBox = el('div', { class: 'info-box' }, [el('b', { text: '–' }), el('span', { text: 'Nächster' })]);
      var gemBox = el('div', { class: 'info-box' }, [el('b', { text: '0' }), el('span', { text: 'Edelsteine' })]);
      var cashValue = el('div', { class: 'info-box' }, [el('b', { text: '0' }), el('span', { text: 'Auszahlung' })]);

      var resultBox = GK.resultBox();
      var startBtn = el('button', { class: 'btn btn-gold btn-full', text: '⛏️ HÖHLE BETRETEN' });
      var cashBtn = el('button', { class: 'btn btn-lime btn-full', text: '💰 AUSZAHLEN' });
      cashBtn.disabled = true;

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([grid]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'bet-label', text: 'ANZAHL DRACHEN' }),
          el('div', { style: 'height:6px' }),
          mineSelect,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'info-grid' }, [multBox, nextBox, gemBox, cashValue]),
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          startBtn,
          el('div', { style: 'height:8px' }),
          cashBtn
        ])
      ]);
      root.appendChild(stage);

      /* Multiplikator: faire Quote auf die Wahrscheinlichkeit, k Felder sicher zu treffen */
      function multFor(k) {
        if (k <= 0) return 1;
        var safe = SIZE - mineCount;
        var m = 1;
        for (var i = 0; i < k; i++) m *= (SIZE - i) / (safe - i);
        return Math.round(m * 0.92 * 100) / 100; // Hausvorteil
      }

      function syncStats() {
        var cur = multFor(picks);
        multBox.querySelector('b').textContent = cur.toFixed(2) + '×';
        var maxPicks = SIZE - mineCount;
        nextBox.querySelector('b').textContent = picks < maxPicks ? multFor(picks + 1).toFixed(2) + '×' : 'MAX';
        gemBox.querySelector('b').textContent = picks;
        cashValue.querySelector('b').textContent = active && picks > 0 ? GK.fmt(Math.floor(stake * cur)) : '0';
      }

      function start() {
        if (active || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Mines')) return;

        active = true;
        picks = 0;
        revealed = [];
        mines = [];
        var pool = [];
        for (var i = 0; i < SIZE; i++) pool.push(i);
        for (var m = 0; m < mineCount; m++) {
          var idx = GK.rndInt(0, pool.length - 1);
          mines.push(pool.splice(idx, 1)[0]);
        }

        cells.forEach(function (c) {
          c.className = 'mine-cell';
          c.innerHTML = GK.iconHTML('question');
          c.disabled = false;
        });
        startBtn.disabled = true;
        cashBtn.disabled = true;
        bet.disable(true);
        mineSelect.disabled = true;
        GK.setResult(resultBox, 'Such die Edelsteine… 💎', '');
        GK.sfx('whoosh');
        syncStats();
        snapshot();
      }

      /**
       * Der Glücks-Regler greift erst beim Antippen ein, nicht beim Verteilen.
       * So bleibt die Zahl der Drachen — und damit die Quote — unverändert; es
       * verschiebt sich nur, wo sie liegen.
       */
      function schicksal(i) {
        var l = GK.luckOf('mines');
        var drauf = mines.indexOf(i) >= 0;
        if (l === 50) return drauf;

        if (drauf && l > 50 && Math.random() < ((l - 50) / 50) * 0.45) {
          var frei = [];
          for (var k = 0; k < SIZE; k++) {
            if (k !== i && revealed.indexOf(k) < 0 && mines.indexOf(k) < 0) frei.push(k);
          }
          if (frei.length) {
            mines[mines.indexOf(i)] = frei[GK.rndInt(0, frei.length - 1)];
            return false;
          }
        }
        if (!drauf && l < 50 && Math.random() < ((50 - l) / 50) * 0.35) {
          /* Umziehen darf nur ein Drache, der noch unter einer zugedeckten
             Kachel liegt — sonst wären es auf einmal mehr. */
          var versteckt = mines.filter(function (m) { return revealed.indexOf(m) < 0; });
          if (versteckt.length) {
            mines[mines.indexOf(versteckt[GK.rndInt(0, versteckt.length - 1)])] = i;
            return true;
          }
        }
        return drauf;
      }

      function pickCell(i) {
        if (!active || revealed.indexOf(i) >= 0) return;
        var drauf = schicksal(i);
        revealed.push(i);
        var c = cells[i];

        if (drauf) {
          c.classList.add('boom', 'done');
          c.innerHTML = GK.iconHTML('dragonblue');
          GK.sfx('boom');
          GK.shake(grid, true);
          endRound(false);
          return;
        }

        picks++;
        c.classList.add('gem', 'done');
        c.innerHTML = GK.iconHTML('gem');
        GK.sfx('gem');
        cashBtn.disabled = false;
        syncStats();
        snapshot();

        if (picks === SIZE - mineCount) {
          GK.toast('Alle Edelsteine gefunden! Perfekt! 🤯', 'gold', '🏆');
          cashOut();
        }
      }

      function cashOut() {
        if (!active || picks === 0) return;
        var mult = multFor(picks);
        var win = Math.floor(stake * mult);
        active = false;
        GK.payout(win, { stake: stake });
        GK.logPlay('Drachenhöhle', stake, win);
        GK.setResult(resultBox, picks + ' Edelsteine · ' + mult.toFixed(2) + '× → +' + GK.fmt(win - stake), 'win');
        GK.celebrate(win - stake, mult);
        revealAll();
        finishUI();
      }

      function endRound(won) {
        active = false;
        GK.payout(0, { stake: stake });
        GK.logPlay('Drachenhöhle', stake, 0);
        GK.setResult(resultBox, 'Ein Drache! 🐉 Einsatz von ' + GK.fmt(stake) + ' verbrannt.', 'lose');
        GK.sfx('lose');
        revealAll();
        finishUI();
      }

      function revealAll() {
        cells.forEach(function (c, i) {
          c.disabled = true;
          c.classList.add('done');
          if (revealed.indexOf(i) < 0) {
            c.classList.add('faded');
            c.innerHTML = GK.iconHTML(mines.indexOf(i) >= 0 ? 'dragon' : 'gem');
          }
        });
      }

      function finishUI() {
        GK.clearGameState('mines');
        startBtn.disabled = false;
        cashBtn.disabled = true;
        bet.disable(false);
        mineSelect.disabled = false;
        syncStats();
      }

      /* ── Unterbrochene Runde ──
         Die aufgedeckten Felder und die Lage der Drachen muessen mit, sonst
         waere die Hoehle beim Weiterspielen neu gewuerfelt. Gesichert wird
         nach jedem Feld, damit auch ein zugeschlagenes Fenster nichts frisst. */
      function snapshot() {
        if (!active) { GK.clearGameState('mines'); return; }
        GK.saveGameState('mines', {
          stake: stake, mineCount: mineCount, mines: mines, revealed: revealed, picks: picks
        });
      }

      function restore(st) {
        if (!st || !st.mines) return false;
        stake = st.stake; mineCount = st.mineCount;
        mines = st.mines; revealed = st.revealed || []; picks = st.picks || 0;
        active = true;
        bet.set && bet.set(stake);
        mineSelect.value = String(mineCount);

        cells.forEach(function (c, i) {
          c.className = 'mine-cell';
          c.innerHTML = GK.iconHTML('question');
          c.disabled = false;
          if (revealed.indexOf(i) >= 0) {
            c.classList.add('gem', 'done');
            c.innerHTML = GK.iconHTML('gem');
          }
        });
        startBtn.disabled = true;
        cashBtn.disabled = picks === 0;
        bet.disable(true);
        mineSelect.disabled = true;
        syncStats();
        GK.setResult(resultBox, 'Weiter geht’s — ' + picks + ' Edelsteine liegen schon.', '');
        GK.toast('Unterbrochene Runde fortgesetzt · Einsatz ' + GK.fmt(stake), 'gold', '💎');
        return true;
      }

      startBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('click'); cashOut(); });

      syncStats();
      restore(resume);
      return function () { stopped = true; snapshot(); };
    }
  });
})(window.GK);
