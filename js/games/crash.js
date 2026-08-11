/* ═══════════ 6. RAKETEN-CRASH ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  GK.registerGame({
    id: 'crash',
    name: 'Raketen-Crash',
    emoji: '🚀',
    icon: 'rocket',
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
      var rocket = el('div', { class: 'crash-rocket idle', html: GK.iconHTML('rocket') });
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
      var zigSeed = 0, zigRate = 3;
      var ROCKET_ART_ANGLE = 45;

      /* Zickzack: zwei ungleich schnelle Dreieckswellen, deren Ausschlag mit dem
         Multiplikator wächst. Der Wert wird beim Anlegen des Punktes eingefroren,
         damit die schon gezeichnete Linie stehen bleibt und nicht mitzappelt.

         Die Phase läuft über log(t), nicht über t: die Zeitachse wird mit jeder
         Sekunde weiter gestaucht, eine feste Periode in Millisekunden würde bei
         langen Flügen zum Sägeblatt zusammenlaufen. Logarithmisch wächst die
         Wellenlänge im gleichen Maß mit und bleibt auf dem Schirm konstant. */
      function tri(phase) {
        var x = ((phase % 1) + 1) % 1;
        return 4 * Math.abs(x - 0.5) - 1;
      }
      function pushPoint(t, m) {
        var strength = Math.min(1, (m - 1) / 5);
        var lt = Math.log(Math.max(400, t)) * zigRate;
        var z = (tri(lt + zigSeed) * 0.62 + tri(lt * 0.57 + zigSeed * 1.7) * 0.38) * strength;
        points.push({ t: t, m: m, z: z });
      }

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
        var last = points[points.length - 1];
        var maxT = Math.max(4000, last.t);
        /* Kopffreiheit: die Skala reicht deutlich über den aktuellen Multiplikator
           hinaus, sonst klebt die Spitze der Kurve immer am oberen Rand. */
        var maxM = Math.max(2.4, last.m * 1.55);

        function px(p) { return (p.t / maxT) * (W * 0.84) + W * 0.05; }
        function py(p) {
          var f = Math.min(1, Math.log(p.m) / Math.log(maxM));
          return H - (f * (H * 0.70) + H * 0.10) + p.z * (H * 0.05);
        }

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

        var rx = px(last) / 2, ry = py(last) / 2;
        /* Das gemalte Raketen-Icon zeigt schon von Haus aus schräg nach rechts
           oben (rund 45° aus der Senkrechten). Diese Eigenneigung muss raus,
           sonst kippt die Rakete um 45° zu weit und fliegt quer. */
        var prev = points[Math.max(0, points.length - 6)];
        var path = Math.atan2(py(last) - py(prev), px(last) - px(prev)) * 180 / Math.PI;
        var tilt = path + 90 - ROCKET_ART_ANGLE;
        tilt = Math.max(-30, Math.min(55, tilt));

        /* Je höher der Multiplikator, desto stärker rüttelt die Rakete. */
        var amp = running ? Math.min(7, (last.m - 1) * 1.3) : 0;
        var jx = (Math.random() - 0.5) * 2 * amp;
        var jy = (Math.random() - 0.5) * 2 * amp;
        var jr = (Math.random() - 0.5) * 2 * amp * 1.6;

        rocket.style.left = rx + 'px';
        rocket.style.top = ry + 'px';
        /* Erst jetzt sichtbar machen: ohne left/top saesse sie auf 0,0 und
           lugte vor dem Start halb aus der linken oberen Ecke. */
        rocket.classList.remove('idle');
        rocket.style.transform =
          'translate(-50%,-50%) translate(' + jx.toFixed(1) + 'px,' + jy.toFixed(1) + 'px) ' +
          'rotate(' + (tilt + jr).toFixed(1) + 'deg)';
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
        if (u < 0.04) return 1.00; // Sofort-Crash
        var c = 0.92 / (1 - u);
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

        pushPoint(elapsed, mult);
        /* Nicht vorne abschneiden — der erste Punkt (t=0, m=1) ist der Anker
           unten links. Fiel er weg, wanderte die ganze Kurve mit der Rakete
           nach oben rechts. Stattdessen ausdünnen und Punkt 0 behalten. */
        if (points.length > 4000) {
          var thin = [];
          for (var i = 0; i < points.length; i += 2) thin.push(points[i]);
          points = thin;
        }
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
        zigSeed = Math.random();
        zigRate = 2.4 + Math.random() * 1.5;
        points = [];
        pushPoint(0, 1);
        rocket.classList.remove('boom');
        rocket.innerHTML = GK.iconHTML('rocket');
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
        pushPoint(performance.now() - startTime, crashAt);
        draw();
        multEl.className = 'crash-mult boom';
        multEl.textContent = '💥 ' + crashAt.toFixed(2) + '×';
        rocket.classList.add('boom');
        rocket.textContent = '💥';
        GK.payout(0, { stake: stake });
        GK.logPlay('Raketen-Crash', stake, 0);
        GK.setResult(resultBox, 'CRASH bei ' + crashAt.toFixed(2) + '× — Einsatz verglüht 💀', 'lose');
        GK.sfx('boom');
        GK.shake(screen, true);
        pushHistory(crashAt);
        setTimeout(function () {
          if (stopped) return;
          rocket.classList.remove('boom');
          rocket.innerHTML = GK.iconHTML('rocket');
        }, 1400);
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
