/* ═══════════ 17. MITTERNACHTS-MYSTERIUM ═══════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* ── Spielprinzip ──
     Auf dem Altar liegen 16 leere Sockel. Beim Anruf setzen sich ein paar
     Seelen darauf, jede mit einem verborgenen Wert. Danach läuft die Beschwörung
     in Runden: In jeder Runde kann sich auf jeden freien Sockel eine weitere
     Seele setzen. Kommt keine dazu, verlischt eine der drei Kerzen; kommt eine
     dazu, brennen wieder alle drei. Sind alle Kerzen aus, endet das Ritual und
     die Summe aller Seelenwerte wird ausgezahlt. Ein voller Altar zahlt
     zusätzlich den Grand-Bonus.

     Die Quote steckt in zwei Zahlen je Ritual: wie oft sich Seelen setzen
     (p0/q) und was sie wert sind. Beides ist unten in MODES gebündelt und
     wird headless nachgerechnet, weil sich die erwartete Seelenzahl nicht
     geschlossen hinschreiben lässt (die Kerzen setzen sich zurück). */

  var CELLS = 16;
  /* Notbremse: theoretisch kann sich das Ritual sehr lange halten. In der
     Simulation wird die Grenze so gut wie nie erreicht, sie verhindert nur
     eine Endlosschleife. */
  var MAX_RUNDEN = 40;

  var MODES = [
    {
      id: 'nebel', name: '🌫️ Nebelschleier', sub: 'viele Seelen, kleine Werte',
      p0: 0.16, q: 0.055, grand: 5,
      vals: [
        { m: 0.04, w: 0.34 }, { m: 0.06, w: 0.25 }, { m: 0.09, w: 0.18 },
        { m: 0.15, w: 0.12 }, { m: 0.27, w: 0.07 }, { m: 0.6, w: 0.03 }, { m: 2, w: 0.01 }
      ]
    },
    {
      id: 'blutmond', name: '🌕 Blutmond', sub: 'ausgewogen, mit Zähnen',
      p0: 0.12, q: 0.034, grand: 18,
      vals: [
        { m: 0.05, w: 0.33 }, { m: 0.09, w: 0.25 }, { m: 0.15, w: 0.18 },
        { m: 0.25, w: 0.12 }, { m: 0.4, w: 0.07 }, { m: 0.95, w: 0.04 }, { m: 3.5, w: 0.01 }
      ]
    },
    {
      id: 'abgrund', name: '🕳️ Abgrund', sub: 'selten, dafür brutal',
      p0: 0.085, q: 0.021, grand: 60,
      vals: [
        { m: 0.06, w: 0.32 }, { m: 0.12, w: 0.24 }, { m: 0.22, w: 0.18 },
        { m: 0.4, w: 0.13 }, { m: 0.8, w: 0.08 }, { m: 2, w: 0.04 }, { m: 8, w: 0.01 }
      ]
    }
  ];

  function drawVal(mode) {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < mode.vals.length; i++) {
      acc += mode.vals[i].w;
      if (r < acc) return mode.vals[i].m;
    }
    return mode.vals[0].m;
  }

  function countEmpty(cells) {
    var n = 0;
    for (var i = 0; i < cells.length; i++) if (cells[i] === null) n++;
    return n;
  }

  /**
   * Spielt ein komplettes Ritual durch und gibt das Protokoll zurück —
   * die Oberfläche animiert danach nur noch, was hier entschieden wurde.
   * { events, cells, total, full, dead }
   */
  function playRitual(mode) {
    var cells = [], i;
    for (i = 0; i < CELLS; i++) cells.push(null);

    var events = [];
    var first = [];
    for (i = 0; i < CELLS; i++) if (GK.luckRoll(mode.p0)) first.push(i);
    first.forEach(function (c) { cells[c] = drawVal(mode); });
    events.push({ type: 'start', cells: first, lives: 3 });

    if (!first.length) {
      return { events: events, cells: cells, total: 0, full: false, dead: true };
    }

    var lives = 3, runden = 0;
    while (lives > 0 && countEmpty(cells) > 0 && runden < MAX_RUNDEN) {
      runden++;
      var landed = [];
      for (i = 0; i < CELLS; i++) if (cells[i] === null && GK.luckRoll(mode.q)) landed.push(i);
      landed.forEach(function (c) { cells[c] = drawVal(mode); });
      if (landed.length) lives = 3; else lives--;
      events.push({ type: 'runde', cells: landed, lives: lives });
    }

    var full = countEmpty(cells) === 0;
    var total = 0;
    for (i = 0; i < CELLS; i++) if (cells[i] !== null) total += cells[i];
    if (full) total += mode.grand;
    return { events: events, cells: cells, total: total, full: full, dead: false };
  }

  function fmtM(m) { return String(Math.round(m * 100) / 100).replace('.', ',') + '×'; }

  /* ── Kulisse: Ruinen im Gegenlicht, ein einziges SVG ── */
  function ruins() {
    var d = '#160a2e', d2 = '#1e0f3d';
    return '<svg viewBox="0 0 400 130" preserveAspectRatio="none" width="100%" height="100%">' +
      /* linker Turm */
      '<polygon points="26,130 26,52 44,30 62,52 62,130" fill="' + d + '"/>' +
      '<path d="M36 130 v-28 a8 8 0 0 1 16 0 v28 Z" fill="#0d0620"/>' +
      /* Kathedrale in der Mitte, mit Spitzbogen-Fenster */
      '<polygon points="150,130 150,44 200,8 250,44 250,130" fill="' + d2 + '"/>' +
      '<path d="M186 130 v-44 a14 14 0 0 1 28 0 v44 Z" fill="#0d0620"/>' +
      '<path d="M200 8 L200 -6" stroke="' + d + '" stroke-width="4"/>' +
      /* rechte Ruine: halb eingestürzte Mauer mit zwei Bögen */
      '<path d="M292 130 V60 h76 v70 Z" fill="' + d + '"/>' +
      '<path d="M304 130 v-30 a10 10 0 0 1 20 0 v30 Z" fill="#0d0620"/>' +
      '<path d="M338 130 v-30 a10 10 0 0 1 20 0 v30 Z" fill="#0d0620"/>' +
      '<polygon points="368,60 368,44 380,52 392,40 392,130 368,130" fill="' + d2 + '"/>' +
      /* toter Baum links */
      '<path d="M96 130 V92 M96 104 l-14 -14 M96 98 l13 -13 M82 90 l-8 -3 M109 85 l4 -9" ' +
        'fill="none" stroke="' + d + '" stroke-width="4" stroke-linecap="round"/>' +
      /* Grabsteine */
      '<path d="M120 130 v-16 a7 7 0 0 1 14 0 v16 Z" fill="' + d + '"/>' +
      '<path d="M264 130 v-13 a6 6 0 0 1 12 0 v13 Z" fill="' + d + '"/>' +
      '<rect x="70" y="120" width="16" height="10" fill="' + d + '"/>' +
      '</svg>';
  }

  GK.registerGame({
    id: 'mystery',
    name: 'Mitternachts-Mysterium',
    emoji: '🕯️',
    icon: 'mask',
    blurb: 'Ruf Seelen auf den Altar. Solange neue kommen, brennen die Kerzen weiter — und der Einsatz wächst.',
    badge: '16 SEELEN',
    color: '#8b3bff',
    minLevel: 25,
    rules: [
      'Auf dem Altar liegen <b>16 Sockel</b>. Beim Anruf setzen sich die ersten Seelen darauf — jede mit ihrem eigenen Wert.',
      'Danach läuft die Beschwörung in Runden: <b>setzt sich mindestens eine neue Seele</b>, brennen wieder alle <b>drei Kerzen</b>.',
      'Kommt in einer Runde keine dazu, <b>verlischt eine Kerze</b>. Sind alle drei aus, endet das Ritual.',
      'Ausgezahlt wird die <b>Summe aller Seelenwerte</b> — nicht die höchste, sondern alle zusammen.',
      'Ein <b>voller Altar</b> zahlt zusätzlich den Grand-Bonus: 5× beim Nebelschleier, 18× beim Blutmond, 60× im Abgrund. Je größer der Bonus, desto seltener kommen die Seelen — im Abgrund ist der volle Altar reine Legende.',
      'Setzt sich beim Anruf <b>keine einzige</b> Seele, ist die Beschwörung sofort vorbei.',
      'Drei Rituale zur Wahl: viele kleine Seelen, ausgewogen — oder selten und brutal.'
    ],
    mount: function (root) {
      var stopped = false, running = false, stake = 0, mode = MODES[1];
      var timers = [];
      function wait(ms, fn) {
        var t = setTimeout(function () { if (!stopped) fn(); }, ms);
        timers.push(t);
        return t;
      }

      var bet = GK.betPanel({ start: 25 });
      var resultBox = GK.resultBox();

      /* ── Szene ── */
      var cellEls = [];
      var grid = el('div', { class: 'mys-grid' });
      for (var i = 0; i < CELLS; i++) {
        var c = el('div', { class: 'mys-cell' }, [el('span', { class: 'mc-val' })]);
        cellEls.push(c);
        grid.appendChild(c);
      }

      var candles = [0, 1, 2].map(function () {
        return el('span', { class: 'mys-candle' }, [
          el('span', { class: 'mc-flame' }),
          el('span', { class: 'mc-stick' })
        ]);
      });
      var candleRow = el('div', { class: 'mys-candles' }, candles);

      /* Himmel und Altar liegen untereinander statt übereinander: der Altar ist
         so hoch wie sein Inhalt, der Himmel bekommt den Rest. Vorher lag die
         Kulisse komplett hinter der Altarfläche und war nie zu sehen. */
      var scene = el('div', { class: 'mys-scene' }, [
        el('div', { class: 'mys-sky' }, [
          el('div', { class: 'mys-stars' }),
          el('div', { class: 'mys-moon' }),
          el('div', { class: 'mys-fog f2' }),
          el('div', { class: 'mys-ruins', html: ruins() }),
          el('div', { class: 'mys-fog f1' })
        ]),
        el('div', { class: 'mys-altar' }, [
          candleRow,
          el('div', { class: 'mys-slab' }, [grid])
        ])
      ]);

      var tally = el('div', { class: 'mult-badge center', text: '0,00×' });
      var stepInfo = el('div', { class: 'mys-info', text: 'Der Altar ist kalt.' });

      var modeBtns = [];
      var modePick = el('div', { class: 'risk-pick' }, MODES.map(function (m) {
        var b = el('button', { class: 'rbet' + (m.id === mode.id ? ' sel' : '') }, [
          m.name, el('small', { text: 'GRAND ' + m.grand + '×' })
        ]);
        b.addEventListener('click', function () {
          if (running) return;
          mode = m;
          syncMode();
          GK.sfx('chip');
        });
        modeBtns.push({ m: m, b: b });
        return b;
      }));
      var modeHint = el('p', { class: 'hint', text: mode.sub });

      var goBtn = el('button', { class: 'btn btn-gold btn-full', text: '🕯️ RITUAL BEGINNEN' });

      var stage = el('div', { class: 'stage split' }, [
        GK.panel([scene, el('div', { style: 'height:10px' }), stepInfo]),
        GK.panel([
          el('div', { class: 'bet-label', text: 'RITUAL' }),
          el('div', { style: 'height:8px' }),
          modePick,
          el('div', { style: 'height:8px' }),
          modeHint,
          el('div', { style: 'height:12px' }),
          bet.el,
          el('div', { style: 'height:12px' }),
          tally,
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          goBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Es zählt die <b>Summe</b> aller Seelen. Jede neue Seele stellt die drei Kerzen zurück — lange Ketten sind der eigentliche Gewinn.' })
        ])
      ]);
      root.appendChild(stage);
      syncMode();

      /* ── Darstellung ── */

      function syncMode() {
        modeBtns.forEach(function (o) { o.b.classList.toggle('sel', o.m.id === mode.id); });
        modeHint.textContent = mode.sub;
      }

      function setCandles(n) {
        candles.forEach(function (c, i) { c.classList.toggle('out', i >= n); });
      }

      function clearAltar() {
        cellEls.forEach(function (c) {
          c.className = 'mys-cell';
          c.firstChild.textContent = '';
        });
        setCandles(3);
        tally.textContent = '0,00×';
      }

      function placeSoul(idx, value, delay) {
        wait(delay, function () {
          var c = cellEls[idx];
          c.classList.add('soul');
          if (value >= 2) c.classList.add('big');
          c.firstChild.textContent = fmtM(value);
          GK.sfx('soul');
        });
      }

      function sumSoFar(res, upto) {
        // Summe aller Seelen, die bis einschließlich Ereignis `upto` liegen
        var s = 0;
        for (var e = 0; e <= upto; e++) {
          res.events[e].cells.forEach(function (idx) { s += res.cells[idx]; });
        }
        return s;
      }

      /* ── Ablauf ── */

      function start() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Mysterium')) return;

        running = true;
        goBtn.disabled = true;
        bet.disable(true);
        modeBtns.forEach(function (o) { o.b.disabled = true; });
        clearAltar();
        GK.setResult(resultBox, 'Der Anruf beginnt…', '');
        GK.sfx('whoosh');
        stepInfo.textContent = 'Die Kerzen brennen.';

        var res = playRitual(mode);
        /* Das Ritual ist ausgewuerfelt, bevor die erste Kerze flackert. */
        GK.commitResult(Math.floor(stake * res.total), stake);
        playEvent(res, 0, 380);
      }

      /** Spielt Ereignis `n` ab und hängt das nächste hinten an. */
      function playEvent(res, n, at) {
        var ev = res.events[n];
        ev.cells.forEach(function (idx, k) { placeSoul(idx, res.cells[idx], at + k * 130); });

        var dauer = Math.max(520, ev.cells.length * 130 + 320);

        wait(at + dauer - 120, function () {
          setCandles(ev.lives);
          tally.textContent = fmtM(sumSoFar(res, n));
          if (n > 0 && !ev.cells.length) {
            GK.sfx('snuff');
            stepInfo.textContent = ev.lives > 0
              ? 'Keine Seele — noch ' + ev.lives + ' Kerze' + (ev.lives > 1 ? 'n' : '') + '.'
              : 'Die letzte Kerze erlischt.';
          } else if (ev.cells.length) {
            stepInfo.textContent = ev.cells.length + ' neue Seele' + (ev.cells.length > 1 ? 'n' : '') +
              ' — alle Kerzen brennen wieder.';
          }
        });

        if (n + 1 < res.events.length) {
          wait(at + dauer, function () { playEvent(res, n + 1, 0); });
        } else {
          wait(at + dauer + 260, function () { finish(res); });
        }
      }

      function finish(res) {
        if (stopped) return;
        running = false;
        goBtn.disabled = false;
        bet.disable(false);
        modeBtns.forEach(function (o) { o.b.disabled = false; });

        var win = Math.floor(stake * res.total);
        GK.payout(win, { stake: stake });
        GK.logPlay('Mitternachts-Mysterium', stake, win);
        tally.textContent = fmtM(res.total);

        var seelen = CELLS - countEmpty(res.cells);

        if (res.dead) {
          GK.setResult(resultBox, 'Keine einzige Seele erscheint — der Einsatz verhallt.', 'lose');
          GK.sfx('lose');
          GK.shake(scene);
          stepInfo.textContent = 'Der Altar bleibt leer.';
        } else if (res.full) {
          GK.setResult(resultBox, 'VOLLER ALTAR! 16 Seelen · ' + fmtM(res.total) +
            ' → ' + GK.fmtSigned(win - stake), 'win');
          GK.celebrate(win - stake, res.total);
          GK.emojiRain(['🕯️', '👻', '👑', '💀'], 30);
          stepInfo.textContent = 'Jeder Sockel besetzt — der Grand-Bonus fällt.';
        } else if (win > stake) {
          GK.setResult(resultBox, seelen + ' Seelen · ' + fmtM(res.total) +
            ' → ' + GK.fmtSigned(win - stake), 'win');
          GK.celebrate(win - stake, res.total);
          stepInfo.textContent = 'Die Kerzen sind aus. Das Ritual hat gehalten.';
        } else if (win > 0) {
          GK.setResult(resultBox, seelen + ' Seelen · ' + fmtM(res.total) +
            ' — nur ' + GK.fmt(win) + ' zurück', 'push');
          GK.sfx('coin');
          stepInfo.textContent = 'Zu wenige Seelen für einen Gewinn.';
        } else {
          GK.setResult(resultBox, seelen + ' Seelen, aber nichts wert — Einsatz weg.', 'lose');
          GK.sfx('lose');
          GK.shake(scene);
          stepInfo.textContent = 'Die Gruft schweigt.';
        }
      }

      goBtn.addEventListener('click', function () { GK.sfx('click'); start(); });

      clearAltar();
      return function () {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    }
  });
})(window.GK);
