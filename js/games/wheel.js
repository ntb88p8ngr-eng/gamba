/* ═══════════ 8. RAD DES SCHICKSALS ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // 20 Segmente, gemischt angeordnet
  var SEGS = [0, 1, 0, 2, 0, 0.5, 1.5, 0, 5, 0, 0, 0, 2, 0.5, 2, 0, 1, 1.5, 0, 0.5];
  var STEP = 360 / SEGS.length;

  function colorFor(m) {
    if (m === 0) return '#2b0a4d';
    if (m <= 0.5) return '#3b7bff';
    if (m <= 1) return '#8b3bff';
    if (m <= 1.5) return '#00e5ff';
    if (m <= 2) return '#7cff3b';
    if (m <= 3) return '#ff8a00';
    return '#ffd12e';
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function buildWheel() {
    var svg = svgEl('svg', { viewBox: '0 0 100 100', width: '100%', height: '100%' });
    var R = 50, cx = 50, cy = 50;
    SEGS.forEach(function (m, i) {
      var a0 = (-90 + i * STEP) * Math.PI / 180;
      var a1 = (-90 + (i + 1) * STEP) * Math.PI / 180;
      var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
      var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      svg.appendChild(svgEl('path', {
        d: 'M' + cx + ',' + cy + ' L' + x0.toFixed(2) + ',' + y0.toFixed(2) +
           ' A' + R + ',' + R + ' 0 0 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' Z',
        fill: colorFor(m), stroke: 'rgba(255,255,255,.3)', 'stroke-width': '.5'
      }));
      var mid = -90 + (i + 0.5) * STEP;
      var tr = 38;
      var tx = cx + tr * Math.cos(mid * Math.PI / 180);
      var ty = cy + tr * Math.sin(mid * Math.PI / 180);
      var t = svgEl('text', {
        x: tx.toFixed(2), y: ty.toFixed(2), fill: m === 0 ? '#8b7bb8' : '#fff',
        'font-size': m >= 5 ? '7' : '5.4', 'font-family': 'Bungee, sans-serif',
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        transform: 'rotate(' + (mid + 90).toFixed(2) + ',' + tx.toFixed(2) + ',' + ty.toFixed(2) + ')'
      });
      t.textContent = m === 0 ? '☠' : m + '×';
      svg.appendChild(t);
    });
    return svg;
  }

  GK.registerGame({
    id: 'wheel',
    name: 'Rad des Schicksals',
    emoji: '🎡',
    icon: 'fortune',
    blurb: 'Ein Dreh, ein Schicksal. Zwischen Totenkopf und 5× liegt nur ein bisschen Karma.',
    badge: 'BIS 5×',
    color: '#7cff3b',
    rules: [
      'Ein Klick, ein Dreh — das Rad landet auf einem <b>Multiplikator</b>.',
      '<b>☠ Totenkopf</b> bedeutet: Einsatz weg. Davon gibt es die meisten Felder.',
      '<b>1×</b> gibt genau deinen Einsatz zurück, alles darüber ist Profit.',
      'Das goldene <b>5×</b>-Feld gibt es nur ein einziges Mal auf dem Rad.'
    ],
    mount: function (root) {
      var stopped = false, spinning = false, rot = 0;

      var bet = GK.betPanel({ start: 25 });
      var wheel = el('div', { class: 'wheel' }, [buildWheel(), el('div', { class: 'wheel-hub', text: '🎡' })]);
      var resultBox = GK.resultBox();
      var spinBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎡 SCHICKSAL DREHEN' });

      var tiers = [
        { m: 0, t: '☠ Nichts' }, { m: 0.5, t: '0,5× Trost' }, { m: 1, t: '1× zurück' },
        { m: 1.5, t: '1,5×' }, { m: 2, t: '2×' }, { m: 5, t: '5× Jackpot' }
      ];
      var legend = el('div', { class: 'wheel-legend' }, tiers.map(function (x) {
        var count = SEGS.filter(function (s) { return s === x.m; }).length;
        return el('div', { class: 'wl-item' }, [
          el('span', { class: 'wl-dot', style: 'background:' + colorFor(x.m) }),
          el('span', { text: x.t + ' (' + count + ')' })
        ]);
      }));

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([
          el('div', { class: 'wheel-wrap' }, [
            el('div', { class: 'wheel-ptr', text: '🔻' }),
            wheel
          ])
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          legend,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          spinBtn
        ])
      ]);
      root.appendChild(stage);

      function spin() {
        if (spinning || stopped) return;
        var stake = bet.value();
        if (!GK.wager(stake, 'Wheel')) return;

        spinning = true;
        spinBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, 'Das Schicksal dreht…', '');
        GK.sfx('spin');

        var idx = GK.rndInt(0, SEGS.length - 1);
        if (GK.luckRoll(0.08)) {
          var good = [];
          SEGS.forEach(function (m, i) { if (m >= 1.5) good.push(i); });
          if (good.length) idx = GK.pick(good);
        }

        var center = idx * STEP + STEP / 2;
        var base = rot - (rot % 360);
        rot = base + 360 * 7 + (360 - center);
        wheel.style.transform = 'rotate(' + rot + 'deg)';

        var ticks = 0;
        var iv = setInterval(function () {
          ticks++; GK.sfx('tick');
          if (ticks > 28) clearInterval(iv);
        }, 180);

        setTimeout(function () {
          clearInterval(iv);
          if (stopped) return;
          finish(SEGS[idx], stake);
        }, 5700);
      }

      function finish(mult, stake) {
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        GK.logPlay('Rad des Schicksals', stake, win);

        if (mult === 0) {
          GK.setResult(resultBox, '☠ Totenkopf — das Schicksal ist grausam', 'lose');
          GK.sfx('lose');
          GK.shake(wheel.parentElement);
        } else if (win > stake) {
          GK.setResult(resultBox, mult + '× — +' + GK.fmt(win - stake) + ' Chips!', 'win');
          GK.celebrate(win - stake, mult);
          if (mult >= 5) GK.emojiRain(['🎉', '👑', '💰'], 26);
        } else if (win === stake) {
          GK.setResult(resultBox, '1× — Einsatz zurück, nichts passiert', 'push');
          GK.sfx('coin');
        } else {
          GK.setResult(resultBox, mult + '× — nur ' + GK.fmt(win) + ' zurück', 'push');
          GK.sfx('coin');
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
