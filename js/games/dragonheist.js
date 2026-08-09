/* ═══════════ 18. SMAUGS SCHATZ ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* Zehn Griffe in den Hort. Die Erfolgschance sinkt mit jedem Griff — der
     Drache wird wacher, je tiefer man vordringt. Die Multiplikatoren sind so
     gerechnet, dass jeder Ausstiegspunkt bei rund 87 % Auszahlungsquote liegt:
     M(k) = 0.87 / Π(P[0..k-1]). Fest verdrahtet statt live berechnet, damit
     sich die Quote ohne Browser nachrechnen lässt (siehe Simulation im Test). */
  var PROB  = [0.93, 0.90, 0.87, 0.83, 0.79, 0.74, 0.69, 0.63, 0.57, 0.50];
  var MULTS = [0.94, 1.04, 1.19, 1.44, 1.82, 2.46, 3.57, 5.66, 9.94, 19.87];
  var STEPS = PROB.length;

  var HOARD_ICONS = ['coin', 'coin', 'gem', 'coin', 'gem', 'crown', 'gem', 'crown', 'gem', 'crown'];

  function fmtM(m) { return (Math.round(m * 100) / 100).toFixed(2) + '×'; }

  GK.registerGame({
    id: 'dragonheist',
    name: 'Smaugs Schatz',
    emoji: '🐉',
    icon: 'dragonred',
    blurb: 'Schleich dich an den schlafenden Drachen heran und greif dir sein Gold — Griff für Griff wird er wacher.',
    badge: 'BIS 19,87×',
    color: '#ff8a00',
    minLevel: 30,
    rules: [
      'Du schleichst dich an einen schlafenden Drachen heran und greifst <b>Griff für Griff</b> nach seinem Gold.',
      'Jeder Griff erhöht den <b>Multiplikator</b> — aber auch die Chance, dass der Drache erwacht.',
      'Nach jedem geglückten Griff kannst du <b>aussteigen</b> und den Schatz sichern.',
      'Erwacht der Drache, <b>verbrennt sein Feuer</b> dich und den ganzen Einsatz — sofort, ohne Vorwarnung.',
      'Der erste Griff gelingt mit 93 %, der zehnte und letzte nur noch mit 50 % — dafür zahlt er <b>19,87×</b>.',
      'Zehn geglückte Griffe leeren den Hort komplett — das zahlt automatisch aus.'
    ],
    mount: function (root) {
      var stopped = false, running = false, busy = false, step = 0, stake = 0;
      var timers = [];
      function wait(ms, fn) {
        var t = setTimeout(function () { if (!stopped) fn(); }, ms);
        timers.push(t);
        return t;
      }

      var bet = GK.betPanel({ start: 25 });
      var resultBox = GK.resultBox();

      /* ── Szene ── */
      var eyeL = el('span', { class: 'hst-eye l' });
      var eyeR = el('span', { class: 'hst-eye r' });
      var dragon = el('div', { class: 'hst-dragon', html: GK.iconHTML('dragonred') }, );
      dragon.appendChild(eyeL);
      dragon.appendChild(eyeR);

      var hoard = el('div', { class: 'hst-hoard' });
      var thief = el('div', { class: 'hst-thief', html:
        '<svg viewBox="0 0 40 56" width="100%" height="100%">' +
          '<path d="M20 2 C28 2 33 8 33 16 L33 24 C33 26 31 27 29 26 L29 20 C29 13 25 8 20 8 ' +
          'C15 8 11 13 11 20 L11 26 C9 27 7 26 7 24 L7 16 C7 8 12 2 20 2 Z" fill="#1a0f2e" stroke="#0a0518" stroke-width="1.6"/>' +
          '<ellipse cx="20" cy="19" rx="9" ry="10" fill="#241640"/>' +
          '<circle cx="16.5" cy="18" r="1.6" fill="#ffd12e"/><circle cx="23.5" cy="18" r="1.6" fill="#ffd12e"/>' +
          '<path d="M13 30 C13 26 16 24 20 24 C24 24 27 26 27 30 L27 50 C27 52 25 54 20 54 C15 54 13 52 13 50 Z" ' +
            'fill="#2e1b52" stroke="#0a0518" stroke-width="1.6"/>' +
          '<path d="M13 34 L27 34 M13 40 L27 40" stroke="#0a0518" stroke-width="1.2" opacity=".5"/>' +
        '</svg>'
      });

      var trackWrap = el('div', { class: 'hst-track-wrap' }, [
        el('div', { class: 'hst-track' }, HOARD_ICONS.map(function (ic, i) {
          return el('div', { class: 'hst-step', html: GK.iconHTML(ic) });
        }))
      ]);

      var scene = el('div', { class: 'hst-scene' }, [
        el('div', { class: 'hst-glow' }),
        dragon,
        el('div', { class: 'hst-mist' }),
        hoard,
        thief,
        trackWrap,
        el('div', { class: 'hst-fire' })
      ]);

      var stepInfo = el('div', { class: 'hst-info', text: 'Der Drache schläft tief.' });

      var multBox = el('div', { class: 'info-box' }, [el('b', { text: '1.00×' }), el('span', { text: 'Aktuell' })]);
      var nextBox = el('div', { class: 'info-box' }, [el('b', { text: MULTS[0].toFixed(2) + '×' }), el('span', { text: 'Nächster' })]);
      var riskBox = el('div', { class: 'info-box' }, [el('b', { text: Math.round((1 - PROB[0]) * 100) + '%' }), el('span', { text: 'Weckchance' })]);
      var cashBox = el('div', { class: 'info-box' }, [el('b', { text: '0' }), el('span', { text: 'Sicherbar' })]);

      var goBtn = el('button', { class: 'btn btn-gold btn-full', text: '🐉 IN DEN HORT SCHLEICHEN' });
      var grabBtn = el('button', { class: 'btn', text: '🪙 GOLD GREIFEN' });
      var cashBtn = el('button', { class: 'btn btn-lime', text: '💰 SCHATZ SICHERN' });
      var actions = el('div', { class: 'bj-actions' }, [grabBtn, cashBtn]);

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([scene, el('div', { style: 'height:10px' }), stepInfo]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'info-grid' }, [multBox, nextBox, riskBox, cashBox]),
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          goBtn,
          el('div', { style: 'height:8px' }),
          actions,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Jeder Griff senkt die Erfolgschance für den nächsten — irgendwann lohnt sich Aussteigen mehr als Gier. Bei 10 Griffen ist der Hort leer und zahlt automatisch aus.' })
        ])
      ]);
      root.appendChild(stage);

      /* ── Darstellung ── */

      function sync() {
        goBtn.disabled = running;
        grabBtn.disabled = !running || busy || step >= STEPS;
        cashBtn.disabled = !running || busy || step === 0;
        bet.disable(running);

        var cur = step > 0 ? MULTS[step - 1] : 1;
        multBox.querySelector('b').textContent = fmtM(cur);
        if (step < STEPS) {
          nextBox.querySelector('b').textContent = fmtM(MULTS[step]);
          riskBox.querySelector('b').textContent = Math.round((1 - PROB[step]) * 100) + '%';
        } else {
          nextBox.querySelector('b').textContent = 'LEER';
          riskBox.querySelector('b').textContent = '—';
        }
        cashBox.querySelector('b').textContent = running && step > 0 ? GK.fmt(Math.floor(stake * cur)) : '0';
        cashBtn.textContent = step > 0
          ? '💰 SCHATZ SICHERN (' + GK.fmt(Math.floor(stake * cur)) + ')'
          : '💰 SCHATZ SICHERN';

        trackWrap.querySelectorAll('.hst-step').forEach(function (s, i) {
          s.classList.toggle('done', running && i < step);
          s.classList.toggle('here', running && i === step);
        });

        // Der Drache wird unruhiger, je tiefer man vordringt: Augen glimmen
        // stärker, das Knurren im Hintergrund pulsiert schneller.
        var tension = running ? step / STEPS : 0;
        dragon.style.setProperty('--tension', tension.toFixed(2));
        dragon.classList.toggle('stirring', running && step >= 3);
        dragon.classList.toggle('alert', running && step >= 7);
      }

      function layHoard(count) {
        hoard.innerHTML = '';
        for (var i = 0; i < count; i++) {
          var ic = HOARD_ICONS[Math.min(i, HOARD_ICONS.length - 1)];
          hoard.appendChild(el('span', {
            class: 'hst-coin',
            style: '--i:' + i + ';--r:' + GK.rnd(-16, 16).toFixed(1) + 'deg',
            html: GK.iconHTML(ic)
          }));
        }
      }

      /* ── Ablauf ── */

      function start() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Smaugs Schatz')) return;

        running = true; busy = false; step = 0;
        scene.classList.remove('caught');
        thief.classList.remove('burned');
        thief.style.left = '';
        layHoard(0);
        GK.setResult(resultBox, 'Du schleichst dich heran…', '');
        GK.sfx('whoosh');
        stepInfo.textContent = 'Der Drache schläft tief.';
        sync();
      }

      function grab() {
        if (!running || busy || stopped || step >= STEPS) return;
        busy = true;
        sync();

        var p = PROB[step];
        var ok = GK.luckRoll(p);
        thief.classList.add('reaching');
        GK.sfx('gem');

        if (step >= 3 && !ok) {
          // Erwischt: kurzes Knurren, bevor das Feuer kommt — mehr Nervenkitzel
          wait(140, function () { GK.sfx('growl'); });
        }

        wait(360, function () {
          thief.classList.remove('reaching');
          if (!ok) { caught(); return; }

          step++;
          layHoard(step);
          GK.sfx('coin');
          stepInfo.textContent = step + ' Griffe geschafft — ' + fmtM(MULTS[step - 1]) + '.';
          busy = false;
          sync();

          if (step >= STEPS) { wait(280, function () { cashOut(true); }); }
        });
      }

      function cashOut(auto) {
        if (!running || stopped) return;
        running = false; busy = false;
        var mult = step > 0 ? MULTS[step - 1] : 1;
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        GK.logPlay('Smaugs Schatz', stake, win);
        GK.setResult(resultBox,
          (auto ? '👑 Hort leergeräumt! ' : '') + step + ' Griffe · ' + fmtM(mult) +
          ' → ' + GK.fmtSigned(win - stake), 'win');
        GK.celebrate(win - stake, mult);
        if (auto) GK.emojiRain(['🐉', '💰', '👑'], 28);
        stepInfo.textContent = auto ? 'Der ganze Hort ist dein.' : 'Rechtzeitig zurückgeschlichen.';
        sync();
      }

      function caught() {
        running = false; busy = false;
        scene.classList.add('caught');
        thief.classList.add('burned');
        GK.payout(0, { stake: stake });
        GK.logPlay('Smaugs Schatz', stake, 0);
        GK.setResult(resultBox,
          'Der Drache erwacht bei Griff ' + (step + 1) + ' — Feuer! ' + GK.fmt(stake) + ' Chips verbrannt.', 'lose');
        GK.sfx('boom');
        GK.shake(scene, true);
        stepInfo.textContent = 'Von Smaugs Feuer erwischt.';
        wait(1500, function () {
          scene.classList.remove('caught');
          thief.classList.remove('burned');
          step = 0;
          layHoard(0);
        });
        sync();
      }

      goBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      grabBtn.addEventListener('click', grab);
      cashBtn.addEventListener('click', function () { GK.sfx('cash'); cashOut(false); });

      layHoard(0);
      sync();

      return function () {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    }
  });
})(window.GK);
