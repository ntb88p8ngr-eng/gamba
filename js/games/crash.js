/* ═══════════ 6. RAKETEN-CRASH ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  GK.registerGame({
    id: 'crash',
    name: 'Raketen-Crash',
    emoji: '🚀',
    blurb: 'Der Multiplikator steigt und steigt. Cash out bevor die Rakete explodiert — oder verlier alles.',
    badge: '∞ RISIKO',
    color: '#ff3b6b',
    rules: [
      'Setze Chips und starte die Rakete. Der <b>Multiplikator</b> steigt immer weiter.',
      'Drücke <b>CASH OUT</b> bevor sie crasht — du bekommst Einsatz × Multiplikator.',
      'Crasht sie vorher, ist der Einsatz weg. Der Crash kann <b>jederzeit</b> passieren.',
      'Mit <b>Auto-Cashout</b> steigst du automatisch bei deinem Wunsch-Multiplikator aus.'
    ],
    mount: function (root) {
      var stopped = false, running = false, raf = null;
      var startTime = 0, crashAt = 0, mult = 1, stake = 0, cashedAt = 0;
      var history = [];

      var bet = GK.betPanel({ start: 25 });

      var canvas = el('canvas');
      var multEl = el('div', { class: 'crash-mult', text: '1.00×' });
      var rocket = el('div', { class: 'crash-rocket', text: '🚀' });
      var screen = el('div', { class: 'crash-screen' }, [canvas, multEl, rocket]);
      var histBar = el('div', { class: 'crash-hist' });

      var autoInput = el('input', { class: 'input', type: 'number', step: '0.1', min: '1.1', value: '2.0' });
      var autoToggle = el('button', { class: 'chip-btn', text: '🤖 AUTO AUS' });
      var autoOn = false;

      var startBtn = el('button', { class: 'btn btn-gold btn-full', text: '🚀 RAKETE STARTEN' });
      var cashBtn = el('button', { class: 'btn btn-lime btn-full', text: '💰 CASH OUT' });
      cashBtn.disabled = true;
      var resultBox = GK.resultBox();

      autoToggle.addEventListener('click', function () {
        autoOn = !autoOn;
        autoToggle.textContent = autoOn ? '🤖 AUTO AN' : '🤖 AUTO AUS';
        autoToggle.style.borderColor = autoOn ? 'var(--lime)' : '';
        GK.sfx('chip');
      });

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [
          screen,
          el('div', { style: 'height:10px' }),
          el('div', { class: 'bet-label', text: 'LETZTE RUNDEN' }),
          el('div', { style: 'height:6px' }),
          histBar
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'bet-label', text: 'AUTO-CASHOUT BEI' }),
          el('div', { style: 'height:6px' }),
          el('div', { class: 'bet-row' }, [autoInput, autoToggle]),
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          startBtn,
          el('div', { style: 'height:8px' }),
          cashBtn
        ])
      ]);
      root.appendChild(stage);

      var ctx = canvas.getContext('2d');
      var points = [];

      function resize() {
        var r = screen.getBoundingClientRect();
        canvas.width = Math.max(300, r.width) * 2;
        canvas.height = Math.max(180, r.height) * 2;
      }
      setTimeout(resize, 60);
      window.addEventListener('resize', resize);

      function draw() {
        if (!ctx) return;
        var W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Sterne-Hintergrund
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        for (var i = 0; i < 40; i++) {
          var sx = (i * 137.5) % W, sy = (i * 91.7) % H;
          ctx.fillRect(sx, sy, 3, 3);
        }
        // Gitter
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.lineWidth = 2;
        for (var g = 1; g < 5; g++) {
          ctx.beginPath(); ctx.moveTo(0, H * g / 5); ctx.lineTo(W, H * g / 5); ctx.stroke();
        }

        if (points.length < 2) return;
        var maxT = Math.max(4000, points[points.length - 1].t);
        var maxM = Math.max(2, points[points.length - 1].m);

        function px(p) { return (p.t / maxT) * (W * 0.92) + W * 0.04; }
        function py(p) { return H - ((Math.log(p.m) / Math.log(maxM)) * (H * 0.84) + H * 0.08); }

        // Fläche unter der Kurve
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, running ? 'rgba(124,255,59,.42)' : 'rgba(255,59,107,.42)');
        grad.addColorStop(1, 'rgba(124,255,59,0)');
        ctx.beginPath();
        ctx.moveTo(px(points[0]), H);
        points.forEach(function (p) { ctx.lineTo(px(p), py(p)); });
        ctx.lineTo(px(points[points.length - 1]), H);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Kurve
        ctx.beginPath();
        points.forEach(function (p, i) { i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p)); });
        ctx.strokeStyle = running ? '#7cff3b' : '#ff3b6b';
        ctx.lineWidth = 7;
        ctx.lineJoin = 'round';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 22;
        ctx.stroke();
        ctx.shadowBlur = 0;

        var last = points[points.length - 1];
        var rx = px(last) / 2, ry = py(last) / 2;
        rocket.style.left = (rx - 16) + 'px';
        rocket.style.top = (ry - 20) + 'px';
      }

      function pushHistory(v) {
        history.unshift(v);
        if (history.length > 12) history.pop();
        histBar.innerHTML = '';
        history.forEach(function (h) {
          var cls = h < 2 ? 'low' : (h < 5 ? 'mid' : 'high');
          histBar.appendChild(el('div', { class: 'ch-pill ' + cls, text: h.toFixed(2) + '×' }));
        });
      }

      function rollCrash() {
        var u = Math.random();
        if (u < 0.01) return 1.00; // Sofort-Crash
        var c = 0.99 / (1 - u);
        // Admin-Luck schiebt den Crashpunkt nach oben
        var p = GK.player();
        if (p && p.luck > 50) c *= 1 + ((p.luck - 50) / 50) * 0.8;
        if (p && p.luck < 50) c *= 1 - ((50 - p.luck) / 50) * 0.5;
        return Math.max(1, Math.min(500, Math.floor(c * 100) / 100));
      }

      function loop() {
        if (!running || stopped) return;
        var now = performance.now();
        var elapsed = now - startTime;
        mult = Math.exp(0.00017 * elapsed);

        if (mult >= crashAt) {
          boom();
          return;
        }

        points.push({ t: elapsed, m: mult });
        if (points.length > 900) points.shift();
        multEl.textContent = mult.toFixed(2) + '×';
        draw();

        if (autoOn && !cashedAt) {
          var target = Number(autoInput.value) || 0;
          if (target >= 1.01 && mult >= target) { cashOut(); return; }
        }
        if (Math.floor(elapsed / 700) !== Math.floor((elapsed - 16) / 700)) GK.sfx('rocket');

        raf = requestAnimationFrame(loop);
      }

      function start() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Crash')) return;

        running = true;
        cashedAt = 0;
        crashAt = rollCrash();
        mult = 1;
        points = [{ t: 0, m: 1 }];
        startTime = performance.now();
        startBtn.disabled = true;
        cashBtn.disabled = false;
        bet.disable(true);
        multEl.className = 'crash-mult';
        multEl.textContent = '1.00×';
        GK.setResult(resultBox, 'Abflug! Nicht zu gierig werden…', '');
        GK.sfx('spin');
        resize();
        raf = requestAnimationFrame(loop);
      }

      function cashOut() {
        if (!running || cashedAt) return;
        cashedAt = mult;
        running = false;
        if (raf) cancelAnimationFrame(raf);
        draw();

        var win = Math.floor(stake * cashedAt);
        GK.payout(win, { stake: stake });
        GK.logPlay('Raketen-Crash', stake, win);
        multEl.className = 'crash-mult cashed';
        multEl.textContent = cashedAt.toFixed(2) + '× ✅';
        GK.setResult(resultBox, 'Ausgestiegen bei ' + cashedAt.toFixed(2) + '× → +' + GK.fmt(win - stake), 'win');
        GK.celebrate(win - stake, cashedAt);
        pushHistory(crashAt);
        reset();
      }

      function boom() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        mult = crashAt;
        points.push({ t: performance.now() - startTime, m: crashAt });
        draw();
        multEl.className = 'crash-mult boom';
        multEl.textContent = '💥 ' + crashAt.toFixed(2) + '×';
        rocket.textContent = '💥';
        GK.payout(0, { stake: stake });
        GK.logPlay('Raketen-Crash', stake, 0);
        GK.setResult(resultBox, 'CRASH bei ' + crashAt.toFixed(2) + '× — Einsatz verglüht 💀', 'lose');
        GK.sfx('boom');
        GK.shake(screen, true);
        pushHistory(crashAt);
        setTimeout(function () { if (!stopped) rocket.textContent = '🚀'; }, 1400);
        reset();
      }

      function reset() {
        startBtn.disabled = false;
        cashBtn.disabled = true;
        bet.disable(false);
      }

      startBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('click'); cashOut(); });

      return function () {
        stopped = true;
        running = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      };
    }
  });
})(window.GK);
