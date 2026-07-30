/* ═══════════ 7. DRACHENHÖHLE (Mines) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var SIZE = 25; // 5x5

  GK.registerGame({
    id: 'mines',
    name: 'Drachenhöhle',
    emoji: '💎',
    blurb: 'Sammle Edelsteine im Drachenhort. Hinter jedem Feld lauert vielleicht ein Drache.',
    badge: 'BIS 200×',
    color: '#00e5ff',
    rules: [
      'Wähle wie viele <b>Drachen 🐉</b> im 5×5-Feld versteckt sind — mehr Drachen, höherer Multiplikator.',
      'Jedes aufgedeckte <b>Edelstein-Feld 💎</b> erhöht deinen Multiplikator.',
      'Du kannst <b>jederzeit auszahlen</b>. Der Multiplikator gilt ab dem ersten Fund.',
      'Ein Drache beendet die Runde sofort — Einsatz weg.'
    ],
    mount: function (root) {
      var stopped = false, active = false;
      var mineCount = 3, stake = 0, mines = [], revealed = [], picks = 0;

      var bet = GK.betPanel({ start: 25 });

      var grid = el('div', { class: 'mine-grid' });
      var cells = [];
      for (var i = 0; i < SIZE; i++) {
        (function (i) {
          var c = el('button', { class: 'mine-cell', text: '❔' });
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
        return Math.round(m * 0.97 * 100) / 100; // kleiner Hausvorteil
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
        // Admin-Luck: sehr glückliche Spieler bekommen leicht "gnädigere" Verteilung
        for (var m = 0; m < mineCount; m++) {
          var idx = GK.rndInt(0, pool.length - 1);
          mines.push(pool.splice(idx, 1)[0]);
        }

        cells.forEach(function (c) {
          c.className = 'mine-cell';
          c.textContent = '❔';
          c.disabled = false;
        });
        startBtn.disabled = true;
        cashBtn.disabled = true;
        bet.disable(true);
        mineSelect.disabled = true;
        GK.setResult(resultBox, 'Such die Edelsteine… 💎', '');
        GK.sfx('whoosh');
        syncStats();
      }

      function pickCell(i) {
        if (!active || revealed.indexOf(i) >= 0) return;
        revealed.push(i);
        var c = cells[i];

        if (mines.indexOf(i) >= 0) {
          c.classList.add('boom', 'done');
          c.textContent = '🐉';
          GK.sfx('boom');
          GK.shake(grid, true);
          endRound(false);
          return;
        }

        picks++;
        c.classList.add('gem', 'done');
        c.textContent = '💎';
        GK.sfx('gem');
        cashBtn.disabled = false;
        syncStats();

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
            c.textContent = mines.indexOf(i) >= 0 ? '🐉' : '💎';
          }
        });
      }

      function finishUI() {
        startBtn.disabled = false;
        cashBtn.disabled = true;
        bet.disable(false);
        mineSelect.disabled = false;
        syncStats();
      }

      startBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('click'); cashOut(); });

      syncStats();
      return function () { stopped = true; };
    }
  });
})(window.GK);
