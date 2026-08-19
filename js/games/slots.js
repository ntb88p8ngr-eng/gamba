/* ═══════════ 1. FANTASY REELS (Slots) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* m3 = drei Gleiche, m2 = zwei Gleiche. Die Paare zahlen bewusst weniger
     als den Einsatz zurück — sie sind Trostpflaster, kein Gewinn. */
  var SYMS = [
    { id: 'cherry', name: 'Kirsche', w: 26, m3: 8,   m2: 0.5 },
    { id: 'clover', name: 'Klee',    w: 22, m3: 11,  m2: 0.7 },
    { id: 'bell',   name: 'Glocke',  w: 18, m3: 16,  m2: 0.8 },
    { id: 'star',   name: 'Stern',   w: 14, m3: 24,  m2: 1.0 },
    { id: 'dragon', icon: 'dragonhead', name: 'Drache', w: 10, m3: 35, m2: 1.3 },
    { id: 'gem',    name: 'Juwel',   w: 7,  m3: 50,  m2: 1.8 },
    { id: 'crown',  name: 'Krone',   w: 3,  m3: 100, m2: 3.0 }
  ];
  var TOTAL_W = SYMS.reduce(function (s, x) { return s + x.w; }, 0);

  /* ── Freispiele ──
     Der Stern ist zusaetzlich Ausloeser: drei davon bringen Freispiele, in
     denen jeder Gewinn doppelt zaehlt. Waehrend der Freispiele kostet kein
     Dreh Chips, und drei Sterne verlaengern die Serie. */
  var SCATTER = 'star';
  var FREE_SPINS = 10;
  var FREE_MULT = 2;

  function randSym() {
    var r = Math.random() * TOTAL_W;
    for (var i = 0; i < SYMS.length; i++) { r -= SYMS[i].w; if (r <= 0) return SYMS[i]; }
    return SYMS[0];
  }

  /* Geschenkte Treffer — im Normalfall 0. Frühere Werte von 6 % bzw. 10 %
     haben die Auszahlungsquote auf über 160 % gehoben, der Automat hat also
     draufgezahlt. GK.luckRoll(0) ist bei neutralem Luck immer falsch, steigt
     aber mit dem Admin-Regler an: der Cheat bleibt, das Geschenk ist weg. */
  var FORCE_THREE = 0;
  var FORCE_PAIR = 0;

  /** Zieht das Walzenbild. */
  function drawOutcome() {
    var out = [randSym(), randSym(), randSym()];
    if (GK.luckRoll(FORCE_THREE)) { var s = randSym(); return [s, s, s]; }
    if (GK.luckRoll(FORCE_PAIR)) out[1] = out[0];
    return out;
  }

  /** Was ein Walzenbild zahlt: {mult, sym, three} — mult 0 heißt daneben. */
  function outcomeMult(out) {
    if (out[0].id === out[1].id && out[1].id === out[2].id) {
      return { mult: out[0].m3, sym: out[0], three: true };
    }
    var pair = null;
    if (out[0].id === out[1].id) pair = out[0];
    else if (out[1].id === out[2].id) pair = out[1];
    else if (out[0].id === out[2].id) pair = out[0];
    return pair ? { mult: pair.m2, sym: pair, three: false } : { mult: 0, sym: null, three: false };
  }

  GK.registerGame({
    id: 'slots',
    name: 'Fantasy Slots',
    emoji: '🎰',
    icon: 'slotmachine',
    blurb: 'Drei Walzen voller Drachen, Kronen und Kirschen. Drei Gleiche = Regen aus Chips.',
    badge: 'BIS 100×',
    color: '#ff2fd0',
    rules: [
      '<b>3 gleiche Symbole</b> auf der Linie zahlen den großen Multiplikator.',
      '<b>2 gleiche Symbole</b> geben nur einen Teil zurück (0,5× bis 3×) — meist weniger als der Einsatz.',
      'Die <b>Krone</b> ist der Jackpot: 100× deinen Einsatz.',
      'Auszahlung = Einsatz × Multiplikator.',
      '<b>3 Sterne</b> lösen <b>' + FREE_SPINS + ' Freispiele</b> aus: sie kosten nichts, und jeder Gewinn zählt <b>' + FREE_MULT + '×</b>.',
      'Drei Sterne im Freispiel <b>verlängern</b> die Serie um weitere ' + FREE_SPINS + '.'
    ],
    mount: function (root) {
      var stopped = false;
      /* Der gewünschte Einsatz wird getrennt gemerkt: bet.value() kappt auf das
         Guthaben, sonst würde der Automat im Endlos-Modus einfach mit immer
         kleineren Beträgen weiterdrehen statt zu stoppen. */
      var wantStake = 20;
      var bet = GK.betPanel({ start: 20, onChange: function (v) { wantStake = v; } });

      var reels = [], strips = [];
      for (var i = 0; i < 3; i++) {
        var strip = el('div', { class: 'strip' });
        var reel = el('div', { class: 'reel' }, [strip]);
        reels.push(reel); strips.push(strip);
      }

      function symIcon(s) { return GK.iconHTML(s.icon || s.id); }

      /* Wie weit der Streifen hochfaehrt, damit unten das Endsymbol steht —
         in Prozent der eigenen Hoehe, nicht in Pixeln. */
      function stopAt(len) { return ((len - 1) / len) * 100; }

      /**
       * Walze aufraeumen, sobald sie steht.
       *
       * Waehrend des Drehs haengt die Stellung an einem Transform. Der stimmt
       * im Moment des Haltens, aber er bleibt danach stehen: aendert sich
       * spaeter die Zellhoehe — Geraet drehen, zoomen, Adressleiste ein- und
       * ausblenden — passt er nicht mehr, und im Fenster steht das
       * Nachbarsymbol halb mit drin oder die Walze bleibt leer.
       *
       * Deshalb wird nach dem Halten umgeraeumt: das Endsymbol wandert in die
       * erste Zelle, der Streifen steht wieder auf 0. Danach gibt es nichts
       * mehr zu verschieben — im Fenster kann gar nichts anderes stehen als
       * dieses eine Symbol, bei jeder Groesse.
       */
      function settle(i, sym) {
        var strip = strips[i];
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.firstChild.innerHTML = symIcon(sym);
      }

      /* Die Walzensymbole sind jetzt Bilder statt Inline-SVG. Auf iOS Safari
         verliert der Compositor nach ein paar Spins das Bild komplett, wenn
         man bei jedem Dreh alle ~30 <div>+<img> wegwirft und neu baut, während
         gleichzeitig eine CSS-Transition auf demselben Element läuft — ein
         bekannter WebKit-Bug bei starkem DOM-Durchsatz auf transformierten
         Ebenen. Die Felder bleiben deshalb liegen; nur ihr Inhalt wird
         ausgetauscht (siehe auch .reel/.strip in games.css). */
      function fillStrip(strip, finalSym, len) {
        var cells = strip.children;
        while (cells.length < len) strip.appendChild(el('div', { class: 'sym' }));
        while (cells.length > len) strip.removeChild(strip.lastChild);
        /* Die erste Zelle bleibt, wie sie ist: dort steht seit settle() das
           Ergebnis des letzten Drehs, und genau das ist am Anfang zu sehen.
           Wuerde sie hier neu gewuerfelt, springt das Bild im Moment des
           Startens um. */
        for (var i = 1; i < len - 1; i++) cells[i].innerHTML = symIcon(randSym());
        cells[len - 1].innerHTML = symIcon(finalSym);
      }

      // Startbild
      strips.forEach(function (s) { fillStrip(s, randSym(), 1); });

      var lights = el('div', { class: 'slot-lights' });
      for (var L = 0; L < 9; L++) lights.appendChild(el('i'));

      var fsBanner = el('div', { class: 'fs-banner' }, [
        '🌟 FREISPIELE', el('b', { text: '0' }), '· ' + FREE_MULT + '× auf alles'
      ]);
      fsBanner.hidden = true;

      var machine = el('div', { class: 'slot-machine' }, [
        lights,
        el('div', { class: 'reels' }, reels.concat([el('div', { class: 'payline' })]))
      ]);

      var paytable = el('div', { class: 'paytable' },
        SYMS.slice().reverse().map(function (s) {
          return el('div', { class: 'pay-item' }, [
            el('span', { class: 's', html: symIcon(s) }),
            el('span', { class: 'm', text: s.m3 + '×' })
          ]);
        }));

      var resultBox = GK.resultBox();
      var spinBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎰 SPIN' });
      var autoBtn = el('button', { class: 'btn btn-ghost', text: '🔁 AUTO 10' });
      var loopBtn = el('button', { class: 'btn btn-ghost', text: '♾️ ENDLOS' });
      var autoRow = el('div', { class: 'auto-row' }, [autoBtn, loopBtn]);
      var autoLeft = 0, endless = false;

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [fsBanner, machine, paytable]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          spinBtn,
          el('div', { style: 'height:8px' }),
          autoRow,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Tipp: Die Krone zahlt <b>100×</b>. Zwei gleiche Symbole retten dir immerhin einen Teil vom Einsatz. <b>Endlos</b> dreht weiter, bis du stoppst oder die Chips alle sind.' })
        ])
      ]);
      root.appendChild(stage);

      var spinning = false;
      var freeLeft = 0, freeStake = 0;

      /** Wieviel zahlt dieses Bild — im Freispiel mit Aufschlag. */
      function winFor(out, stake, inFree) {
        return Math.floor(stake * outcomeMult(out).mult * (inFree ? FREE_MULT : 1));
      }
      function scatters(out) {
        return out.filter(function (x) { return x.id === SCATTER; }).length;
      }

      function spin() {
        if (spinning || stopped) return;
        var free = freeLeft > 0;
        /* Im Freispiel bleibt der Einsatz der der Ausloeserunde, es wird aber
           nichts abgebucht. */
        var stake = free ? freeStake : bet.value();
        if (!free && !GK.wager(stake, 'Slots')) { stopAuto(); return; }
        if (free) { freeLeft--; syncFree(); GK.sfx('freespin2'); }

        spinning = true;
        spinBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, free ? 'Freispiel läuft…' : 'Die Walzen drehen…', '');
        if (!free) GK.sfx('spin');

        // Ergebnis vorab würfeln (mit Luck-Bonus vom Admin)
        var out = drawOutcome();
        /* Der Ausgang steht damit fest — die Walzen zeigen ihn nur noch.
           Anmelden, damit ein Verlassen mitten im Dreh nichts umgeht.
           Freispiele kosten nichts, deshalb dort Einsatz 0. */
        GK.commitResult(winFor(out, stake, free), free ? 0 : stake);

        reels.forEach(function (r) { r.classList.remove('hit'); });

        var lens = [26, 32, 38];
        strips.forEach(function (strip, i) {
          fillStrip(strip, out[i], lens[i]);
          strip.style.transition = 'none';
          strip.style.transform = 'translateY(0)';
        });
        void strips[0].offsetWidth; // reflow

        strips.forEach(function (strip, i) {
          strip.style.transition = 'transform ' + (1.7 + i * 0.55) + 's cubic-bezier(.14,.72,.16,1)';
          strip.style.transform = 'translateY(-' + stopAt(lens[i]) + '%)';
        });

        [0, 1, 2].forEach(function (i) {
          setTimeout(function () {
            if (stopped) return;
            settle(i, out[i]);
            GK.sfx('reel');
            reels[i].classList.add('hit');
            setTimeout(function () { reels[i].classList.remove('hit'); }, 400);

            /* Stehen nach der zweiten Walze zwei Sterne, haengt der Bonus an
               der letzten — das darf man hoeren und sehen. */
            if (i === 1 && out[0].id === SCATTER && out[1].id === SCATTER) {
              machine.classList.add('tense');
              reels[2].classList.add('tense');
              GK.sfx('tension');
            }
          }, (1.7 + i * 0.55) * 1000);
        });

        setTimeout(function () {
          if (stopped) return;
          machine.classList.remove('tense');
          reels[2].classList.remove('tense');
          finish(out, stake, free);
        }, (1.7 + 2 * 0.55) * 1000 + 260);
      }

      /** Gewinnsymbole federn kurz hoch, statt nur die Walze aufblitzen zu lassen. */
      function spring(indexes) {
        indexes.forEach(function (i, n) {
          /* Nach settle() steht das Endsymbol in der ersten Zelle. */
          var cell = strips[i].firstChild;
          if (!cell) return;
          setTimeout(function () {
            if (stopped) return;
            cell.classList.remove('spring');
            void cell.offsetWidth;                 // Neustart der Animation erzwingen
            cell.classList.add('spring');
            setTimeout(function () { cell.classList.remove('spring'); }, 900);
          }, n * 110);
        });
      }

      /** Welche der drei Stellen gehoeren zum Treffer? */
      function winningCells(out, res) {
        if (!res.sym) return [];
        var ids = [0, 1, 2].filter(function (i) { return out[i].id === res.sym.id; });
        return res.three ? [0, 1, 2] : ids.slice(0, 2);
      }

      function syncFree() {
        fsBanner.hidden = freeLeft <= 0;
        fsBanner.querySelector('b').textContent = freeLeft;
        spinBtn.textContent = freeLeft > 0 ? '🌟 FREISPIEL (' + freeLeft + ')' : '🎰 SPIN';
        bet.disable(freeLeft > 0 || spinning);
      }

      function awardFree(n, retrigger) {
        freeLeft += n;
        freeStake = freeStake || bet.value();
        syncFree();
        fsBanner.classList.remove('pop');
        void fsBanner.offsetWidth;
        fsBanner.classList.add('pop');
        GK.sfx('freespin');
        GK.confetti(120);
        GK.emojiRain(['🌟', '✨'], 22);
        GK.toast(retrigger
          ? '+' + n + ' Freispiele — die Serie geht weiter!'
          : n + ' Freispiele! Jeder Gewinn zählt ' + FREE_MULT + '×',
          'gold', '🌟');
      }

      function finish(out, stake, inFree) {
        var res = outcomeMult(out);
        var mult = res.mult, label = '';
        if (res.three) {
          label = '3× ' + res.sym.name + '  —  ' + mult + '×!';
          reels.forEach(function (r) { r.classList.add('hit'); });
        } else if (res.sym) {
          label = 'Zwei ' + res.sym.name + ' — ' + mult + '×';
        }
        if (res.sym) spring(winningCells(out, res));

        var win = winFor(out, stake, inFree);
        /* Im Freispiel wurde nichts gesetzt — als Einsatz 0 buchen, damit die
           Statistik den geschenkten Dreh nicht als Verlust zaehlt. */
        GK.payout(win, { stake: inFree ? 0 : stake });
        GK.logPlay('Fantasy Slots', inFree ? 0 : stake, win);

        var frei = scatters(out) === 3;
        if (frei) awardFree(FREE_SPINS, inFree);

        var zusatz = inFree ? ' (Freispiel ' + FREE_MULT + '×)' : '';
        if (win > stake) {
          GK.setResult(resultBox, label + zusatz + '  →  +' + GK.fmt(win - stake), 'win');
          GK.celebrate(win - stake, mult);
          if (mult >= 100) GK.emojiRain(['👑', '💎', '🤑'], 40);
        } else if (win > 0) {
          GK.setResult(resultBox, label + zusatz + '  →  ' + GK.fmt(win) + ' zurück', 'push');
          GK.sfx('coin');
        } else if (!frei) {
          GK.setResult(resultBox, out.map(function (s) { return s.name; }).join(' · ') + '  —  daneben!', 'lose');
          GK.sfx('lose');
          GK.shake(machine);
        }

        spinning = false;
        spinBtn.disabled = false;
        syncFree();
        if (freeLeft <= 0) { freeStake = 0; bet.disable(false); }

        /* Freispiele laufen von selbst weiter — dafuer muss man nicht klicken. */
        if (freeLeft > 0) { setTimeout(spin, 900); return; }

        if (endless) {
          // läuft weiter, bis gestoppt wird oder die Chips nicht mehr reichen
          if (canAfford()) setTimeout(spin, 700);
          else {
            stopAuto();
            GK.toast('Endlos-Modus gestoppt — Chips reichen nicht mehr', 'bad', '🪙');
          }
        } else if (autoLeft > 0) {
          autoLeft--;
          updateAuto();
          if (autoLeft > 0 && canAfford()) setTimeout(spin, 700);
        }
      }

      function canAfford() {
        var p = GK.player();
        return !!p && GK.chips() >= wantStake;
      }

      function stopAuto() {
        autoLeft = 0;
        endless = false;
        updateAuto();
      }

      function updateAuto() {
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
        autoLeft = 10; updateAuto();
        if (!spinning) spin();
      });
      loopBtn.addEventListener('click', function () {
        GK.sfx('click');
        if (endless || autoLeft > 0) { stopAuto(); return; }
        wantStake = bet.value();
        endless = true; updateAuto();
        if (!spinning) spin();
      });

      return function () { stopped = true; autoLeft = 0; endless = false; };
    }
  });
})(window.GK);
