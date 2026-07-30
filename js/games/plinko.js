/* ═══════════ 9. PLINKO PALAST ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var ROWS = 12;
  var RISKS = {
    low:  { label: '😌 Chill',  mults: [4, 2, 1.5, 1.2, 1.05, 0.95, 0.4, 0.95, 1.05, 1.2, 1.5, 2, 4] },
    mid:  { label: '😎 Normal', mults: [15, 6, 3, 1.5, 1, 0.7, 0.4, 0.7, 1, 1.5, 3, 6, 15] },
    high: { label: '🤯 Irre',   mults: [40, 18, 6, 3, 0.5, 0.3, 0.15, 0.3, 0.5, 3, 6, 18, 40] }
  };

  function multColor(m) {
    if (m >= 15) return '#ffd12e';
    if (m >= 3) return '#ff8a00';
    if (m >= 1.1) return '#7cff3b';
    if (m >= 1) return '#00e5ff';
    return '#ff3b6b';
  }

  GK.registerGame({
    id: 'plinko',
    name: 'Plinko Palast',
    emoji: '🔻',
    icon: 'plinko',
    blurb: 'Kugel rein, Nerven raus. 12 Reihen Chaos entscheiden, wo dein Einsatz landet.',
    badge: 'BIS 40×',
    color: '#ff8a00',
    rules: [
      'Die Kugel fällt durch <b>12 Reihen</b> Pins und landet in einem der 13 Fächer.',
      'Der Multiplikator des Fachs wird mit deinem Einsatz verrechnet.',
      'Die <b>Ränder</b> zahlen am meisten — dorthin kommt die Kugel aber am seltensten.',
      'Drei Risikostufen: <b>Chill</b>, <b>Normal</b> und <b>Irre</b>. Höheres Risiko = extremere Ränder.',
      'Du kannst mehrere Kugeln gleichzeitig fallen lassen.'
    ],
    mount: function (root) {
      var stopped = false, risk = 'mid', raf = null, balls = [];

      var bet = GK.betPanel({ start: 20 });
      var canvas = el('canvas');
      var board = el('div', { class: 'plinko-board' }, [canvas]);
      var bucketRow = el('div', { class: 'plinko-buckets' });
      var bucketEls = [];

      var riskBtns = [];
      var riskPick = el('div', { class: 'risk-pick' }, Object.keys(RISKS).map(function (k) {
        var b = el('button', { class: 'rbet' + (k === 'mid' ? ' sel' : ''), text: RISKS[k].label });
        b.addEventListener('click', function () { risk = k; syncRisk(); GK.sfx('chip'); });
        riskBtns.push({ k: k, b: b });
        return b;
      }));

      var resultBox = GK.resultBox();
      var dropBtn = el('button', { class: 'btn btn-gold btn-full', text: '🔻 KUGEL FALLEN LASSEN' });

      function syncRisk() {
        riskBtns.forEach(function (o) { o.b.classList.toggle('sel', o.k === risk); });
        buildBuckets();
      }

      function buildBuckets() {
        bucketRow.innerHTML = '';
        bucketEls = [];
        RISKS[risk].mults.forEach(function (m) {
          var b = el('div', { class: 'pb', text: m + '×' });
          b.style.color = multColor(m);
          b.style.borderColor = multColor(m);
          bucketRow.appendChild(b);
          bucketEls.push(b);
        });
      }

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [board, bucketRow]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'bet-label', text: 'RISIKO' }),
          el('div', { style: 'height:6px' }),
          riskPick,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          dropBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Bei <b>Irre</b> zahlen die Außenfächer 40× — die Mitte frisst dafür fast alles.' })
        ])
      ]);
      root.appendChild(stage);
      syncRisk();

      var ctx = canvas.getContext('2d');
      var geom = { cx: 0, top: 0, rowH: 0, gap: 0 };

      function resize() {
        var r = board.getBoundingClientRect();
        canvas.width = Math.max(280, r.width) * 2;
        canvas.height = Math.max(280, r.height) * 2;
        geom.cx = canvas.width / 2;
        geom.top = canvas.height * 0.08;
        geom.rowH = (canvas.height * 0.84) / ROWS;
        // exakt so breit wie ein Fach: Landepunkt und markiertes Fach liegen damit übereinander
        geom.gap = canvas.width / (ROWS + 1);
        drawStatic();
      }
      setTimeout(resize, 60);
      window.addEventListener('resize', resize);

      function posOf(row, k) {
        return {
          x: geom.cx + (k - row / 2) * geom.gap,
          y: geom.top + row * geom.rowH
        };
      }

      function drawStatic() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var r = 0; r < ROWS; r++) {
          var count = r + 2;
          for (var j = 0; j < count; j++) {
            var x = geom.cx + (j - (count - 1) / 2) * geom.gap;
            var y = geom.top + (r + 0.5) * geom.rowH;
            var glow = (r + j) % 3;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(3, geom.gap * 0.09), 0, Math.PI * 2);
            ctx.fillStyle = glow === 0 ? '#ff2fd0' : (glow === 1 ? '#00e5ff' : '#ffd12e');
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      function drawBalls() {
        drawStatic();
        balls.forEach(function (b) {
          var a = posOf(b.row, b.k);
          var t = b.t;
          var next = posOf(b.row + 1, b.k + b.dir);
          var x = a.x + (next.x - a.x) * t;
          var y = a.y + (next.y - a.y) * t - Math.sin(t * Math.PI) * geom.rowH * 0.32;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, geom.gap * 0.24), 0, Math.PI * 2);
          var g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, Math.max(6, geom.gap * 0.24));
          g.addColorStop(0, '#fff6b0');
          g.addColorStop(1, '#ff8a00');
          ctx.fillStyle = g;
          ctx.shadowColor = '#ffd12e';
          ctx.shadowBlur = 26;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }

      var lastTs = 0;
      var ROWS_PER_SEC = 4.5; // zeitbasiert, damit es auf jedem Bildschirm gleich schnell fällt

      function loop(ts) {
        if (stopped) return;
        if (!lastTs) lastTs = ts;
        var step = Math.min(0.25, (ts - lastTs) / 1000) * ROWS_PER_SEC;
        lastTs = ts;

        for (var i = balls.length - 1; i >= 0; i--) {
          var b = balls[i];
          b.t += step;
          var landed = false;
          while (b.t >= 1) {
            b.t -= 1;
            b.k += b.dir;
            b.row++;
            GK.sfx('tick');
            if (b.row >= ROWS) {
              land(b);
              balls.splice(i, 1);
              landed = true;
              break;
            }
            b.dir = nextDir(b);
          }
          if (landed) continue;
        }
        drawBalls();
        if (balls.length) raf = requestAnimationFrame(loop);
        else { raf = null; lastTs = 0; drawStatic(); }
      }

      function nextDir(b) {
        // leichter Drall Richtung Rand, wenn der Admin dem Spieler Glück geschenkt hat
        var p = 0.5;
        var pl = GK.player();
        if (pl && pl.luck > 50) {
          var pull = ((pl.luck - 50) / 50) * 0.22;
          p = b.k > b.row / 2 ? 0.5 + pull : 0.5 - pull;
        }
        return Math.random() < p ? 1 : 0;
      }

      function land(b) {
        var mults = RISKS[b.risk].mults;
        var idx = GK.clamp(b.k, 0, mults.length - 1);
        var mult = mults[idx];
        var win = Math.floor(b.stake * mult);

        GK.payout(win, { stake: b.stake });
        GK.logPlay('Plinko', b.stake, win);

        var be = bucketEls[idx];
        if (be) {
          be.classList.add('hit');
          setTimeout(function () { be.classList.remove('hit'); }, 500);
        }

        if (win > b.stake) {
          GK.setResult(resultBox, mult + '× — +' + GK.fmt(win - b.stake) + ' Chips!', 'win');
          GK.celebrate(win - b.stake, mult);
        } else if (win === b.stake) {
          GK.setResult(resultBox, mult + '× — Einsatz zurück', 'push');
          GK.sfx('coin');
        } else {
          GK.setResult(resultBox, mult + '× — nur ' + GK.fmt(win) + ' von ' + GK.fmt(b.stake) + ' zurück', 'lose');
          GK.sfx('lose');
        }
      }

      function drop() {
        if (stopped) return;
        var stake = bet.value();
        if (!GK.wager(stake, 'Plinko')) return;
        if (balls.length > 12) return;

        var b = { row: 0, k: 0, t: 0, dir: 0, stake: stake, risk: risk };
        b.dir = nextDir(b);
        balls.push(b);
        GK.sfx('chip');
        if (!raf) { lastTs = 0; raf = requestAnimationFrame(loop); }
      }

      dropBtn.addEventListener('click', function () { GK.sfx('click'); drop(); });

      return function () {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      };
    }
  });
})(window.GK);
