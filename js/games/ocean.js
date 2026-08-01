/* ═══════════ 13. TIEFSEE-SCHATZ — 5 Walzen (ab Level 7) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var ROWS = 3, REELS = 5, ROW_H = 92;

  /* pay: [3 Gleiche, 4 Gleiche, 5 Gleiche] — bezogen auf den Linieneinsatz */
  var SYMS = [
    { id: 'alge',    ic: 'kelp',     name: 'Alge',        w: 30, pay: [9, 23, 52] },
    { id: 'muschel', ic: 'shell',    name: 'Muschel',     w: 26, pay: [11, 29, 78] },
    { id: 'fisch',   ic: 'fish',     name: 'Fisch',       w: 22, pay: [14, 40, 115] },
    { id: 'bunt',    ic: 'reeffish', name: 'Riff-Fisch',  w: 17, pay: [18, 52, 168] },
    { id: 'krabbe',  ic: 'crab',     name: 'Krabbe',      w: 13, pay: [22, 70, 260] },
    { id: 'krake',   ic: 'octopus',  name: 'Krake',       w: 9,  pay: [34, 104, 385] },
    { id: 'hai',     ic: 'shark',    name: 'Hai',         w: 6,  pay: [52, 162, 645] },
    { id: 'perle',   ic: 'pearl',    name: 'Perle',       w: 4,  pay: [80, 255, 1030] },
    { id: 'wild',    ic: 'trident',  name: 'Dreizack',    w: 3,  pay: [115, 405, 1900], wild: true },
    { id: 'schatz',  ic: 'chest',    name: 'Schatztruhe', w: 4,  pay: [0, 0, 0], scatter: true }
  ];
  var TOTAL_W = SYMS.reduce(function (s, x) { return s + x.w; }, 0);

  /* Zusätzliche Wild/Truhe — normal 0, steigt nur über den Admin-Luck-Regler
     (GK.luckRoll(0) ist bei neutralem Luck immer falsch). */
  var LUCKY_CELL = 0;

  /* Scatter zahlt auf den Gesamteinsatz, egal wo die Truhen liegen */
  var SCATTER_PAY = { 3: 4, 4: 17, 5: 100 };

  var LINES = [
    { name: 'Mitte',   rows: [1, 1, 1, 1, 1], color: '#00e5ff' },
    { name: 'Oben',    rows: [0, 0, 0, 0, 0], color: '#7cff3b' },
    { name: 'Unten',   rows: [2, 2, 2, 2, 2], color: '#ffd12e' },
    { name: 'V',       rows: [0, 1, 2, 1, 0], color: '#ff2fd0' },
    { name: 'Λ',       rows: [2, 1, 0, 1, 2], color: '#ff8a00' }
  ];

  function randSym() {
    var r = Math.random() * TOTAL_W;
    for (var i = 0; i < SYMS.length; i++) { r -= SYMS[i].w; if (r <= 0) return SYMS[i]; }
    return SYMS[0];
  }

  /* ── Auswertung: reine Rechnung, deshalb außerhalb von mount ── */
  function evaluate(grid, lineBet, totalBet) {
    var wins = [], total = 0;

    LINES.forEach(function (line, li) {
      var syms = line.rows.map(function (row, reel) { return grid[reel][row]; });
      // erstes nicht-wildes Symbol bestimmt die Linie
      var base = null;
      for (var i = 0; i < syms.length; i++) {
        if (syms[i].scatter) break;
        if (!syms[i].wild) { base = syms[i]; break; }
      }
      if (!base) base = syms[0].wild ? SYMS.filter(function (s) { return s.wild; })[0] : null;
      if (!base || base.scatter) return;

      var count = 0;
      for (var j = 0; j < syms.length; j++) {
        if (syms[j].id === base.id || (syms[j].wild && !base.scatter)) count++;
        else break;
      }
      if (count >= 3) {
        var mult = base.pay[count - 3];
        var amount = Math.floor(lineBet * mult);
        if (amount > 0) {
          total += amount;
          wins.push({ line: li, count: count, sym: base, amount: amount });
        }
      }
    });

    // Scatter zählt überall auf dem Feld
    var scatters = [];
    for (var r = 0; r < REELS; r++) for (var c = 0; c < ROWS; c++) {
      if (grid[r][c].scatter) scatters.push([r, c]);
    }
    if (SCATTER_PAY[scatters.length]) {
      var sAmount = Math.floor(totalBet * SCATTER_PAY[scatters.length]);
      total += sAmount;
      wins.push({ scatter: true, count: scatters.length, cells: scatters, amount: sAmount });
    }
    return { total: total, wins: wins };
  }

  /** Zufälliges Walzenbild. Der Admin-Luck streut zusätzliche Wilds/Truhen ein. */
  function drawGrid() {
    var g = [];
    for (var r = 0; r < REELS; r++) {
      g[r] = [];
      for (var c = 0; c < ROWS; c++) g[r][c] = randSym();
    }
    if (GK.luckRoll(LUCKY_CELL)) {
      var lucky = GK.pick(SYMS.filter(function (s) { return s.wild || s.scatter; }));
      g[GK.rndInt(0, REELS - 1)][GK.rndInt(0, ROWS - 1)] = lucky;
    }
    return g;
  }

  GK.registerGame({
    id: 'ocean',
    name: 'Tiefsee-Schatz',
    emoji: '🐠',
    icon: 'reeffish',
    blurb: '5 Walzen, 5 Gewinnlinien, ein versunkener Schatz. Algen, Muscheln, Haie — und die Truhe zahlt überall.',
    badge: 'BIS 1900×',
    color: '#00e5ff',
    minLevel: 7,
    rules: [
      '<b>5 Walzen mit je 3 Symbolen</b> und <b>5 Gewinnlinien</b> (Mitte, Oben, Unten, V und Λ).',
      'Gewinne zählen <b>von links</b>: ab 3 gleichen Symbolen auf einer Linie.',
      'Der <b>Dreizack</b> ist Wild und ersetzt jedes Symbol außer der Truhe.',
      'Die <b>Schatztruhe</b> ist Scatter: 3 Stück irgendwo zahlen 4×, 4 zahlen 17×, 5 zahlen 100× — auf den Gesamteinsatz.',
      'Der Einsatz verteilt sich gleichmäßig auf die 5 Linien.'
    ],
    mount: function (root) {
      var stopped = false, spinning = false, autoLeft = 0, endless = false;
      /* Der gewünschte Einsatz wird getrennt gemerkt: bet.value() kappt auf das
         Guthaben, sonst würde der Automat im Endlos-Modus einfach mit immer
         kleineren Beträgen weitertauchen statt zu stoppen. */
      var wantStake = 25;
      var bet = GK.betPanel({ start: 25, min: 5, onChange: function (v) { wantStake = v; } });

      var reels = [], strips = [];
      for (var i = 0; i < REELS; i++) {
        var strip = el('div', { class: 'strip' });
        var reel = el('div', { class: 'reel oc-reel' }, [strip]);
        reels.push(reel); strips.push(strip);
      }

      var lineOverlay = el('div', { class: 'line-overlay' });
      var machine = el('div', { class: 'ocean-machine' }, [
        el('div', { class: 'oc-bubbles' }),
        el('div', { class: 'reels oc-reels' }, reels.concat([lineOverlay]))
      ]);

      function fillStrip(strip, finals, len) {
        strip.innerHTML = '';
        for (var i = 0; i < len - ROWS; i++) strip.appendChild(el('div', { class: 'sym oc-sym', html: GK.iconHTML(randSym().ic) }));
        finals.forEach(function (s) { strip.appendChild(el('div', { class: 'sym oc-sym', html: GK.iconHTML(s.ic) })); });
      }

      // Startbild
      var grid = [];
      for (var r = 0; r < REELS; r++) {
        grid[r] = [];
        for (var c = 0; c < ROWS; c++) grid[r][c] = randSym();
        fillStrip(strips[r], grid[r], ROWS);
      }

      var payTable = el('div', { class: 'paytable oc-paytable' }, SYMS.slice().reverse().map(function (s) {
        return el('div', { class: 'pay-item' }, [
          el('span', { class: 's', html: GK.iconHTML(s.ic) }),
          el('span', { class: 'm', text: s.scatter ? 'SCATTER' : (s.pay[2] + '×') }),
          el('span', { style: 'font-size:.6rem;color:var(--muted)', text: s.name })
        ]);
      }));

      var lineLegend = el('div', { class: 'line-legend' }, LINES.map(function (l, i) {
        return el('span', { class: 'll-item', style: 'border-color:' + l.color + ';color:' + l.color, text: (i + 1) + ' ' + l.name });
      }));

      var resultBox = GK.resultBox();
      var spinBtn = el('button', { class: 'btn btn-gold btn-full', text: '🌊 ABTAUCHEN' });
      var autoBtn = el('button', { class: 'btn btn-ghost', text: '🔁 AUTO 10' });
      var loopBtn = el('button', { class: 'btn btn-ghost', text: '♾️ ENDLOS' });
      var autoRow = el('div', { class: 'auto-row' }, [autoBtn, loopBtn]);

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [machine, el('div', { style: 'height:10px' }), lineLegend, el('div', { style: 'height:10px' }), payTable]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          spinBtn,
          el('div', { style: 'height:8px' }),
          autoRow,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Der <b>Dreizack</b> ersetzt alles außer der Truhe. Fünf Dreizacke auf einer Linie zahlen <b>1900×</b> den Linieneinsatz. <b>Endlos</b> taucht weiter, bis du stoppst oder die Chips alle sind.' })
        ])
      ]);
      root.appendChild(stage);

      function highlight(wins) {
        lineOverlay.innerHTML = '';
        wins.forEach(function (w, i) {
          if (w.scatter) return;
          var line = LINES[w.line];
          var seg = el('div', { class: 'win-line', style: 'background:' + line.color + ';animation-delay:' + (i * 120) + 'ms' });
          // Linie mittig über die getroffenen Walzen legen
          var avgRow = line.rows.slice(0, w.count).reduce(function (a, b) { return a + b; }, 0) / w.count;
          seg.style.top = ((avgRow + 0.5) / ROWS * 100) + '%';
          seg.style.width = (w.count / REELS * 100) + '%';
          lineOverlay.appendChild(seg);
        });
      }

      function spin() {
        if (spinning || stopped) return;
        var stake = bet.value();
        if (stake < 5) { GK.toast('Mindestens 5 Chips (5 Linien)', 'bad', '🎰'); return; }
        if (!GK.wager(stake, 'Tiefsee-Schatz')) { stopAuto(); return; }

        spinning = true;
        spinBtn.disabled = true;
        bet.disable(true);
        lineOverlay.innerHTML = '';
        GK.setResult(resultBox, 'Die Walzen tauchen ab…', '');
        GK.sfx('spin');

        var lineBet = Math.floor(stake / LINES.length);
        var newGrid = drawGrid();

        var lens = [16, 20, 24, 28, 32];
        strips.forEach(function (strip, i) {
          fillStrip(strip, newGrid[i], lens[i]);
          strip.style.transition = 'none';
          strip.style.transform = 'translateY(0)';
        });
        void strips[0].offsetWidth;
        strips.forEach(function (strip, i) {
          strip.style.transition = 'transform ' + (1.5 + i * 0.32) + 's cubic-bezier(.15,.72,.16,1)';
          strip.style.transform = 'translateY(-' + ((lens[i] - ROWS) * ROW_H) + 'px)';
        });
        strips.forEach(function (strip, i) {
          setTimeout(function () {
            if (stopped) return;
            GK.sfx('reel');
            reels[i].classList.add('hit');
            setTimeout(function () { reels[i].classList.remove('hit'); }, 300);
          }, (1.5 + i * 0.32) * 1000);
        });

        setTimeout(function () {
          if (stopped) return;
          grid = newGrid;
          finish(stake, lineBet);
        }, (1.5 + (REELS - 1) * 0.32) * 1000 + 240);
      }

      function finish(stake, lineBet) {
        var res = evaluate(grid, lineBet, stake);
        GK.payout(res.total, { stake: stake });
        GK.logPlay('Tiefsee-Schatz', stake, res.total);
        highlight(res.wins);

        if (res.total > stake) {
          var best = res.wins.slice().sort(function (a, b) { return b.amount - a.amount; })[0];
          var label = best.scatter
            ? best.count + '× Schatztruhe!'
            : best.count + '× ' + best.sym.name + ' auf Linie ' + (best.line + 1);
          GK.setResult(resultBox, label + ' → +' + GK.fmt(res.total - stake), 'win');
          GK.celebrate(res.total - stake, res.total / Math.max(1, stake));
          if (res.total >= stake * 20) GK.emojiRain(['💰', '🔱', '🫧', '🐠'], 30);
        } else if (res.total > 0) {
          GK.setResult(resultBox, res.wins.length + ' Treffer — ' + GK.fmt(res.total) + ' zurück', 'push');
          GK.sfx('coin');
        } else {
          GK.setResult(resultBox, 'Nur Wasser. Nochmal abtauchen?', 'lose');
          GK.sfx('lose');
        }

        spinning = false;
        spinBtn.disabled = false;
        bet.disable(false);

        if (endless) {
          // taucht weiter, bis gestoppt wird oder die Chips nicht mehr reichen
          if (canAfford()) setTimeout(spin, 800);
          else {
            stopAuto();
            GK.toast('Endlos-Modus gestoppt — Chips reichen nicht mehr', 'bad', '🪙');
          }
        } else if (autoLeft > 0) {
          autoLeft--;
          syncAuto();
          if (autoLeft > 0 && canAfford()) setTimeout(spin, 800);
        }
      }

      function canAfford() {
        var p = GK.player();
        return !!p && p.balance >= wantStake;
      }

      function stopAuto() {
        autoLeft = 0;
        endless = false;
        syncAuto();
      }

      function syncAuto() {
        autoBtn.textContent = autoLeft > 0 ? '⏹ STOP (' + autoLeft + ')' : '🔁 AUTO 10';
        autoBtn.classList.toggle('btn-danger', autoLeft > 0);
        loopBtn.textContent = endless ? '⏹ STOP (∞)' : '♾️ ENDLOS';
        loopBtn.classList.toggle('btn-danger', endless);
      }

      spinBtn.addEventListener('click', function () { GK.sfx('click'); spin(); });
      autoBtn.addEventListener('click', function () {
        GK.sfx('click');
        if (autoLeft > 0 || endless) { stopAuto(); return; }
        wantStake = bet.value();
        autoLeft = 10; syncAuto();
        if (!spinning) spin();
      });
      loopBtn.addEventListener('click', function () {
        GK.sfx('click');
        if (endless || autoLeft > 0) { stopAuto(); return; }
        wantStake = bet.value();
        endless = true; syncAuto();
        if (!spinning) spin();
      });

      return function () { stopped = true; autoLeft = 0; endless = false; };
    }
  });
})(window.GK);
