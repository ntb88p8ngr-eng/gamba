/* ═══════════ 16. KRISTALL-RUBBELLOS (9 FELDER) ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* Neun Felder, acht Gewinnlinien: drei waagerecht, drei senkrecht, zwei
     diagonal. Jede Linie aus drei gleichen Runen zahlt einzeln — mehrere
     Linien addieren sich. Die Felder werden unabhängig gezogen, dadurch
     lässt sich die Quote exakt nachrechnen (siehe Kommentar unten). */
  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  /* Häufige Runen zahlen wenig, seltene viel. Die Gewichte müssen sich zu 1
     summieren. Erwartete Auszahlung der Linien = 8 · Σ w³·m, weil jede der
     acht Linien mit w³ auf dieselbe Rune fällt. */
  var SYMS = [
    { sym: 'coin',   name: 'Münze',     w: 0.34, mult: 1 },
    { sym: 'clover', name: 'Kleeblatt', w: 0.24, mult: 1.5 },
    { sym: 'flame',  name: 'Flamme',    w: 0.17, mult: 2.5 },
    { sym: 'gem',    name: 'Juwel',     w: 0.12, mult: 5 },
    { sym: 'star',   name: 'Stern',     w: 0.08, mult: 12 },
    { sym: 'crown',  name: 'Krone',     w: 0.05, mult: 50 }
  ];

  /* Die Bonus-Rune ist ein eigenes kleines Los am Fuß der Karte: meistens
     nichts, selten ein Sofortgewinn — unabhängig von den Linien. */
  var BONUS = [
    { m: 0,  w: 0.956, label: '—' },
    { m: 1,  w: 0.020, label: '1×' },
    { m: 2,  w: 0.015, label: '2×' },
    { m: 5,  w: 0.007, label: '5×' },
    { m: 20, w: 0.002, label: '20×' }
  ];

  function symAt(i) { return SYMS[i]; }
  function multOf(sym) {
    for (var i = 0; i < SYMS.length; i++) if (SYMS[i].sym === sym) return SYMS[i].mult;
    return 0;
  }
  function nameOf(sym) {
    for (var i = 0; i < SYMS.length; i++) if (SYMS[i].sym === sym) return SYMS[i].name;
    return sym;
  }

  function drawSym() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < SYMS.length; i++) {
      acc += SYMS[i].w;
      if (r < acc) return SYMS[i].sym;
    }
    return SYMS[SYMS.length - 1].sym;
  }

  function drawBonus() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < BONUS.length; i++) {
      acc += BONUS[i].w;
      if (r < acc) return BONUS[i];
    }
    return BONUS[0];
  }

  /* Ein komplettes Los. Der Glücks-Roll hat Grundwert 0 und greift damit nur
     über den Admin-Regler — ohne ihn wird keine Linie geschenkt. */
  function drawTicket() {
    var grid = [], i;
    for (i = 0; i < 9; i++) grid.push(drawSym());
    if (GK.luckRoll(0)) {
      var line = GK.pick(LINES), s = drawSym();
      for (i = 0; i < 3; i++) grid[line[i]] = s;
    }
    return { grid: grid, bonus: drawBonus() };
  }

  /** Wertet ein Los aus: welche Linien treffen, was zahlt die Bonus-Rune. */
  function evaluate(t) {
    var hits = [], lineMult = 0;
    LINES.forEach(function (line, idx) {
      var s = t.grid[line[0]];
      if (t.grid[line[1]] === s && t.grid[line[2]] === s) {
        hits.push({ idx: idx, cells: line, sym: s, mult: multOf(s) });
        lineMult += multOf(s);
      }
    });
    return { hits: hits, lineMult: lineMult, bonusMult: t.bonus.m, total: lineMult + t.bonus.m };
  }

  /* Overlay, das die Gewinnlinien über das Raster zeichnet. Zellmitten liegen
     bei 1/6, 1/2 und 5/6 der Kantenlänge. */
  function lineOverlay(hits) {
    var c = [16.67, 50, 83.33];
    var paths = hits.map(function (h) {
      var a = h.cells[0], b = h.cells[2];
      return '<line x1="' + c[a % 3] + '" y1="' + c[Math.floor(a / 3)] + '" ' +
             'x2="' + c[b % 3] + '" y2="' + c[Math.floor(b / 3)] + '" ' +
             'stroke="#fff6b0" stroke-width="3.2" stroke-linecap="round" opacity=".95"/>';
    }).join('');
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">' + paths + '</svg>';
  }

  GK.registerGame({
    id: 'scratch9',
    name: 'Kristall-Rubbellos',
    emoji: '💠',
    icon: 'ticket9',
    blurb: 'Neun Felder, acht Linien. Jede Reihe aus drei gleichen Runen zahlt — und sie zählen alle zusammen.',
    badge: 'BIS 50×',
    color: '#00e5ff',
    minLevel: 20,
    rules: [
      'Neun Felder zum Freirubbeln — Maus gedrückt halten oder wischen.',
      'Es zählen <b>acht Linien</b>: drei waagerecht, drei senkrecht, zwei diagonal.',
      'Jede Linie aus <b>drei gleichen Runen</b> zahlt ihren Multiplikator. <b>Mehrere Linien addieren sich.</b>',
      'Krone 50× · Stern 12× · Juwel 5× · Flamme 2,5× · Kleeblatt 1,5× · Münze 1×',
      'Unten liegt die <b>Bonus-Rune</b>: meistens leer, manchmal ein Sofortgewinn bis <b>20×</b> — ganz ohne Linie.'
    ],
    mount: function (root) {
      var stopped = false, active = false, stake = 0, ticket = null, revealed = 0;

      var bet = GK.betPanel({ start: 20 });

      var tiles = [];
      var grid = el('div', { class: 'scratch9-grid' });
      for (var i = 0; i < 9; i++) {
        tiles.push(GK.scratchTile({ onReveal: onRevealed }));
        grid.appendChild(tiles[i].el);
      }
      var overlay = el('div', { class: 'scratch9-lines' });
      var gridWrap = el('div', { class: 'scratch9-wrap' }, [grid, overlay]);

      var bonusTile = GK.scratchTile({ cls: 'bonus', onReveal: onRevealed });
      var bonusRow = el('div', { class: 'scratch9-bonus' }, [
        el('span', { class: 'b-label', text: 'BONUS-RUNE' }),
        bonusTile.el
      ]);

      var card = el('div', { class: 'scratch-card crystal' }, [
        el('div', { class: 'scratch-head', text: '✦ KRISTALL-LOS · 8 LINIEN ✦' }),
        gridWrap,
        bonusRow
      ]);

      var payTable = el('div', { class: 'paytable' }, SYMS.slice().reverse().map(function (s) {
        return el('div', { class: 'pay-item' }, [
          el('span', { class: 's', html: GK.iconHTML(s.sym) }),
          el('span', { class: 'm', text: String(s.mult).replace('.', ',') + '×' })
        ]);
      }));

      var resultBox = GK.resultBox();
      var buyBtn = el('button', { class: 'btn btn-gold btn-full', text: '💠 LOS KAUFEN' });
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
          el('p', { class: 'hint', html: '💡 Acht Linien auf einem Los: die <b>Mitte</b> liegt in vier davon. Zwei Linien gleichzeitig sind kein Zufall, sondern der Normalfall bei einem guten Los.' })
        ])
      ]);
      root.appendChild(stage);

      function buy() {
        if (active || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Kristall-Los')) return;

        active = true;
        revealed = 0;
        ticket = drawTicket();
        overlay.innerHTML = '';
        tiles.forEach(function (t) { t.el.classList.remove('online'); });
        buyBtn.disabled = true;
        revealBtn.disabled = false;
        bet.disable(true);
        GK.setResult(resultBox, 'Neun Felder warten — freirubbeln! 🖐️', '');
        GK.sfx('chip');
        // Layout abwarten, sonst wird die Deckschicht auf 0 × 0 gemalt
        requestAnimationFrame(function () {
          tiles.forEach(function (t, i) { t.arm(GK.iconHTML(ticket.grid[i])); });
          bonusTile.arm('<span class="b-val' + (ticket.bonus.m ? ' hit' : '') + '">' + ticket.bonus.label + '</span>');
        });
      }

      function onRevealed() {
        revealed++;
        if (revealed >= 10) setTimeout(finish, 420);
      }

      function finish() {
        if (stopped || !active) return;
        active = false;

        var res = evaluate(ticket);
        var win = Math.floor(stake * res.total);
        GK.payout(win, { stake: stake });
        GK.logPlay('Kristall-Rubbellos', stake, win);

        if (res.hits.length) {
          overlay.innerHTML = lineOverlay(res.hits);
          res.hits.forEach(function (h) {
            h.cells.forEach(function (c) { tiles[c].el.classList.add('online'); });
          });
        }

        var parts = res.hits.map(function (h) {
          return nameOf(h.sym) + ' ' + String(h.mult).replace('.', ',') + '×';
        });
        if (res.bonusMult) parts.push('Bonus ' + res.bonusMult + '×');

        if (win > stake) {
          GK.setResult(resultBox,
            (res.hits.length ? res.hits.length + ' Linie' + (res.hits.length > 1 ? 'n' : '') + ': ' : '') +
            parts.join(' · ') + ' → +' + GK.fmt(win - stake), 'win');
          GK.celebrate(win - stake, res.total);
          if (res.total >= 20) GK.emojiRain(['💠', '👑', '💎'], 26);
        } else if (win > 0) {
          GK.setResult(resultBox, parts.join(' · ') + ' — ' + GK.fmt(win) + ' zurück', 'push');
          GK.sfx('coin');
        } else {
          GK.setResult(resultBox, 'Keine Linie, keine Bonus-Rune — Niete!', 'lose');
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
        if (!bonusTile.isDone()) bonusTile.reveal();
      });

      tiles.forEach(function (t) { t.el.classList.remove('online'); t.reset(); });
      bonusTile.reset('<span class="b-val">?</span>');
      return function () { stopped = true; };
    }
  });
})(window.GK);
