/* ═══════════ 15. PINGUIN-SPRUNG ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* Zwölf Schollen von links nach rechts. Jeder Sprung gelingt mit HOP_OK,
     der Multiplikator wächst so, dass jeder Ausstiegspunkt bei rund 87 %
     Auszahlungsquote liegt: M(k) ≈ 0,88 / HOP_OK^k. */
  var HOP_OK = 0.75;
  var MULTS = [1.15, 1.55, 2.05, 2.75, 3.7, 4.9, 6.5, 8.75, 11.7, 15.5, 20.5, 27.5];

  GK.registerGame({
    id: 'penguin',
    name: 'Pinguin-Sprung',
    emoji: '🐧',
    icon: 'penguin',
    blurb: 'Von Scholle zu Scholle Richtung Horizont. Jeder Sprung zahlt mehr — und jeder kann der letzte sein.',
    badge: 'BIS 27,5×',
    color: '#00e5ff',
    minLevel: 15,
    rules: [
      'Der Pinguin springt von links nach rechts über <b>12 Schollen</b>.',
      'Jeder Sprung gelingt mit <b>75 %</b> — je weiter rechts, desto höher der Multiplikator.',
      'Nach jedem gelungenen Sprung kannst du <b>aussteigen</b> und den aktuellen Multiplikator kassieren.',
      'Bricht die Scholle, ist der Einsatz weg. Die letzte Scholle zahlt <b>27,5×</b> und wird automatisch ausgezahlt.',
      'Springen geht per Knopf <b>oder mit einem Tipp auf die nächste Scholle</b>.',
      'Kein Sprung ist sicher — auch der erste nicht.'
    ],
    mount: function (root, resume) {
      var stopped = false, running = false, pos = 0, stake = 0, busy = false;
      var timers = [];
      function wait(ms, fn) {
        var t = setTimeout(function () { if (!stopped) fn(); }, ms);
        timers.push(t);
        return t;
      }

      var bet = GK.betPanel({ start: 25 });
      var resultBox = GK.resultBox();

      /* ── Szene ── */
      var track = el('div', { class: 'peng-track' });
      var floes = [];
      // Startscholle plus zwölf Zielschollen
      for (var i = 0; i <= MULTS.length; i++) {
        (function (i) {
          // eigene Klasse: .floe gehört bereits dem Eisbär-Spiel
          var f = el('button', {
            class: 'peng-floe' + (i === 0 ? ' start' : ''),
            style: '--d:' + (i % 5) * 0.4 + 's',
            title: i === 0 ? 'Startscholle' : 'Auf die Scholle tippen zum Springen'
          }, [
            el('span', { class: 'fl-img', html: GK.iconHTML('floe') }),
            el('span', { class: 'fl-mult', text: i === 0 ? 'START' : MULTS[i - 1] + '×' })
          ]);
          // direkt auf die nächste Scholle tippen springt ebenfalls
          f.addEventListener('click', function () {
            if (!running || busy || stopped) return;
            if (i !== pos + 1) return;
            hop();
          });
          floes.push(f);
          track.appendChild(f);
        })(i);
      }

      /* Der Pinguin steht auf einer wippenden Scholle und muss mitwippen. Das
         Wippen sitzt in einer eigenen Huelle: aussen laufen der Wechsel der
         Position und der Sprung, innen nur das Auf und Ab. Beides auf demselben
         Element wuerde sich um transform streiten. */
      var bob = el('div', { class: 'peng-bob', html: GK.iconHTML('penguin') });
      var penguin = el('div', { class: 'peng' }, [bob]);
      track.appendChild(penguin);

      /* Die Kulisse ist ein Foto (siehe .peng-scene). Frueher standen hier
         gemalte Eisberge, Polarlicht und Sternenhimmel — eine Nachtszene, die
         zu der hellen Aufnahme nicht passt. Geblieben ist nur das Glitzern auf
         dem Wasser, damit die Flaeche nicht ganz still steht. */
      var scene = el('div', { class: 'peng-scene' }, [
        el('div', { class: 'peng-sea' }),
        track
      ]);

      var multBadge = el('div', { class: 'mult-badge center', text: '1.00×' });
      var stepInfo = el('div', { class: 'peng-info', text: 'Noch am Ufer' });

      var goBtn = el('button', { class: 'btn btn-gold btn-full', text: '🐧 LOSSPRINGEN' });
      var hopBtn = el('button', { class: 'btn', text: '➡️ WEITER' });
      var cashBtn = el('button', { class: 'btn btn-lime', text: '💰 AUSSTEIGEN' });
      var actions = el('div', { class: 'bj-actions' }, [hopBtn, cashBtn]);

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([scene, el('div', { style: 'height:10px' }), stepInfo]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          multBadge,
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          goBtn,
          el('div', { style: 'height:8px' }),
          actions,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Du kannst auch <b>direkt auf die nächste Scholle tippen</b>. Jeder Sprung gelingt mit <b>75 %</b>; nach zwölf Schollen ist das Festland erreicht — <b>27,5×</b>.' })
        ])
      ]);
      root.appendChild(stage);

      /* ── Darstellung ── */

      function multAt(p) { return p === 0 ? 1 : MULTS[p - 1]; }

      /** Schiebt die Bahn so, dass der Pinguin im Blick bleibt. */
      function follow() {
        var f = floes[pos];
        var mid = scene.clientWidth / 2;
        var x = f.offsetLeft + f.offsetWidth / 2;
        track.style.transform = 'translateX(' + Math.min(0, mid - x) + 'px)';
      }

      /**
       * Pinguin und Scholle im Gleichtakt wippen lassen.
       *
       * Die Verzoegerung mitzusetzen reicht nicht: aendert man
       * animation-delay an einer schon laufenden Animation, springt sie nicht
       * auf die neue Phase — nach einem Sprung hob sich die Scholle, waehrend
       * der Pinguin gerade sank. Deshalb wird die Laufzeit der Animation
       * direkt uebernommen. Der delay bleibt als Rueckfall fuer Browser ohne
       * getAnimations.
       */
      function bobFor(elm) {
        if (!elm || !elm.getAnimations) return null;
        var as = elm.getAnimations();
        for (var i = 0; i < as.length; i++) if (as[i].animationName === 'bob') return as[i];
        return as[0] || null;
      }

      function syncBob(f) {
        bob.style.setProperty('--d', f.style.getPropertyValue('--d') || '0s');
        var vonScholle = bobFor(f), amPinguin = bobFor(bob);
        if (vonScholle && amPinguin && vonScholle.currentTime !== null) {
          try { amPinguin.currentTime = vonScholle.currentTime; } catch (e) {}
        }
      }

      /**
       * Pinguin auf die Scholle setzen, auf der er gerade steht.
       *
       * `sofort` heisst: ohne den Weg dorthin. Beides hat eine Ueberblendung
       * (der Pinguin auf `left`, die Bahn auf `transform`), und die ist beim
       * Springen genau richtig — beim Aufsetzen zu Beginn einer Runde aber
       * falsch: dort waere sie ein Rueckwaertsgleiten ueber das halbe Feld.
       */
      function placePenguin(sofort) {
        var f = floes[pos];
        if (sofort) { penguin.style.transition = 'none'; track.style.transition = 'none'; }
        penguin.style.left = (f.offsetLeft + f.offsetWidth / 2) + 'px';
        syncBob(f);
        follow();
        if (sofort) {
          /* Ein erzwungenes Neuberechnen dazwischen: sonst fasst der Browser
             beides in denselben Stilblock und die Bremse greift nicht. */
          void penguin.offsetWidth;
          penguin.style.transition = '';
          track.style.transition = '';
        }
      }

      /**
       * Nach dem Ende einer Runde zurueck ans Ufer.
       *
       * Frueher tat das nur lose(), und nach einem Ausstieg blieb der
       * Pinguin stehen, wo er aufgehoert hatte. Der naechste Start setzte
       * ihn dann auf null — und weil `left` eine Ueberblendung hat, sah man
       * ihn ueber das halbe Feld zurueckgleiten. Genau das war die Klage:
       * „springt beim ersten Klick zurueck auf die erste Scholle".
       *
       * Die Pruefung auf `running` ist die zweite Haelfte davon: wer schnell
       * genug wieder auf LOSSPRINGEN drueckt, hat laengst eine neue Runde —
       * die darf dieser Nachzuegler nicht mehr anfassen.
       */
      function zurueckAnsUfer(nachMs) {
        wait(nachMs, function () {
          if (running) return;
          pos = 0;
          penguin.classList.remove('splash');
          floes.forEach(function (f) { f.classList.remove('broken', 'done', 'here', 'next'); });
          placePenguin(true);
        });
      }

      function sync() {
        goBtn.disabled = running;
        hopBtn.disabled = !running || busy;
        cashBtn.disabled = !running || busy || pos === 0;
        bet.disable(running);
        multBadge.textContent = GK.fmtX(multAt(pos));
        cashBtn.textContent = pos > 0
          ? '💰 AUSSTEIGEN (' + GK.fmt(Math.floor(stake * multAt(pos))) + ')'
          : '💰 AUSSTEIGEN';
        hopBtn.textContent = running && pos < MULTS.length
          ? '➡️ WEITER (' + MULTS[pos] + '×)'
          : '➡️ WEITER';
        floes.forEach(function (f, i) {
          f.classList.toggle('done', running && i < pos);
          f.classList.toggle('here', running && i === pos);
          f.classList.toggle('next', running && i === pos + 1);
        });
      }

      /* ── Ablauf ── */

      function start() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Pinguin-Sprung')) return;

        running = true; busy = false; pos = 0;
        floes.forEach(function (f) { f.classList.remove('broken', 'done', 'here', 'next'); });
        penguin.classList.remove('splash');
        // ohne Weg: er steht am Ufer, er gleitet nicht dorthin
        placePenguin(true);
        GK.setResult(resultBox, 'Das Eis knackt schon… viel Glück!', '');
        GK.sfx('click');
        sync();
        snapshot();
      }

      function hop() {
        if (!running || busy || stopped) return;
        busy = true;
        sync();
        GK.sfx('waddle');

        var ok = GK.luckRoll(HOP_OK);
        var from = pos;
        penguin.classList.add('jumping');

        wait(120, function () {
          // Halbzeit des Sprungs: Pinguin steht optisch schon auf der nächsten Scholle
          pos = from + 1;
          placePenguin();
        });

        wait(560, function () {
          penguin.classList.remove('jumping');
          if (!ok) {
            pos = from + 1;
            floes[pos].classList.add('broken');
            penguin.classList.add('splash');
            GK.sfx('boom');
            wait(420, function () { lose(); });
            return;
          }
          GK.sfx('plop');
          if (pos >= MULTS.length) { cashOut(true); return; }
          busy = false;
          stepInfo.textContent = 'Scholle ' + pos + ' von ' + MULTS.length + ' — ' + MULTS[pos - 1] + '×';
          sync();
          snapshot();
        });
      }

      function cashOut(auto) {
        if (!running || stopped) return;
        running = false; busy = false;
        var mult = multAt(pos);
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        /* Für die Hall of Fame: so viele Schollen hat er wirklich
           betreten. */
        GK.rekord('penguin', pos);
        GK.logPlay('Pinguin-Sprung', stake, win);
        GK.setResult(resultBox,
          (auto ? '🏔️ Festland erreicht! ' : '') + pos + ' Schollen · ' + GK.fmtX(mult) +
          ' → ' + GK.fmtSigned(win - stake), 'win');
        GK.celebrate(win - stake, mult);
        if (auto) GK.emojiRain(['🐧', '🏔️', '🎉'], 24);
        stepInfo.textContent = auto ? 'Am anderen Ufer angekommen.' : 'Rechtzeitig abgesprungen.';
        sync();
        GK.clearGameState('penguin');
        /* Erst darf man sehen, wo man aufgehoert hat — dann watschelt er
           zurueck ans Ufer, damit die naechste Runde von vorn beginnt und
           nicht mit einem Rueckwaertsgleiten. */
        zurueckAnsUfer(1800);
      }

      function lose() {
        running = false; busy = false;
        GK.payout(0, { stake: stake });
        /* Die brechende Scholle zählt nicht mit — er stand nie darauf.
           Der Lauf ist also eine kürzer als die Nummer im Text. */
        GK.rekord('penguin', pos - 1);
        GK.logPlay('Pinguin-Sprung', stake, 0);
        GK.setResult(resultBox,
          'Die Scholle bricht bei Nummer ' + pos + ' — ' + GK.fmt(stake) + ' Chips im Meer', 'lose');
        GK.sfx('lose');
        GK.shake(scene);
        GK.clearGameState('penguin');
        stepInfo.textContent = 'Platsch. Der Pinguin schwimmt zurück.';
        zurueckAnsUfer(1400);
        sync();
      }

      goBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      hopBtn.addEventListener('click', hop);
      cashBtn.addEventListener('click', function () { GK.sfx('cash'); cashOut(false); });

      function onResize() { placePenguin(); }
      window.addEventListener('resize', onResize);

      /* ── Unterbrochener Lauf ──
         Der Pinguin steht wieder auf derselben Scholle. Ob die naechste
         haelt, wird ohnehin erst beim Sprung gewuerfelt — es reicht also, die
         erreichte Position zu sichern. Gesichert wird nach jedem Sprung. */
      function snapshot() {
        if (!running) { GK.clearGameState('penguin'); return; }
        GK.saveGameState('penguin', { stake: stake, pos: pos });
      }

      function restore(st) {
        if (!st || !st.stake) return false;
        stake = st.stake; pos = st.pos || 0;
        running = true; busy = false;
        bet.set && bet.set(stake);
        floes.forEach(function (f) { f.classList.remove('broken'); });
        penguin.classList.remove('splash');
        stepInfo.textContent = pos > 0
          ? 'Scholle ' + pos + ' von ' + MULTS.length + ' — ' + MULTS[pos - 1] + '×'
          : 'Noch am Ufer';
        sync();
        requestAnimationFrame(function () { if (!stopped) placePenguin(); });
        GK.setResult(resultBox, 'Weiter geht’s — ' + pos + ' Schollen liegen hinter dir.', '');
        GK.toast('Unterbrochener Lauf fortgesetzt · Einsatz ' + GK.fmt(stake), 'gold', '🐧');
        return true;
      }

      /* Die Stelle des Pinguins haengt an den gemessenen Schollenbreiten.
         Ein einmaliges Messen im naechsten Bild deckt nur den Aufbau ab —
         aendert sich die Bahn danach noch (Bilder, Schrift, Fensterbreite),
         steht er daneben. Der Beobachter setzt ihn dann neu.
         (Beim beklagten Rueckwaertsgleiten war das nicht die Ursache —
         gemessen hat sich die Breite dabei kaum bewegt. Es ist Vorsorge.) */
      var bahnWacht = null;
      if (window.ResizeObserver) {
        bahnWacht = new ResizeObserver(function () { if (!stopped) placePenguin(); });
        bahnWacht.observe(track);
        if (floes[0]) bahnWacht.observe(floes[0]);
      }
      requestAnimationFrame(function () { if (!stopped) placePenguin(); });
      sync();
      restore(resume);

      return function () {
        stopped = true;
        snapshot();
        timers.forEach(clearTimeout);
        window.removeEventListener('resize', onResize);
        if (bahnWacht) bahnWacht.disconnect();
      };
    }
  });
})(window.GK);
