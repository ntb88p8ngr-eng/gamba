/* ═══════════ 12. EISBÄR AUF DEM EIS (ab Level 4) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var STEPS = 8;
  var MODES = {
    easy:   { label: '🧊 Dickes Eis', tiles: 4, cracks: 1 },
    normal: { label: '❄️ Dünnes Eis', tiles: 3, cracks: 1 },
    hard:   { label: '💀 Todeseis',   tiles: 2, cracks: 1 }
  };

  GK.registerGame({
    id: 'icebear',
    name: 'Eisbär auf dem Eis',
    emoji: '🐻‍❄️',
    icon: 'bear',
    blurb: 'Führ den Eisbären über die Schollen. Jeder Schritt zahlt mehr — bis das Eis unter ihm bricht.',
    badge: 'BIS 233×',
    color: '#00e5ff',
    minLevel: 4,
    rules: [
      'Der Eisbär klettert <b>Scholle für Scholle</b> nach oben. Pro Reihe wählst du eine aus.',
      'Jede sichere Scholle erhöht den <b>Multiplikator</b>.',
      'In jeder Reihe ist genau eine Scholle <b>dünn</b> — trittst du drauf, fällt der Bär ins Wasser.',
      'Du kannst nach jedem Schritt <b>aussteigen</b> und den Multiplikator kassieren.',
      '<b>Todeseis</b> ist 50/50 pro Schritt, zahlt oben aber über 230×.'
    ],
    mount: function (root, resume) {
      var stopped = false, active = false;
      var mode = 'normal', stake = 0, step = 0, cracks = [];
      /* Welche Scholle je Reihe betreten wurde — nur damit laesst sich eine
         unterbrochene Kletterei spaeter wieder aufbauen. */
      var chosen = [];

      var bet = GK.betPanel({ start: 25 });
      var rowsBox = el('div', { class: 'ice-rows' });
      var rowEls = [];

      var water = el('div', { class: 'ice-water' }, [el('span', { class: 'bear-swim', html: GK.iconHTML('bear') })]);

      function multAfter(n) {
        var m = MODES[mode];
        var safe = m.tiles - m.cracks;
        return Math.round(Math.pow(m.tiles / safe, n) * 0.91 * 100) / 100;
      }

      function buildRows() {
        rowsBox.innerHTML = '';
        rowEls = [];
        var m = MODES[mode];
        // von oben (letzte Stufe) nach unten (erste Stufe) zeichnen
        for (var s = STEPS - 1; s >= 0; s--) {
          (function (s) {
            var tiles = [];
            var row = el('div', { class: 'ice-row' });
            row.appendChild(el('span', { class: 'ice-mult', text: multAfter(s + 1).toFixed(2) + '×' }));
            var strip = el('div', { class: 'ice-strip' });
            for (var t = 0; t < m.tiles; t++) {
              (function (t) {
                var tile = el('button', { class: 'floe', html: GK.iconHTML('floe') });
                tile.addEventListener('click', function () { pickTile(s, t); });
                tiles.push(tile);
                strip.appendChild(tile);
              })(t);
            }
            row.appendChild(strip);
            rowsBox.appendChild(row);
            rowEls[s] = { row: row, tiles: tiles };
          })(s);
        }
        syncRows();
      }

      function syncRows() {
        rowEls.forEach(function (r, s) {
          r.row.classList.toggle('current', active && s === step);
          r.row.classList.toggle('passed', s < step);
          r.tiles.forEach(function (t) { t.disabled = !active || s !== step; });
        });
      }

      var modeBtns = [];
      var modePick = el('div', { class: 'mode-pick' }, Object.keys(MODES).map(function (k) {
        var b = el('button', { class: 'rbet' + (k === 'normal' ? ' sel' : '') }, [
          MODES[k].label,
          el('small', { text: 'max ' + Math.round(Math.pow(MODES[k].tiles / (MODES[k].tiles - MODES[k].cracks), STEPS) * 0.91) + '×' })
        ]);
        b.addEventListener('click', function () {
          if (active) return;
          mode = k;
          modeBtns.forEach(function (o) { o.b.classList.toggle('sel', o.k === k); });
          buildRows(); syncStats();
          GK.sfx('chip');
        });
        modeBtns.push({ k: k, b: b });
        return b;
      }));

      var multBox = el('div', { class: 'info-box' }, [el('b', { text: '1.00×' }), el('span', { text: 'Aktuell' })]);
      var nextBox = el('div', { class: 'info-box' }, [el('b', { text: '–' }), el('span', { text: 'Nächster' })]);
      var stepBox = el('div', { class: 'info-box' }, [el('b', { text: '0' }), el('span', { text: 'Schritte' })]);
      var cashBox = el('div', { class: 'info-box' }, [el('b', { text: '0' }), el('span', { text: 'Auszahlung' })]);

      var resultBox = GK.resultBox();
      var startBtn = el('button', { class: 'btn btn-gold btn-full', text: '🐻‍❄️ LOSMARSCHIEREN' });
      var cashBtn = el('button', { class: 'btn btn-lime btn-full', text: '💰 AUSSTEIGEN' });
      cashBtn.disabled = true;

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([el('div', { class: 'ice-field' }, [rowsBox, water])]),
        GK.panel([
          el('div', { class: 'bet-label', text: 'EISDICKE' }),
          el('div', { style: 'height:6px' }),
          modePick,
          el('div', { style: 'height:12px' }),
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'info-grid' }, [multBox, nextBox, stepBox, cashBox]),
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          startBtn,
          el('div', { style: 'height:8px' }),
          cashBtn
        ])
      ]);
      root.appendChild(stage);

      function syncStats() {
        var cur = step > 0 ? multAfter(step) : 1;
        multBox.querySelector('b').textContent = cur.toFixed(2) + '×';
        nextBox.querySelector('b').textContent = step < STEPS ? multAfter(step + 1).toFixed(2) + '×' : 'MAX';
        stepBox.querySelector('b').textContent = step + ' / ' + STEPS;
        cashBox.querySelector('b').textContent = active && step > 0 ? GK.fmt(Math.floor(stake * cur)) : '0';
      }

      function start() {
        if (active || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Eisbär')) return;

        active = true;
        step = 0;
        chosen = [];
        var m = MODES[mode];
        cracks = [];
        for (var s = 0; s < STEPS; s++) cracks.push(GK.rndInt(0, m.tiles - 1));

        buildRows();
        startBtn.disabled = true;
        cashBtn.disabled = true;
        bet.disable(true);
        modeBtns.forEach(function (o) { o.b.disabled = true; });
        water.classList.remove('splash');
        GK.setResult(resultBox, 'Vorsichtig… welche Scholle hält?', '');
        GK.sfx('whoosh');
        syncStats();
        syncRows();
        snapshot();
      }

      function pickTile(s, t) {
        if (!active || s !== step) return;
        var r = rowEls[s];
        var broke = t === cracks[s];

        // Admin-Luck darf einen Fehltritt gnädig umleiten
        var lk = GK.luckOf('icebear');
        if (broke && lk > 50 && Math.random() < ((lk - 50) / 50) * 0.45) {
          cracks[s] = (t + 1) % MODES[mode].tiles;
          broke = false;
        }

        r.tiles.forEach(function (x) { x.disabled = true; });

        if (broke) {
          r.tiles[t].classList.add('broken');
          r.tiles[t].innerHTML = GK.iconHTML('wave');
          r.tiles.forEach(function (x, i) { if (i !== t) x.classList.add('safe-dim'); });
          water.classList.add('splash');
          GK.sfx('boom');
          GK.shake(rowsBox, true);
          end(false);
          return;
        }

        r.tiles[t].classList.add('stepped');
        r.tiles[t].innerHTML = GK.iconHTML('bear2');
        r.tiles.forEach(function (x, i) { if (i !== t) x.classList.add('safe-dim'); });
        chosen[s] = t;
        step++;
        GK.sfx('gem');
        cashBtn.disabled = false;
        syncStats();
        syncRows();
        snapshot();

        if (step >= STEPS) {
          GK.toast('Ganz oben angekommen! 🏔️', 'gold', '🐻‍❄️');
          cashOut();
        }
      }

      function cashOut() {
        if (!active || step === 0) return;
        var mult = multAfter(step);
        var win = Math.floor(stake * mult);
        active = false;
        GK.payout(win, { stake: stake });
        GK.logPlay('Eisbär auf dem Eis', stake, win);
        GK.setResult(resultBox, step + ' Schollen · ' + mult.toFixed(2) + '× → +' + GK.fmt(win - stake), 'win');
        GK.celebrate(win - stake, mult);
        revealRest();
        finishUI();
      }

      function end() {
        active = false;
        GK.payout(0, { stake: stake });
        GK.logPlay('Eisbär auf dem Eis', stake, 0);
        GK.setResult(resultBox, 'Das Eis bricht! 🌊 Der Bär schwimmt, dein Einsatz nicht.', 'lose');
        GK.sfx('lose');
        revealRest();
        finishUI();
      }

      function revealRest() {
        rowEls.forEach(function (r, s) {
          r.tiles.forEach(function (t, i) {
            t.disabled = true;
            if (s >= step && !t.classList.contains('broken') && !t.classList.contains('stepped')) {
              t.innerHTML = GK.iconHTML(i === cracks[s] ? 'wave' : 'floe');
              t.classList.add('revealed-dim');
            }
          });
        });
      }

      function finishUI() {
        GK.clearGameState('icebear');
        startBtn.disabled = false;
        cashBtn.disabled = true;
        bet.disable(false);
        modeBtns.forEach(function (o) { o.b.disabled = false; });
        syncStats();
      }

      /* ── Unterbrochene Kletterei ──
         Die Bruchstellen muessen mit, sonst waere die Route beim Weitermachen
         neu gewuerfelt. Gesichert wird nach jedem Schritt. */
      function snapshot() {
        if (!active) { GK.clearGameState('icebear'); return; }
        GK.saveGameState('icebear', {
          mode: mode, stake: stake, step: step, cracks: cracks, chosen: chosen
        });
      }

      function restore(st) {
        if (!st || !st.cracks) return false;
        mode = st.mode; stake = st.stake; step = st.step || 0;
        cracks = st.cracks; chosen = st.chosen || [];
        active = true;
        bet.set && bet.set(stake);
        modeBtns.forEach(function (o) { o.b.classList.toggle('sel', o.k === mode); });

        buildRows();
        for (var s = 0; s < step; s++) {
          var r = rowEls[s], t = chosen[s];
          if (!r || t === undefined) continue;
          r.tiles[t].classList.add('stepped');
          r.tiles[t].innerHTML = GK.iconHTML('bear2');
          r.tiles.forEach(function (x, i) { if (i !== t) x.classList.add('safe-dim'); });
        }
        startBtn.disabled = true;
        cashBtn.disabled = step === 0;
        bet.disable(true);
        modeBtns.forEach(function (o) { o.b.disabled = true; });
        syncStats();
        syncRows();
        GK.setResult(resultBox, 'Weiter geht’s — ' + step + ' Schollen liegen hinter dir.', '');
        GK.toast('Unterbrochene Runde fortgesetzt · Einsatz ' + GK.fmt(stake), 'gold', '🐻‍❄️');
        return true;
      }

      startBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('click'); cashOut(); });

      buildRows();
      syncStats();
      restore(resume);
      return function () { stopped = true; snapshot(); };
    }
  });
})(window.GK);
