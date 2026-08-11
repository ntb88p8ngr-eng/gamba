/* ═══════════ 11. KÖNIGLICHES PFERDERENNEN (ab Level 2) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var HORSES = [
    /* Namen und Farben folgen den Artworks: Farbe = Trikot des Jockeys,
       Name = Fell des Pferdes. Die Quoten bleiben unveraendert. */
    { nr: 1, name: 'Blitzhuf',     color: '#ff3b6b', p: 0.32 },   // Fuchs, rotes Trikot
    { nr: 2, name: 'Donnerwolke',  color: '#3b7bff', p: 0.25 },   // Schimmel, blaues Trikot
    { nr: 3, name: 'Kleefuchs',    color: '#7cff3b', p: 0.20 },   // Fuchs, gruenes Trikot
    { nr: 4, name: 'Schattentanz', color: '#a855ff', p: 0.15 },   // Rappe, lila Trikot
    { nr: 5, name: 'Goldmähne',    color: '#ffd12e', p: 0.08 }    // Palomino, gelbes Trikot
  ];
  HORSES.forEach(function (h) { h.odds = Math.round((0.88 / h.p) * 10) / 10; });

  GK.registerGame({
    id: 'horses',
    name: 'Königliches Pferderennen',
    emoji: '🏇',
    icon: 'horse1',
    blurb: 'Fünf Pferde, eine Bahn, null Vernunft. Setz auf deinen Favoriten und brüll ihn ins Ziel.',
    badge: 'BIS 11×',
    color: '#ff8a00',
    minLevel: 2,
    rules: [
      'Setz auf eines von fünf Pferden — jedes hat seine eigene <b>Quote</b>.',
      'Gewinnt dein Pferd, bekommst du <b>Einsatz × Quote</b>.',
      '<b>Blitzhuf</b> gewinnt am häufigsten und zahlt deshalb am wenigsten.',
      '<b>Goldmähne</b> gewinnt fast nie — dafür zahlt sie <b>11×</b>.',
      'Das Rennen läuft live, Führungswechsel inklusive.'
    ],
    mount: function (root) {
      var stopped = false, racing = false, raf = null, pick = HORSES[0];
      var spans = [];

      /** Wie viele Pixel jedes Pferd bis zur Ziellinie zurücklegen muss. */
      function measureSpans() {
        spans = lanes.map(function (runner) {
          var strip = runner.parentElement;
          return Math.max(0, strip.clientWidth - runner.offsetWidth);
        });
      }

      var bet = GK.betPanel({ start: 25 });
      var lanes = [], bars = [];

      var track = el('div', { class: 'race-track' });
      HORSES.forEach(function (h) {
        var runner = el('div', { class: 'runner', style: 'color:' + h.color }, [
          el('span', { class: 'r-icon', html: GK.iconHTML('horse' + h.nr) }),
          el('span', { class: 'r-nr', style: 'background:' + h.color, text: h.nr })
        ]);
        var lane = el('div', { class: 'lane' }, [
          el('div', { class: 'lane-tag', style: 'color:' + h.color, text: h.nr + ' ' + h.name }),
          el('div', { class: 'lane-strip' }, [runner])
        ]);
        lanes.push(runner);
        bars.push(lane);
        track.appendChild(lane);
      });
      track.appendChild(el('div', { class: 'finish-line' }, [el('span', { text: '🏁' })]));

      var commentary = el('div', { class: 'commentary', text: '„Die Pferde sind am Start…"' });

      var pickBtns = [];
      var picker = el('div', { class: 'horse-pick' }, HORSES.map(function (h) {
        var b = el('button', { class: 'hbet' + (h.nr === 1 ? ' sel' : ''), style: '--hc:' + h.color + ';color:' + h.color }, [
          el('span', { class: 'hb-icon', html: GK.iconHTML('horse' + h.nr) }),
          el('span', { class: 'hb-name', text: h.name }),
          el('span', { class: 'hb-odds', text: h.odds + '×' })
        ]);
        b.addEventListener('click', function () {
          if (racing) return;
          pick = h;
          pickBtns.forEach(function (o) { o.b.classList.toggle('sel', o.h.nr === h.nr); });
          GK.sfx('chip');
        });
        pickBtns.push({ h: h, b: b });
        return b;
      }));

      var resultBox = GK.resultBox();
      var goBtn = el('button', { class: 'btn btn-gold btn-full', text: '🏇 RENNEN STARTEN' });

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([track, el('div', { style: 'height:10px' }), commentary]),
        GK.panel([
          el('div', { class: 'bet-label', text: 'DEIN PFERD' }),
          el('div', { style: 'height:8px' }),
          picker,
          el('div', { style: 'height:14px' }),
          bet.el,
          el('div', { style: 'height:12px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          goBtn
        ])
      ]);
      root.appendChild(stage);

      function chooseWinner() {
        var weights = HORSES.map(function (h) {
          // Admin-Luck schiebt die Chancen zum gesetzten Pferd
          return h.nr === pick.nr ? GK.luckify(h.p) : h.p;
        });
        var total = weights.reduce(function (a, b) { return a + b; }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < HORSES.length; i++) { r -= weights[i]; if (r <= 0) return HORSES[i]; }
        return HORSES[0];
      }

      function start() {
        if (racing || stopped) return;
        var stake = bet.value();
        if (!GK.wager(stake, 'Pferderennen')) return;

        racing = true;
        goBtn.disabled = true;
        bet.disable(true);
        GK.setResult(resultBox, 'Und sie laufen!', '');
        GK.sfx('startbell');

        var winner = chooseWinner();
        /* Der Sieger steht beim Startschuss fest. */
        GK.commitResult(winner.nr === pick.nr ? Math.floor(stake * pick.odds) : 0, stake);
        // Der Sieger ist nach gut 4 Sekunden im Ziel, die anderen deutlich
        // spaeter — dadurch stehen sie beim Zieleinlauf klar auseinander.
        var times = HORSES.map(function (h) {
          return h.nr === winner.nr ? GK.rnd(4000, 4400) : GK.rnd(4900, 7400);
        });

        var runners = HORSES.map(function (h, i) {
          return { h: h, t: times[i], phase: GK.rnd(0, 6.28), freq: GK.rnd(0.0022, 0.0038), amp: GK.rnd(0.06, 0.14), pos: 0 };
        });

        // Laufweg in Pixeln: Bahnbreite minus Pferdebreite, damit die Nase
        // bei pos = 1 genau auf der Ziellinie steht (Prozente im transform
        // würden sich auf die Breite des Pferdes beziehen, nicht auf die Bahn)
        measureSpans();
        lanes.forEach(function (l) { l.classList.add('galloping'); });

        var t0 = performance.now();
        var lastLeader = null, lastHoof = 0, hoofGap = 165;

        function frame(now) {
          if (stopped) return;
          var e = now - t0;
          var over = false;

          runners.forEach(function (r, i) {
            var base = Math.min(1, e / r.t);
            // Wackeln für Führungswechsel, verschwindet zum Ziel hin
            var wob = Math.sin(r.phase + e * r.freq) * r.amp * (1 - base) * (1 - base);
            r.pos = GK.clamp(base + wob, 0, 1);
            if (base >= 1) over = true;     // der erste im Ziel beendet das Rennen
            lanes[i].style.transform = 'translateX(' + (r.pos * spans[i]) + 'px)';
          });

          // Hufgetrappel: leicht schwankender Abstand, damit es nach Feld
          // klingt und nicht nach Metronom
          if (e - lastHoof > hoofGap) {
            lastHoof = e;
            hoofGap = 120 + Math.random() * 60;
            GK.sfx('hoof');
          }

          var leader = runners.slice().sort(function (a, b) { return b.pos - a.pos; })[0];
          if (leader && leader.h.nr !== lastLeader && e < 3400) {
            lastLeader = leader.h.nr;
            commentary.textContent = '„' + leader.h.name + ' geht in Führung!"';
          }

          if (over) {
            // Sobald einer die Linie berührt, bleiben alle sofort stehen
            lanes.forEach(function (l) { l.classList.remove('galloping'); });
            finish(winner, stake, runners);
            return;
          }
          raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
      }

      function finish(winner, stake, runners) {
        racing = false;
        // Platzierung nach der tatsaechlichen Position beim Zieleinlauf,
        // nicht nach der geplanten Zeit
        var order = runners.slice().sort(function (a, b) { return b.pos - a.pos; });
        commentary.textContent = '🏁 „' + winner.name + ' gewinnt das Rennen!" — Platz 2: ' + order[1].h.name;

        bars.forEach(function (lane, i) {
          lane.classList.toggle('winner-lane', HORSES[i].nr === winner.nr);
        });

        var won = winner.nr === pick.nr;
        var win = won ? Math.floor(stake * pick.odds) : 0;
        GK.payout(win, { stake: stake });
        GK.logPlay('Pferderennen', stake, win);

        if (won) {
          GK.setResult(resultBox, winner.name + ' siegt! ' + pick.odds + '× → +' + GK.fmt(win - stake), 'win');
          GK.celebrate(win - stake, pick.odds);
          GK.emojiRain(['🏇', '🏆', '🎉'], 20);
        } else {
          GK.setResult(resultBox, winner.name + ' gewinnt — dein ' + pick.name + ' war zu langsam', 'lose');
          GK.sfx('lose');
          GK.shake(track);
        }

        goBtn.disabled = false;
        bet.disable(false);

        setTimeout(function () {
          if (stopped) return;
          lanes.forEach(function (l) { l.style.transform = 'translateX(0)'; l.classList.remove('galloping'); });
          bars.forEach(function (l) { l.classList.remove('winner-lane'); });
        }, 2600);
      }

      goBtn.addEventListener('click', function () { GK.sfx('click'); start(); });

      function onResize() {
        if (!racing) return;
        measureSpans();
      }
      window.addEventListener('resize', onResize);

      return function () {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      };
    }
  });
})(window.GK);
