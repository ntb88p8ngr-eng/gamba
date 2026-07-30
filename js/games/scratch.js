/* ═══════════ 10. RUNEN-RUBBELLOS ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  // Gewinntabelle: Wahrscheinlichkeit für 3 Gleiche
  var PRIZES = [
    { sym: 'clover', name: 'Kleeblatt', mult: 2,  p: 0.140 },
    { sym: 'flame',  name: 'Flamme',    mult: 3,  p: 0.066 },
    { sym: 'gem',    name: 'Juwel',     mult: 5,  p: 0.038 },
    { sym: 'star',   name: 'Stern',     mult: 10, p: 0.011 },
    { sym: 'crown',  name: 'Krone',     mult: 20, p: 0.0036 }
  ];
  var ALL = PRIZES.map(function (p) { return p.sym; });
  function nameOf(id) {
    for (var i = 0; i < PRIZES.length; i++) if (PRIZES[i].sym === id) return PRIZES[i].name;
    return id;
  }

  GK.registerGame({
    id: 'scratch',
    name: 'Runen-Rubbellos',
    emoji: '🎫',
    icon: 'ticket',
    blurb: 'Freirubbeln mit der Maus. Drei gleiche Runen und die Chips gehören dir.',
    badge: 'BIS 20×',
    color: '#ffd12e',
    rules: [
      'Kaufe ein Los und <b>rubbel die drei Felder frei</b> (Maus gedrückt halten oder wischen).',
      '<b>Drei gleiche Runen</b> zahlen den Multiplikator der Rune aus.',
      'Krone 20× · Stern 10× · Juwel 5× · Flamme 3× · Kleeblatt 2×',
      'Alles andere ist eine Niete — aber Rubbeln macht trotzdem Spaß.'
    ],
    mount: function (root) {
      var stopped = false, active = false, stake = 0, symbols = ['question', 'question', 'question'], revealedCount = 0;

      var bet = GK.betPanel({ start: 20 });
      var tiles = [];
      var tileRow = el('div', { class: 'scratch-tiles' });

      for (var i = 0; i < 3; i++) tiles.push(makeTile(i));
      tiles.forEach(function (t) { tileRow.appendChild(t.el); });

      var card = el('div', { class: 'scratch-card' }, [
        el('div', { class: 'scratch-head', text: '✦ GAMBAKING RUNEN-LOS ✦' }),
        tileRow,
        el('div', { class: 'scratch-foot', text: '3 gleiche Runen = Gewinn' })
      ]);

      var payTable = el('div', { class: 'paytable' }, PRIZES.slice().reverse().map(function (p) {
        return el('div', { class: 'pay-item' }, [
          el('span', { class: 's', html: GK.iconHTML(p.sym) }),
          el('span', { class: 'm', text: p.mult + '×' })
        ]);
      }));

      var resultBox = GK.resultBox();
      var buyBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎫 LOS KAUFEN' });
      var revealBtn = el('button', { class: 'btn btn-ghost btn-full', text: '👁 ALLES AUFDECKEN' });
      revealBtn.disabled = true;

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [card, el('div', { style: 'height:12px' }), payTable]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          buyBtn,
          el('div', { style: 'height:8px' }),
          revealBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Halt die Maus gedrückt und wisch über die Felder. Ab <b>55%</b> freigerubbelt springt das Feld von selbst auf.' })
        ])
      ]);
      root.appendChild(stage);

      function makeTile(idx) {
        var under = el('div', { class: 'sym-under', html: GK.iconHTML('question') });
        var cv = el('canvas');
        var wrap = el('div', { class: 'stile' }, [under, cv]);
        var ctx = cv.getContext('2d');
        var drawing = false, strokes = 0, done = true;

        function paintCover() {
          var r = wrap.getBoundingClientRect();
          cv.width = Math.max(60, r.width) * 2;
          cv.height = Math.max(60, r.height) * 2;
          var g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
          g.addColorStop(0, '#c9c9d8');
          g.addColorStop(0.4, '#8d8da5');
          g.addColorStop(0.6, '#e6e6f2');
          g.addColorStop(1, '#7a7a94');
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = 'rgba(43,10,77,.55)';
          ctx.font = 'bold ' + Math.round(cv.width * 0.24) + 'px Bungee, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', cv.width / 2, cv.height / 2);
          cv.style.display = '';
        }

        function pos(ev) {
          var r = cv.getBoundingClientRect();
          var t = ev.touches ? ev.touches[0] : ev;
          return {
            x: (t.clientX - r.left) * (cv.width / r.width),
            y: (t.clientY - r.top) * (cv.height / r.height)
          };
        }

        function scratch(ev) {
          if (done) return;
          var p = pos(ev);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(p.x, p.y, cv.width * 0.16, 0, Math.PI * 2);
          ctx.fill();
          strokes++;
          if (strokes % 4 === 0) GK.sfx('hover');
          if (strokes % 8 === 0 && progress() > 0.55) reveal();
        }

        function progress() {
          try {
            var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
            var clear = 0, total = 0;
            for (var i = 3; i < d.length; i += 4 * 40) { total++; if (d[i] === 0) clear++; }
            return total ? clear / total : 0;
          } catch (e) { return 1; }
        }

        function reveal() {
          if (done) return;
          done = true;
          cv.style.display = 'none';
          wrap.classList.add('revealed');
          GK.sfx('gem');
          onRevealed();
        }

        cv.addEventListener('mousedown', function (e) { drawing = true; scratch(e); });
        cv.addEventListener('mousemove', function (e) { if (drawing) scratch(e); });
        window.addEventListener('mouseup', function () { drawing = false; });
        cv.addEventListener('touchstart', function (e) { drawing = true; scratch(e); e.preventDefault(); }, { passive: false });
        cv.addEventListener('touchmove', function (e) { if (drawing) scratch(e); e.preventDefault(); }, { passive: false });
        cv.addEventListener('touchend', function () { drawing = false; });

        return {
          el: wrap,
          arm: function (sym) {
            under.innerHTML = GK.iconHTML(sym);
            wrap.classList.remove('revealed');
            done = false;
            strokes = 0;
            paintCover();
          },
          reveal: reveal,
          isDone: function () { return done; },
          reset: function () { under.innerHTML = GK.iconHTML('question'); done = true; cv.style.display = 'none'; wrap.classList.remove('revealed'); }
        };
      }

      function rollSymbols() {
        var r = Math.random(), acc = 0;
        for (var i = 0; i < PRIZES.length; i++) {
          acc += GK.luckify(PRIZES[i].p);
          if (r < acc) return [PRIZES[i].sym, PRIZES[i].sym, PRIZES[i].sym];
        }
        // Niete — oft knapp daneben für den Nervenkitzel
        var a = GK.pick(ALL), b = GK.pick(ALL.filter(function (s) { return s !== a; }));
        var set = Math.random() < 0.55 ? [a, a, b] : [a, b, GK.pick(ALL.filter(function (s) { return s !== a && s !== b; })) || b];
        for (var j = set.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1));
          var t = set[j]; set[j] = set[k]; set[k] = t;
        }
        return set;
      }

      function buy() {
        if (active || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Rubbellos')) return;

        active = true;
        revealedCount = 0;
        symbols = rollSymbols();
        buyBtn.disabled = true;
        revealBtn.disabled = false;
        bet.disable(true);
        GK.setResult(resultBox, 'Jetzt freirubbeln! 🖐️', '');
        GK.sfx('chip');
        // Layout abwarten, dann Deckschicht malen
        requestAnimationFrame(function () {
          tiles.forEach(function (t, i) { t.arm(symbols[i]); });
        });
      }

      function onRevealed() {
        revealedCount++;
        if (revealedCount >= 3) setTimeout(finish, 420);
      }

      function finish() {
        if (stopped || !active) return;
        active = false;
        var win = 0, prize = null;
        if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
          prize = PRIZES.filter(function (p) { return p.sym === symbols[0]; })[0];
          win = Math.floor(stake * (prize ? prize.mult : 0));
        }

        GK.payout(win, { stake: stake });
        GK.logPlay('Runen-Rubbellos', stake, win);

        if (win > 0) {
          GK.setResult(resultBox, '3× ' + nameOf(symbols[0]) + ' — ' + prize.mult + '× → +' + GK.fmt(win - stake), 'win');
          GK.celebrate(win - stake, prize.mult);
        } else {
          GK.setResult(resultBox, symbols.map(nameOf).join(' · ') + ' — Niete!', 'lose');
          GK.sfx('lose');
          GK.shake(card);
        }

        buyBtn.disabled = false;
        revealBtn.disabled = true;
        bet.disable(false);
      }

      buyBtn.addEventListener('click', function () { GK.sfx('click'); buy(); });
      revealBtn.addEventListener('click', function () {
        GK.sfx('click');
        tiles.forEach(function (t) { if (!t.isDone()) t.reveal(); });
      });

      tiles.forEach(function (t) { t.reset(); });
      return function () { stopped = true; };
    }
  });
})(window.GK);
