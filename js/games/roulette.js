/* ═══════════ 2. NEON ROULETTE ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  // Europäisches Rad (ein einziges 0-Feld)
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
               10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var SEG = 360 / WHEEL.length;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function colorOf(n) { return n === 0 ? 'green' : (REDS.indexOf(n) >= 0 ? 'red' : 'black'); }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function buildWheel() {
    var svg = svgEl('svg', { viewBox: '0 0 100 100', width: '100%', height: '100%' });
    var R = 49, cx = 50, cy = 50;
    WHEEL.forEach(function (n, i) {
      var a0 = (-90 + i * SEG) * Math.PI / 180;
      var a1 = (-90 + (i + 1) * SEG) * Math.PI / 180;
      var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
      var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      var fill = n === 0 ? '#0f8a3c' : (REDS.indexOf(n) >= 0 ? '#c81b3c' : '#171021');
      svg.appendChild(svgEl('path', {
        d: 'M' + cx + ',' + cy + ' L' + x0.toFixed(2) + ',' + y0.toFixed(2) +
           ' A' + R + ',' + R + ' 0 0 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' Z',
        fill: fill, stroke: 'rgba(255,255,255,.25)', 'stroke-width': '.35'
      }));
      var mid = (-90 + (i + 0.5) * SEG);
      var tr = 41;
      var tx = cx + tr * Math.cos(mid * Math.PI / 180);
      var ty = cy + tr * Math.sin(mid * Math.PI / 180);
      var t = svgEl('text', {
        x: tx.toFixed(2), y: ty.toFixed(2), fill: '#fff', 'font-size': '4.6',
        'font-family': 'Bungee, sans-serif', 'text-anchor': 'middle',
        'dominant-baseline': 'central',
        transform: 'rotate(' + (mid + 90).toFixed(2) + ',' + tx.toFixed(2) + ',' + ty.toFixed(2) + ')'
      });
      t.textContent = n;
      svg.appendChild(t);
    });
    return svg;
  }

  GK.registerGame({
    id: 'roulette',
    name: 'Neon Roulette',
    emoji: '🎡',
    icon: 'roulettewheel',
    blurb: 'Rot, Schwarz oder die eine mutige Zahl. Das Rad entscheidet über Ruhm und Elend.',
    badge: 'BIS 32×',
    color: '#00e5ff',
    rules: [
      '<b>Rot / Schwarz / Gerade / Ungerade / 1-18 / 19-36</b> zahlen <b>2,0×</b> — den doppelten Einsatz.',
      '<b>Dutzend</b> (1-12, 13-24, 25-36) zahlt 2,8×.',
      '<b>Einzelne Zahl</b> zahlt 32×.',
      'Du kannst <b>mehrere Felder gleichzeitig</b> belegen — jeder Klick legt einen weiteren Chip drauf, Rechtsklick räumt das Feld ab.',
      'Abgerechnet wird jedes Feld einzeln: der Einsatz ist die <b>Summe aller Chips</b>.',
      'Die <b>grüne 0</b> schlägt alle einfachen Chancen — außer du hast sie direkt gesetzt.'
    ],
    mount: function (root) {
      var stopped = false, spinning = false, rot = 0;

      /* Alle Einsätze, die gerade auf dem Tisch liegen.
         Ein Klick legt einen Chip auf ein Feld, weitere Klicks stapeln. */
      var chips = [];        // [{ key, type, value, label, mult, amount }]
      var history = [];      // Reihenfolge der Chips, für „letzten zurück"

      var bet = GK.betPanel({ start: 25, label: 'CHIP-WERT PRO FELD' });
      var wheel = el('div', { class: 'roul-wheel' }, [buildWheel(), el('div', { class: 'roul-hub', text: '👑' })]);
      var out = el('div', { class: 'roul-out', text: '?' });
      var resultBox = GK.resultBox();

      /* Einfache Chancen zahlen 2,0× — die Quote hängt damit nur noch an der
         grünen Null (18 von 37 Feldern × 2,0 = 97,3 %). */
      var typeDefs = [
        { type: 'red', label: 'Rot', sub: '2.0×', mult: 2, cls: 'red' },
        { type: 'black', label: 'Schwarz', sub: '2.0×', mult: 2, cls: 'black' },
        { type: 'even', label: 'Gerade', sub: '2.0×', mult: 2 },
        { type: 'odd', label: 'Ungerade', sub: '2.0×', mult: 2 },
        { type: 'low', label: '1–18', sub: '2.0×', mult: 2 },
        { type: 'high', label: '19–36', sub: '2.0×', mult: 2 },
        { type: 'd1', label: '1–12', sub: '2.8×', mult: 2.8 },
        { type: 'd2', label: '13–24', sub: '2.8×', mult: 2.8 },
        { type: 'd3', label: '25–36', sub: '2.8×', mult: 2.8 }
      ];

      /* ── Einsätze verwalten ── */

      function keyOf(type, value) { return type + (value === null || value === undefined ? '' : ':' + value); }
      function findChip(key) {
        for (var i = 0; i < chips.length; i++) if (chips[i].key === key) return chips[i];
        return null;
      }
      function totalBet() {
        return chips.reduce(function (s, c) { return s + c.amount; }, 0);
      }

      function place(type, value, label, mult) {
        if (spinning) return;
        var amount = bet.value();
        if (amount < 1) return;
        if (!GK.canBet(totalBet() + amount)) {
          GK.toast('Dafür reichen deine Chips nicht', 'bad', '🪙');
          GK.sfx('error');
          return;
        }
        var key = keyOf(type, value);
        var c = findChip(key);
        if (c) c.amount += amount;
        else chips.push({ key: key, type: type, value: value, label: label, mult: mult, amount: amount });
        history.push({ key: key, amount: amount });
        GK.sfx('chip');
        syncBets();
      }

      /** Nimmt den zuletzt gelegten Chip wieder herunter. */
      function undo() {
        if (spinning || !history.length) return;
        var last = history.pop();
        var c = findChip(last.key);
        if (c) {
          c.amount -= last.amount;
          if (c.amount <= 0) chips = chips.filter(function (x) { return x !== c; });
        }
        GK.sfx('click');
        syncBets();
      }

      /** Rechtsklick räumt ein einzelnes Feld komplett ab. */
      function clearField(key) {
        if (spinning) return;
        if (!findChip(key)) return;
        chips = chips.filter(function (c) { return c.key !== key; });
        history = history.filter(function (h) { return h.key !== key; });
        GK.sfx('click');
        syncBets();
      }

      function clearAll() {
        if (spinning) return;
        chips = [];
        history = [];
        GK.sfx('click');
        syncBets();
      }

      /* ── Tisch ── */

      var typeBtns = [];
      var betTypes = el('div', { class: 'bet-types' }, typeDefs.map(function (d) {
        var badge = el('span', { class: 'chip-stack' });
        var b = el('button', { class: 'rbet ' + (d.cls || '') }, [
          d.label, el('small', { text: d.sub }), badge
        ]);
        b.addEventListener('click', function () { place(d.type, null, d.label, d.mult); });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); clearField(keyOf(d.type, null)); });
        typeBtns.push({ def: d, btn: b, badge: badge });
        return b;
      }));

      var numBtns = [];
      var numGrid = el('div', { class: 'num-grid' });
      for (var n = 0; n <= 36; n++) {
        (function (n) {
          var badge = el('span', { class: 'chip-stack' });
          var b = el('button', { class: 'num-cell ' + colorOf(n) }, [String(n), badge]);
          b.addEventListener('click', function () { place('num', n, 'Zahl ' + n, 32); });
          b.addEventListener('contextmenu', function (e) { e.preventDefault(); clearField(keyOf('num', n)); });
          numBtns.push({ n: n, btn: b, badge: badge });
          numGrid.appendChild(b);
        })(n);
      }

      var betList = el('div', { class: 'bet-list' });
      var undoBtn = el('button', { class: 'btn btn-ghost btn-small', text: '↩ LETZTEN ZURÜCK' });
      var clearBtn = el('button', { class: 'btn btn-ghost btn-small', text: '🗑 TISCH RÄUMEN' });
      var tableRow = el('div', { class: 'auto-row' }, [undoBtn, clearBtn]);
      var spinBtn = el('button', { class: 'btn btn-gold btn-full', text: '🎡 DREH DAS RAD' });

      function syncBets() {
        var total = totalBet();
        typeBtns.forEach(function (o) {
          var c = findChip(keyOf(o.def.type, null));
          o.badge.textContent = c ? GK.fmt(c.amount) : '';
          o.btn.classList.toggle('has-bet', !!c);
        });
        numBtns.forEach(function (o) {
          var c = findChip(keyOf('num', o.n));
          o.badge.textContent = c ? GK.fmt(c.amount) : '';
          o.btn.classList.toggle('has-bet', !!c);
        });

        betList.innerHTML = '';
        if (!chips.length) {
          betList.appendChild(el('span', { class: 'bl-empty', text: 'Noch nichts gesetzt — tipp auf die Felder' }));
        } else {
          chips.forEach(function (c) {
            betList.appendChild(el('span', { class: 'bl-item' }, [
              el('b', { text: c.label }),
              el('span', { text: ' ' + GK.fmt(c.amount) + ' · ' + c.mult + '×' })
            ]));
          });
        }

        spinBtn.textContent = total > 0 ? '🎡 DREH DAS RAD (' + GK.fmt(total) + ')' : '🎡 DREH DAS RAD';
        spinBtn.disabled = spinning || total < 1;
        undoBtn.disabled = spinning || !history.length;
        clearBtn.disabled = spinning || !chips.length;
      }

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([
          el('div', { class: 'roul-wrap' }, [
            el('div', { class: 'roul-ptr', text: '🔻' }),
            wheel,
            out
          ])
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:14px' }),
          el('div', { class: 'bet-label', text: 'EINFACHE CHANCEN & DUTZENDE' }),
          el('div', { style: 'height:8px' }),
          betTypes,
          el('div', { style: 'height:10px' }),
          el('div', { class: 'bet-label', text: 'EINZELNE ZAHLEN (32×)' }),
          el('div', { style: 'height:8px' }),
          numGrid,
          el('div', { style: 'height:12px' }),
          betList,
          el('div', { style: 'height:10px' }),
          tableRow,
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          spinBtn,
          el('div', { style: 'height:10px' }),
          el('p', { class: 'hint', html: '💡 Du kannst <b>beliebig viele Felder gleichzeitig</b> belegen — jeder Klick legt einen weiteren Chip drauf. Rechtsklick räumt ein Feld wieder ab.' })
        ])
      ]);
      root.appendChild(stage);
      syncBets();

      /* ── Auswertung ── */

      function chipWins(c, n) {
        var col = colorOf(n);
        switch (c.type) {
          case 'red': return col === 'red';
          case 'black': return col === 'black';
          case 'even': return n !== 0 && n % 2 === 0;
          case 'odd': return n % 2 === 1;
          case 'low': return n >= 1 && n <= 18;
          case 'high': return n >= 19 && n <= 36;
          case 'd1': return n >= 1 && n <= 12;
          case 'd2': return n >= 13 && n <= 24;
          case 'd3': return n >= 25 && n <= 36;
          case 'num': return n === c.value;
        }
        return false;
      }
      function anyWins(n) {
        return chips.some(function (c) { return chipWins(c, n); });
      }

      function spin() {
        if (spinning || stopped) return;
        var stake = totalBet();
        if (stake < 1) {
          GK.toast('Erst Chips auf den Tisch legen', 'bad', '🪙');
          GK.sfx('error');
          return;
        }
        if (!GK.wager(stake, 'Roulette')) return;

        spinning = true;
        bet.disable(true);
        syncBets();
        out.className = 'roul-out';
        out.textContent = '…';
        GK.setResult(resultBox, 'Das Rad dreht sich…', '');
        GK.sfx('spin');

        /* Ziel bestimmen. Der Grundwert ist 0 — ohne Admin-Luck wird also
           nichts geschenkt. Früher lagen hier 2 bis 5 %, was die Quote einer
           Einzelzahl auf ueber 140 % gehoben hat. */
        var idx = GK.rndInt(0, WHEEL.length - 1);
        if (GK.luckRoll(0)) {
          var candidates = [];
          for (var i = 0; i < WHEEL.length; i++) if (anyWins(WHEEL[i])) candidates.push(i);
          if (candidates.length) idx = GK.pick(candidates);
        }
        var num = WHEEL[idx];

        var center = idx * SEG + SEG / 2;
        var base = rot - (rot % 360);
        rot = base + 360 * 6 + (360 - center);
        wheel.style.transform = 'rotate(' + rot + 'deg)';

        // Klicken folgt der Raddrehung: dicht am Anfang, ausklingend zum Schluss
        // (Dauer wie die CSS-Transition von .roul-wheel)
        var stopTicks = GK.tickRun(40, 5400);

        setTimeout(function () {
          stopTicks();
          if (stopped) return;
          finish(num, stake);
        }, 5560);
      }

      function finish(num, stake) {
        out.className = 'roul-out ' + colorOf(num);
        out.textContent = num;

        var win = 0, hits = [];
        chips.forEach(function (c) {
          if (chipWins(c, num)) {
            win += Math.floor(c.amount * c.mult);
            hits.push(c.label);
          }
        });

        GK.payout(win, { stake: stake });
        GK.logPlay('Neon Roulette', stake, win);

        // getroffene Felder kurz aufleuchten lassen
        typeBtns.forEach(function (o) {
          var c = findChip(keyOf(o.def.type, null));
          o.btn.classList.toggle('hit', !!c && chipWins(c, num));
        });
        numBtns.forEach(function (o) {
          var c = findChip(keyOf('num', o.n));
          o.btn.classList.toggle('hit', !!c && chipWins(c, num));
        });

        var net = win - stake;
        if (win > 0) {
          var txt = num + ' — ' + hits.slice(0, 3).join(', ') +
                    (hits.length > 3 ? ' +' + (hits.length - 3) + ' weitere' : '') +
                    ' trifft! ' + GK.fmtSigned(net);
          GK.setResult(resultBox, txt, net > 0 ? 'win' : 'push');
          if (net > 0) GK.celebrate(net, win / stake);
          else GK.sfx('coin');
        } else {
          GK.setResult(resultBox, num + ' (' + colorOf(num) + ') — kein Treffer', 'lose');
          GK.sfx('lose');
          GK.shake(out.parentElement);
        }

        spinning = false;
        bet.disable(false);
        syncBets();

        setTimeout(function () {
          if (stopped) return;
          typeBtns.concat(numBtns).forEach(function (o) { o.btn.classList.remove('hit'); });
        }, 2200);
      }

      spinBtn.addEventListener('click', function () { GK.sfx('click'); spin(); });
      undoBtn.addEventListener('click', undo);
      clearBtn.addEventListener('click', clearAll);
      return function () { stopped = true; };
    }
  });
})(window.GK);
