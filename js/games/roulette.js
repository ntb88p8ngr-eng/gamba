/* ═══════════ 2. NEON ROULETTE ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  // Europäisches Rad (ein einziges 0-Feld)
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
               10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var SEG = 360 / WHEEL.length;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function colorOf(n) { return n === 0 ? 'green' : (REDS.indexOf(n) >= 0 ? 'red' : 'black'); }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function buildWheel() {
    var svg = svgEl('svg', { viewBox: '0 0 100 100', width: '100%', height: '100%' });
    var R = 49, cx = 50, cy = 50;
    WHEEL.forEach(function (n, i) {
      var a0 = (-90 + i * SEG) * Math.PI / 180;
      var a1 = (-90 + (i + 1) * SEG) * Math.PI / 180;
      var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
      var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      var fill = n === 0 ? '#0f8a3c' : (REDS.indexOf(n) >= 0 ? '#c81b3c' : '#171021');
      svg.appendChild(svgEl('path', {
        d: 'M' + cx + ',' + cy + ' L' + x0.toFixed(2) + ',' + y0.toFixed(2) +
           ' A' + R + ',' + R + ' 0 0 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' Z',
        fill: fill, stroke: 'rgba(255,255,255,.25)', 'stroke-width': '.35'
      }));
      var mid = (-90 + (i + 0.5) * SEG);
      var tr = 41;
      var tx = cx + tr * Math.cos(mid * Math.PI / 180);
      var ty = cy + tr * Math.sin(mid * Math.PI / 180);
      var t = svgEl('text', {
        x: tx.toFixed(2), y: ty.toFixed(2), fill: '#fff', 'font-size': '4.6',
        'font-family': 'Bungee, sans-serif', 'text-anchor': 'middle',
        'dominant-baseline': 'central',
        transform: 'rotate(' + (mid + 90).toFixed(2) + ',' + tx.toFixed(2) + ',' + ty.toFixed(2) + ')'
      });
      t.textContent = n;
      svg.appendChild(t);
    });
    return svg;
  }

  GK.registerGame({
    id: 'roulette',
    name: 'Neon Roulette',
    emoji: '🎡',
    icon: 'roulettewheel',
    blurb: 'Rot, Schwarz oder die eine mutige Zahl. Das Rad entscheidet über Ruhm und Elend.',
    badge: 'BIS 32×',
    color: '#00e5ff',
    rules: [
      '<b>Rot / Schwarz / Gerade / Ungerade / 1-18 / 19-36</b> zahlen 1,9× — knapp unter dem doppelten Einsatz.',
      '<b>Dutzend</b> (1-12, 13-24, 25-36) zahlt 2,8×.',
      '<b>Einzelne Zahl</b> zahlt 32×.',
      'Die <b>grüne 0</b> schlägt alle einfachen Chancen — außer du hast sie direkt gesetzt.'
    ],
    mount: function (root) {
      var stopped = false, spinning = false, rot = 0;
      var selected = { type: 'red', value: null, label: 'Rot', mult: 1.9 };

      var bet = GK.betPanel({ start: 25 });
      var wheel = el('div', { class: 'roul-wheel' }, [buildWheel(), el('div', { class: 'roul-hub', text: '👑' })]);
      var out = el('div', { class: 'roul-out', text: '?' });
      var resultBox = GK.resultBox();

      var typeDefs = [
        { type: 'red', label: 'Rot', sub: '1.9×', cls: 'red' },
        { type: 'black', label: 'Schwarz', sub: '1.9×', cls: 'black' },
        { type: 'even', label: 'Gerade', sub: '1.9×' },
        { type: 'odd', label: 'Ungerade', sub: '1.9×' },
        { type: 'low', label: '1–18', sub: '1.9×' },
        { type: 'high', label: '19–36', sub: '1.9×' },
        { type: 'd1', label: '1–12', sub: '2.8×' },
        { type: 'd2', label: '13–24', sub: '2.8×' },
        { type: 'd3', label: '25–36', sub: '2.8×' }
      ];

      var typeBtns = [];
      var betTypes = el('div', { class: 'bet-types' }, typeDefs.map(function (d) {
        var b = el('button', { class: 'rbet ' + (d.cls || '') }, [
          d.label, el('small', { text: d.sub })
        ]);
        b.addEventListener('click', function () {
          selected = { type: d.type, value: null, label: d.label, mult: d.sub === '2.8×' ? 2.8 : 1.9 };
          syncSel();
          GK.sfx('chip');
        });
        typeBtns.push({ def: d, btn: b });
        return b;
      }));

      var numBtns = [];
      var numGrid = el('div', { class: 'num-grid' });
      for (var n = 0; n <= 36; n++) {
        (function (n) {
          var b = el('button', { class: 'num-cell ' + colorOf(n), text: String(n) });
          b.addEventListener('click', function () {
            selected = { type: 'num', value: n, label: 'Zahl ' + n, mult: 32 };
            syncSel();
            GK.sfx('chip');
          });
          numBtns.push({ n: n, btn: b });
          numGrid.appendChild(b);
        })(n);
      }

      function syncSel() {
        typeBtns.forEach(function (o) { o.btn.classList.toggle('sel', selected.type === o.def.type); });
        numBtns.forEach(function (o) { o.btn.classList.toggle('sel', selected.type === 'num' && selected.value === o.n); });
        selLabel.textContent = selected.label + '  ·  ' + selected.mult + '×';
      }

      var selLabel = el('div', { class: 'mult-badge center', text: '' });
      var spinBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎡 DREH DAS RAD' });

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([
          el('div', { class: 'roul-wrap' }, [
            el('div', { class: 'roul-ptr', text: '🔻' }),
            wheel,
            out
          ])
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:14px' }),
          el('div', { class: 'bet-label', text: 'WORAUF SETZT DU?' }),
          el('div', { style: 'height:8px' }),
          betTypes,
          el('div', { style: 'height:10px' }),
          el('div', { class: 'bet-label', text: 'ODER EINE EINZELNE ZAHL (32×)' }),
          el('div', { style: 'height:8px' }),
          numGrid,
          el('div', { style: 'height:12px' }),
          selLabel,
          el('div', { style: 'height:8px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          spinBtn
        ])
      ]);
      root.appendChild(stage);
      syncSel();

      function wins(n) {
        var c = colorOf(n);
        switch (selected.type) {
          case 'red': return c === 'red';
          case 'black': return c === 'black';
          case 'even': return n !== 0 && n % 2 === 0;
          case 'odd': return n % 2 === 1;
          case 'low': return n >= 1 && n <= 18;
          case 'high': return n >= 19 && n <= 36;
          case 'd1': return n >= 1 && n <= 12;
          case 'd2': return n >= 13 && n <= 24;
          case 'd3': return n >= 25 && n <= 36;
          case 'num': return n === selected.value;
        }
        return false;
      }

      function spin() {
        if (spinning || stopped) return;
        var stake = bet.value();
        if (!GK.wager(stake, 'Roulette')) return;

        spinning = true;
        spinBtn.disabled = true;
        bet.disable(true);
        out.className = 'roul-out';
        out.textContent = '…';
        GK.setResult(resultBox, 'Das Rad dreht sich…', '');
        GK.sfx('spin');

        // Ziel bestimmen (Admin-Luck darf nachhelfen)
        var idx = GK.rndInt(0, WHEEL.length - 1);
        if (GK.luckRoll(selected.type === 'num' ? 0.02 : 0.05)) {
          var candidates = [];
          for (var i = 0; i < WHEEL.length; i++) if (wins(WHEEL[i])) candidates.push(i);
          if (candidates.length) idx = GK.pick(candidates);
        }
        var num = WHEEL[idx];

        var center = idx * SEG + SEG / 2;
        var base = rot - (rot % 360);
        rot = base + 360 * 6 + (360 - center);
        wheel.style.transform = 'rotate(' + rot + 'deg)';

        var ticks = 0;
        var tickTimer = setInterval(function () {
          ticks++;
          GK.sfx('tick');
          if (ticks > 26) clearInterval(tickTimer);
        }, 190);

        setTimeout(function () {
          clearInterval(tickTimer);
          if (stopped) return;
          finish(num, stake);
        }, 5500);
      }

      function finish(num, stake) {
        out.className = 'roul-out ' + colorOf(num);
        out.textContent = num;

        var won = wins(num);
        var win = won ? Math.floor(stake * selected.mult) : 0;
        GK.payout(win, { stake: stake });
        GK.logPlay('Neon Roulette', stake, win);

        if (won) {
          GK.setResult(resultBox, num + ' — ' + selected.label + ' trifft! +' + GK.fmt(win - stake), 'win');
          GK.celebrate(win - stake, selected.mult);
        } else {
          GK.setResult(resultBox, num + ' (' + colorOf(num) + ') — kein Treffer', 'lose');
          GK.sfx('lose');
          GK.shake(out.parentElement);
        }
        spinning = false;
        spinBtn.disabled = false;
        bet.disable(false);
      }

      spinBtn.addEventListener('click', function () { GK.sfx('click'); spin(); });
      return function () { stopped = true; };
    }
  });
})(window.GK);
