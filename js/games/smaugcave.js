/* ═══════════ 18. SMAUGS HÖHLE ═══════════
   Schiebe-Labyrinth wie beim Grundprinzip von „Das verrückte Labyrinth":
   sieben Kacheln je Reihe, 16 feste Kreuzungen (gerade Zeile/Spalte), der
   Rest verschiebbar. Jede Runde: Ersatzkachel drehen, eine der drei
   verschiebbaren Reihen/Spalten schieben, dann bis zu 5 Felder weit zu einem
   erreichbaren Ziel laufen. Tiefer rein = mehr Schatz, aber der Drache wird
   wacher — und wacht er ganz auf, wird aus dem Sammeln eine Verfolgungsjagd
   zum Ausgang, bei der man das Labyrinth selbst als Waffe gegen ihn nutzt. */
(function (GK) {
  'use strict';
  var el = GK.el;

  var GRID = 7;
  var ENTRANCE = { r: 0, c: 0 };
  var EXIT = { r: 6, c: 6 };
  var HOARD = { r: 4, c: 4 };
  var PLAYER_MOVES = 5;
  var DRAGON_MOVES = 3;
  var KEYS_NEEDED = 3;
  var SHIFT_LINES = [1, 3, 5];

  var N = 1, E = 2, S = 4, W = 8;
  var DELTA = {}; DELTA[N] = [-1, 0]; DELTA[E] = [0, 1]; DELTA[S] = [1, 0]; DELTA[W] = [0, -1];
  var OPP = {}; OPP[N] = S; OPP[E] = W; OPP[S] = N; OPP[W] = E;
  var DIRS = [N, E, S, W];

  function rotateMask(m) { return ((m << 1) | (m >> 3)) & 15; }

  var TILE_TYPES = { straight: N | S, corner: N | E, tee: N | E | S, dead: N };
  var MOVABLE_WEIGHTS = [['straight', 28], ['corner', 38], ['tee', 24], ['dead', 10]];
  var FIXED_WEIGHTS = [['straight', 20], ['corner', 35], ['tee', 40], ['dead', 5]];

  function weightedPick(table) {
    var total = table.reduce(function (s, x) { return s + x[1]; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < table.length; i++) { r -= table[i][1]; if (r <= 0) return table[i][0]; }
    return table[0][0];
  }

  function randomTile(fixed) {
    var type = weightedPick(fixed ? FIXED_WEIGHTS : MOVABLE_WEIGHTS);
    var rot = GK.rndInt(0, 3);
    var mask = TILE_TYPES[type];
    for (var i = 0; i < rot; i++) mask = rotateMask(mask);
    return { type: type, mask: mask };
  }

  /* Wert & Gefahr steigen, je näher eine Kachel an Smaugs Hort liegt (nicht
     am geometrischen Zentrum, sondern am Hort selbst — der ist bewusst kein
     festes Zentrum, sondern liegt bei r=4,c=4). */
  function tierOf(r, c) {
    var d = Math.max(Math.abs(r - HOARD.r), Math.abs(c - HOARD.c));
    return d <= 1 ? 'inner' : d <= 2 ? 'mid' : 'outer';
  }

  var ITEM_DEFS = {
    gold:  { icon: 'coin',  name: 'Gold',            awareness: 2,   base: [0.15, 0.3] },
    gem:   { icon: 'gem',   name: 'Edelstein',       awareness: 7,   base: [0.5, 1.0] },
    pearl: { icon: 'pearl', name: 'Perle',           awareness: 4,   base: [0.45, 0.45] },
    star:  { icon: 'star',  name: 'Stern',           awareness: 1,   base: [0, 0], special: 'star' },
    potion:{ icon: 'potion',name: 'Zaubertrank',     awareness: 0,   base: [0, 0], special: 'shield' },
    fish:  { icon: 'fish',  name: 'Fisch',           awareness: -12, base: [0, 0] },
    key:   { icon: 'key',   name: 'Schlüssel',       awareness: 3,   base: [0.1, 0.1], special: 'key' },
    trap:  { icon: 'skull', name: 'Falle',           awareness: 20,  base: [-0.3, -0.3], danger: true },
    fire:  { icon: 'flame', name: 'Feuerkammer',     awareness: 32,  base: [-0.6, -0.6], danger: true }
  };
  var ITEM_WEIGHTS = {
    outer: [['gold', 22], ['fish', 8], ['potion', 5], ['gem', 3], ['trap', 3], ['key', 1]],
    mid:   [['gold', 16], ['gem', 14], ['pearl', 7], ['potion', 6], ['fish', 4], ['key', 5], ['trap', 3], ['fire', 1]],
    inner: [['gem', 18], ['key', 16], ['pearl', 12], ['star', 8], ['trap', 10], ['fire', 5], ['potion', 3]]
  };
  var TIER_FACTOR = { outer: 1, mid: 1.4, inner: 2.2 };

  function rollItem(tier) {
    var table = ITEM_WEIGHTS[tier];
    var total = table.reduce(function (s, x) { return s + x[1]; }, 0) + 100; // Rest = leer
    var r = Math.random() * total;
    for (var i = 0; i < table.length; i++) { r -= table[i][1]; if (r <= 0) return table[i][0]; }
    return null;
  }

  var STAGES = [
    { max: 20,   name: 'Schläft',      cls: 's-sleep' },
    { max: 45,   name: 'Regt sich',    cls: 's-stir' },
    { max: 70,   name: 'Misstrauisch', cls: 's-susp' },
    { max: 90,   name: 'Wach',         cls: 's-awake' },
    { max: 1e9,  name: 'JAGT!',        cls: 's-hunt' }
  ];
  function stageOf(v) { for (var i = 0; i < STAGES.length; i++) if (v < STAGES[i].max) return i; return STAGES.length - 1; }

  var HOARD_CHOICES = [
    { id: 'gold',   name: 'Goldhaufen',    icon: 'coin',  bonus: 4,  awareness: 10, risk: 'gering',  desc: 'Sicher, aber bescheiden.' },
    { id: 'diamond',name: 'Diamant',       icon: 'gem',   bonus: 14, awareness: 26, risk: 'hoch',     desc: 'Deutlich mehr wert — Smaug spürt es.' },
    { id: 'crown',  name: 'Königskrone',   icon: 'crown', bonus: 44, awareness: 45, risk: 'extrem',   desc: 'Ein Vermögen. Fast garantiert, dass er erwacht.' },
    { id: 'arken',  name: 'Arkenstein',    icon: 'pearl', bonus: null, awareness: 55, risk: '???',    desc: 'Legendär selten. Alles oder fast nichts.' }
  ];

  function fmtX(n) { return (Math.round(n * 100) / 100).toFixed(2) + '×'; }

  GK.registerGame({
    id: 'smaugcave',
    name: 'Smaugs Höhle',
    emoji: '🗺️',
    icon: 'dragonhead',
    blurb: 'Ein Schiebe-Labyrinth voller Gold — schleich dich tief hinein, aber wehe, Smaug wacht auf.',
    badge: 'BIS 100×+',
    color: '#ff8a00',
    minLevel: 30,
    rules: [
      'Jede Runde bekommst du eine <b>Ersatzkachel</b>: drehen und in eine der drei markierten Reihen/Spalten schieben — das ganze Labyrinth verschiebt sich.',
      'Danach kannst du bis zu <b>5 Felder weit</b> zu jedem erreichbaren Ziel laufen. Ein Klick genügt, der Abenteurer läuft automatisch.',
      'Gold, Edelsteine und Perlen erhöhen deinen <b>Multiplikator</b>. Sterne verdoppeln den nächsten Fund, Tränke schützen kurz vor Verdacht, Fische lenken Smaug ab.',
      'Fallen und Feuerkammern kosten etwas Schatz und machen Smaug deutlich wacher.',
      'Die <b>Drachen-Wachsamkeit</b> oben zeigt, wie gefährlich es ist. Vor <b>„JAGT!“</b> kannst du jederzeit fliehen und den Schatz sichern.',
      'Drei <b>Schlüssel</b> öffnen Smaugs Hort in der Mitte — dort wartet eine riskante Extra-Beute.',
      'Wacht Smaug ganz auf, jagt er dich durchs Labyrinth. Schiebe Reihen/Spalten, um seinen Weg zu blockieren, und erreiche den <b>Ausgang</b> vor ihm — sonst verbrennt er dich samt Schatz.'
    ],
    mount: function (root) {
      var stopped = false, running = false, busy = false, phase = 'idle';
      var timers = [];
      function wait(ms, fn) { var t = setTimeout(function () { if (!stopped) fn(); }, ms); timers.push(t); return t; }

      var tiles, spare, player, dragon, keys, hoardUnlocked, hoardLooted, huntingActive;
      var mult, awareness, shieldRounds, starActive, stake, movesLeft;

      var bet = GK.betPanel({ start: 25 });
      var resultBox = GK.resultBox();

      /* ── Szene ── */
      var boardWrap = el('div', { class: 'cave-board-wrap' });
      var boardGrid = el('div', { class: 'cave-grid' });
      var pushLayer = el('div', { class: 'cave-push-layer' });
      var playerPawn = el('div', { class: 'cave-pawn cave-player', html:
        '<svg viewBox="0 0 40 56" width="100%" height="100%">' +
          '<path d="M20 2 C28 2 33 8 33 16 L33 24 C33 26 31 27 29 26 L29 20 C29 13 25 8 20 8 ' +
          'C15 8 11 13 11 20 L11 26 C9 27 7 26 7 24 L7 16 C7 8 12 2 20 2 Z" fill="#1a0f2e" stroke="#0a0518" stroke-width="1.6"/>' +
          '<ellipse cx="20" cy="19" rx="9" ry="10" fill="#241640"/>' +
          '<circle cx="16.5" cy="18" r="1.6" fill="#ffd12e"/><circle cx="23.5" cy="18" r="1.6" fill="#ffd12e"/>' +
          '<path d="M13 30 C13 26 16 24 20 24 C24 24 27 26 27 30 L27 50 C27 52 25 54 20 54 C15 54 13 52 13 50 Z" ' +
            'fill="#2e1b52" stroke="#0a0518" stroke-width="1.6"/>' +
        '</svg>' });
      var dragonPawn = el('div', { class: 'cave-pawn cave-dragon', html: GK.iconHTML('dragonhead') });
      dragonPawn.hidden = true;
      boardWrap.appendChild(boardGrid);
      boardWrap.appendChild(pushLayer);
      boardWrap.appendChild(playerPawn);
      boardWrap.appendChild(dragonPawn);

      var caveWindow = el('div', { class: 'cave-window' }, [boardWrap]);
      var caveFrame = el('div', { class: 'cave-frame' }, [
        el('div', { class: 'cave-title-ov' }, ['SMAUGS HÖHLE']),
        caveWindow
      ]);

      var spareBox = el('div', { class: 'cave-spare' });
      var spareTile = el('div', { class: 'cave-tile cave-spare-tile' });
      var rotateBtn = el('button', { class: 'btn btn-ghost btn-small', text: '⟳ DREHEN' });
      spareBox.appendChild(el('div', { class: 'bet-label', text: 'ERSATZKACHEL' }));
      spareBox.appendChild(spareTile);
      spareBox.appendChild(rotateBtn);

      var awareBar = el('div', { class: 'cave-aware-fill' });
      var awareLabel = el('div', { class: 'cave-aware-label', text: 'Smaug schläft tief.' });
      var awareBox = el('div', { class: 'cave-aware' }, [
        el('div', { class: 'cave-aware-track' }, [awareBar]),
        awareLabel
      ]);

      var multBox = el('div', { class: 'info-box' }, [el('b', { text: '1.00×' }), el('span', { text: 'Multiplikator' })]);
      var keysBox = el('div', { class: 'info-box' }, [el('b', { text: '0/' + KEYS_NEEDED }), el('span', { text: 'Schlüssel' })]);
      var cashBox = el('div', { class: 'info-box' }, [el('b', { text: '0' }), el('span', { text: 'Sicherbar' })]);
      var distBox = el('div', { class: 'info-box' }, [el('b', { text: '—' }), el('span', { text: 'Drache' })]);

      var goBtn = el('button', { class: 'btn btn-gold btn-full', text: '🗝️ HÖHLE BETRETEN' });
      var pushHint = el('div', { class: 'cave-hint-line', text: 'Ersatzkachel drehen, dann eine Reihe/Spalte schieben.' });
      var cashBtn = el('button', { class: 'btn btn-lime btn-full', text: '🏃 FLIEHEN & SICHERN' });
      cashBtn.disabled = true;

      var stage = el('div', { class: 'stage split cave-stage' }, [
        el('div', {}, [
          awareBox,
          el('div', { style: 'height:8px' }),
          caveFrame,
          el('div', { style: 'height:8px' }),
          pushHint
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:10px' }),
          spareBox,
          el('div', { style: 'height:10px' }),
          el('div', { class: 'info-grid' }, [multBox, keysBox, cashBox, distBox]),
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          goBtn,
          el('div', { style: 'height:8px' }),
          cashBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 Je näher an Smaugs Hort in der Mitte, desto wertvoller der Fund — und desto wacher wird er. Vor „JAGT!“ kannst du jederzeit fliehen.' })
        ])
      ]);
      root.appendChild(stage);

      /* ── Verbindungen & Pfadsuche ── */
      function connected(r, c, dir) {
        var t = tiles[r][c];
        if (!(t.mask & dir)) return false;
        var d = DELTA[dir], nr = r + d[0], nc = c + d[1];
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return false;
        return !!(tiles[nr][nc].mask & OPP[dir]);
      }
      function bfs(start, maxDepth) {
        var dist = {}, parent = {}, k0 = start.r + ',' + start.c;
        dist[k0] = 0;
        var q = [start];
        while (q.length) {
          var cur = q.shift(), ck = cur.r + ',' + cur.c, d = dist[ck];
          if (maxDepth !== undefined && d >= maxDepth) continue;
          for (var i = 0; i < DIRS.length; i++) {
            var dir = DIRS[i];
            if (!connected(cur.r, cur.c, dir)) continue;
            var delta = DELTA[dir], nr = cur.r + delta[0], nc = cur.c + delta[1], nk = nr + ',' + nc;
            if (dist[nk] === undefined) { dist[nk] = d + 1; parent[nk] = ck; q.push({ r: nr, c: nc }); }
          }
        }
        return { dist: dist, parent: parent };
      }
      function pathTo(res, target) {
        var k = target.r + ',' + target.c;
        if (res.dist[k] === undefined) return null;
        var path = [target];
        while (res.parent[k]) {
          var pk = res.parent[k], parts = pk.split(',');
          path.unshift({ r: +parts[0], c: +parts[1] });
          k = pk;
        }
        return path;
      }

      /* ── Aufbau ── */
      function fixedTileFor(r, c) {
        if (r === ENTRANCE.r && c === ENTRANCE.c) return { type: 'corner', mask: E | S, special: 'entrance' };
        if (r === EXIT.r && c === EXIT.c) return { type: 'corner', mask: N | W, special: 'exit' };
        if (r === HOARD.r && c === HOARD.c) return { type: 'hoard', mask: 0, special: 'hoard' };
        var t = randomTile(true);
        t.fixed = true;
        return t;
      }

      function setupBoard() {
        tiles = [];
        for (var r = 0; r < GRID; r++) {
          tiles[r] = [];
          for (var c = 0; c < GRID; c++) {
            var fixed = (r % 2 === 0 && c % 2 === 0);
            var t;
            if (fixed) { t = fixedTileFor(r, c); t.fixed = true; }
            else { t = randomTile(false); t.fixed = false; }
            t.item = (!fixed || !t.special) ? rollItem(tierOf(r, c)) : null;
            if (t.special) t.item = null;
            tiles[r][c] = t;
          }
        }
        spare = randomTile(false);
        spare.item = rollItem('mid');
        player = { r: ENTRANCE.r, c: ENTRANCE.c };
        dragon = { r: HOARD.r, c: HOARD.c, active: false };
        keys = 0; hoardUnlocked = false; hoardLooted = false; huntingActive = false;
        mult = 1; awareness = 0; shieldRounds = 0; starActive = false;
      }

      /* ── Rendern ── */
      var reachable = {};

      function corridorHTML(mask) {
        var h = '<span class="cave-hub"></span>';
        if (mask & N) h += '<span class="cave-arm n"></span>';
        if (mask & E) h += '<span class="cave-arm e"></span>';
        if (mask & S) h += '<span class="cave-arm s"></span>';
        if (mask & W) h += '<span class="cave-arm w"></span>';
        return h;
      }

      function renderSpare() {
        spareTile.innerHTML = corridorHTML(spare.mask);
      }

      function renderBoard() {
        boardGrid.innerHTML = '';
        for (var r = 0; r < GRID; r++) {
          for (var c = 0; c < GRID; c++) {
            var t = tiles[r][c];
            var cls = 'cave-cell' + (t.fixed ? ' fixed' : '') + (reachable[r + ',' + c] > 0 && phase === 'move' ? ' reachable' : '');
            if (t.special === 'entrance') cls += ' land-entrance';
            if (t.special === 'exit') cls += ' land-exit';
            if (t.special === 'hoard') cls += hoardUnlocked ? ' land-hoard-open' : ' land-hoard-locked';
            var cell = el('div', { class: cls, 'data-r': r, 'data-c': c, html: corridorHTML(t.mask) });
            if (t.special === 'entrance') cell.appendChild(el('span', { class: 'cave-tag', text: 'START' }));
            if (t.special === 'exit') cell.appendChild(el('span', { class: 'cave-tag', text: 'ZIEL' }));
            if (t.special === 'hoard') cell.appendChild(el('span', { class: 'cave-hoard-ic', html: GK.iconHTML(hoardUnlocked ? 'chest' : 'lock') }));
            if (t.item) cell.appendChild(el('span', { class: 'cave-item', html: GK.iconHTML(ITEM_DEFS[t.item].icon) }));
            boardGrid.appendChild(cell);
          }
        }
        renderSpare();
      }

      function placePawns(animate) {
        playerPawn.style.transition = animate ? '' : 'none';
        dragonPawn.style.transition = animate ? '' : 'none';
        playerPawn.style.left = ((player.c + 0.5) / GRID * 100) + '%';
        playerPawn.style.top = ((player.r + 0.5) / GRID * 100) + '%';
        if (dragon.active) {
          dragonPawn.hidden = false;
          dragonPawn.style.left = ((dragon.c + 0.5) / GRID * 100) + '%';
          dragonPawn.style.top = ((dragon.r + 0.5) / GRID * 100) + '%';
        }
        if (!animate) { void playerPawn.offsetWidth; playerPawn.style.transition = ''; dragonPawn.style.transition = ''; }
      }

      /* ── Schub-Pfeile ── */
      var pushBtns = [];
      function buildPushControls() {
        pushLayer.innerHTML = '';
        pushBtns = [];
        SHIFT_LINES.forEach(function (idx) {
          var top = ((idx + 0.5) / GRID * 100) + '%';
          var left = ((idx + 0.5) / GRID * 100) + '%';
          var bLeft = el('button', { class: 'cave-push cave-push-h left', style: 'top:' + top, text: '▶' });
          var bRight = el('button', { class: 'cave-push cave-push-h right', style: 'top:' + top, text: '◀' });
          var bUp = el('button', { class: 'cave-push cave-push-v up', style: 'left:' + left, text: '▼' });
          var bDown = el('button', { class: 'cave-push cave-push-v down', style: 'left:' + left, text: '▲' });
          bLeft.addEventListener('click', function () { doPush('row', idx, -1); });
          bRight.addEventListener('click', function () { doPush('row', idx, 1); });
          bUp.addEventListener('click', function () { doPush('col', idx, -1); });
          bDown.addEventListener('click', function () { doPush('col', idx, 1); });
          [bLeft, bRight, bUp, bDown].forEach(function (b) { pushLayer.appendChild(b); pushBtns.push(b); });
        });
      }
      function syncPushControls() {
        pushBtns.forEach(function (b) { b.disabled = phase !== 'push' || busy; });
        rotateBtn.disabled = phase !== 'push' || busy;
      }

      /* ── Runde ── */
      function beginRound() {
        phase = 'push';
        spare = randomTile(false);
        if (Math.random() < 0.7) spare.item = rollItem('mid');
        renderSpare();
        movesLeft = PLAYER_MOVES;
        syncPushControls();
        syncInfo();
        pushHint.textContent = huntingActive
          ? 'Nutze das Labyrinth: schiebe Smaug aus, dann lauf zum Ausgang!'
          : 'Ersatzkachel drehen, dann eine Reihe/Spalte schieben.';
      }

      function doPush(kind, idx, dir) {
        if (phase !== 'push' || busy) return;
        GK.sfx('whoosh');
        var line = kind === 'row' ? tiles[idx] : tiles.map(function (row) { return row[idx]; });
        var old = line.slice();
        var popped, fresh = spare;
        var next = new Array(GRID);
        if (dir === -1) {
          for (var i = 0; i < GRID - 1; i++) next[i] = old[i + 1];
          next[GRID - 1] = fresh;
          popped = old[0];
        } else {
          for (var i2 = GRID - 1; i2 > 0; i2--) next[i2] = old[i2 - 1];
          next[0] = fresh;
          popped = old[GRID - 1];
        }
        if (kind === 'row') tiles[idx] = next;
        else for (var r = 0; r < GRID; r++) tiles[r][idx] = next[r];

        spare = popped;
        if (!spare.item && !spare.special) spare.item = rollItem('mid');

        function shiftPawn(p) {
          if (kind === 'row' && p.r === idx) p.c = ((p.c + dir) % GRID + GRID) % GRID;
          if (kind === 'col' && p.c === idx) p.r = ((p.r + dir) % GRID + GRID) % GRID;
        }
        shiftPawn(player);
        if (dragon.active) shiftPawn(dragon);

        phase = 'move';
        var res = bfs(player, PLAYER_MOVES);
        reachable = res.dist;
        renderBoard();
        placePawns(false);
        syncPushControls();
        syncInfo();

        /* Nur der Startpunkt selbst (dist 0) ist "erreichbar" — komplett
           eingemauert. Ohne Ausweg würde die Runde sonst nie enden. */
        if (Object.keys(reachable).length <= 1) {
          GK.toast('Kein Weg frei — die Runde geht ohne Bewegung weiter.', 'bad', '🧱');
          wait(500, function () { resolveMove([]); });
        }
      }

      function tileKey(r, c) { return r + ',' + c; }

      function onCellClick(e) {
        var cell = e.target.closest('.cave-cell.reachable');
        if (!cell || phase !== 'move' || busy) return;
        var r = +cell.dataset.r, c = +cell.dataset.c;
        var res = bfs(player, PLAYER_MOVES);
        var path = pathTo(res, { r: r, c: c });
        if (!path || path.length < 2) return;
        runPath(path.slice(1));
      }
      boardGrid.addEventListener('click', onCellClick);

      function runPath(steps, i) {
        i = i || 0;
        if (i >= steps.length) { resolveMove(steps); return; }
        busy = true;
        player.r = steps[i].r; player.c = steps[i].c;
        placePawns(true);
        GK.sfx('tick');
        wait(190, function () { runPath(steps, i + 1); });
      }

      var pendingLog = [];
      function resolveMove(steps) {
        busy = false;
        pendingLog = [];
        var gain = 0;
        steps.forEach(function (p) {
          var t = tiles[p.r][p.c];
          if (t.item) {
            var def = ITEM_DEFS[t.item];
            var g = def.awareness;
            if (shieldRounds > 0 && g > 0) g = Math.round(g * 0.5);
            gain += g;
            applyItem(t.item, tierOf(p.r, p.c));
            pendingLog.push(def.name);
            t.item = null;
          }
        });
        var tier = tierOf(player.r, player.c);
        gain += { inner: 4, mid: 2, outer: 1 }[tier];
        if (shieldRounds > 0) { shieldRounds--; }
        awareness = GK.clamp(awareness + gain, 0, 100);

        renderBoard();
        placePawns(false);
        finishAfterMove();
      }

      function applyItem(id, tier) {
        var def = ITEM_DEFS[id];
        var factor = TIER_FACTOR[tier];
        if (def.special === 'star') { starActive = true; GK.toast('Stern! Der nächste Fund zählt doppelt ✨', 'gold', '⭐'); return; }
        if (def.special === 'shield') { shieldRounds += 3; GK.toast('Zaubertrank getrunken — kurzzeitig weniger Verdacht 🧪', 'gold', '🧪'); GK.sfx('gem'); return; }
        if (def.special === 'key') {
          keys++;
          GK.toast('Schlüssel gefunden (' + keys + '/' + KEYS_NEEDED + ') 🗝️', 'gold', '🗝️');
          GK.sfx('coin');
          if (keys >= KEYS_NEEDED && !hoardUnlocked) {
            hoardUnlocked = true;
            tiles[HOARD.r][HOARD.c].mask = N | E | S | W;
            GK.toast('Alle Schlüssel! Smaugs Hort ist offen 🔓', 'gold', '🔓');
          }
          return;
        }
        var base = GK.rnd(def.base[0], def.base[1]);
        var delta = base * factor;
        if (def.danger) { GK.sfx('boom'); GK.shake(boardWrap); }
        else GK.sfx(id === 'gold' ? 'coin' : 'gem');
        if (starActive && delta > 0) { delta *= 2; starActive = false; GK.toast('Doppelt dank Stern!', 'win', '✨'); }
        mult = Math.max(0.3, mult + delta);
      }

      function finishAfterMove() {
        var landedHoard = (player.r === HOARD.r && player.c === HOARD.c);
        if (landedHoard && hoardUnlocked && !hoardLooted) { openHoardModal(afterHoard); return; }
        afterHoard();
      }

      function afterHoard() {
        var stageIdx = stageOf(awareness);
        if (stageIdx === STAGES.length - 1 && !huntingActive) activateHunt();

        if (huntingActive && player.r === EXIT.r && player.c === EXIT.c) { escape(); return; }

        if (huntingActive) { dragonTurn(); return; }

        syncInfo();
        beginRound();
      }

      function activateHunt() {
        huntingActive = true;
        dragon.active = true;
        dragon.r = HOARD.r; dragon.c = HOARD.c;
        tiles[HOARD.r][HOARD.c].mask = N | E | S | W;
        cashBtn.disabled = true;
        GK.sfx('growl');
        GK.shake(boardWrap, true);
        GK.toast('SMAUG IST WACH! Er jagt dich jetzt durchs Labyrinth!', 'bad', '🐉');
        placePawns(false);
      }

      function dragonTurn() {
        var res = bfs(dragon, undefined);
        var path = pathTo(res, player);
        var steps = path ? path.slice(1, 1 + DRAGON_MOVES) : [];
        stepDragon(steps, 0);
      }

      function stepDragon(steps, i) {
        if (i >= steps.length) { afterDragon(); return; }
        dragon.r = steps[i].r; dragon.c = steps[i].c;
        placePawns(true);
        GK.sfx('reel');
        if (dragon.r === player.r && dragon.c === player.c) { wait(220, caught); return; }
        wait(220, function () { stepDragon(steps, i + 1); });
      }

      function afterDragon() {
        if (dragon.r === player.r && dragon.c === player.c) { caught(); return; }
        syncInfo();
        beginRound();
      }

      /* ── Hort-Entscheidung ── */
      function openHoardModal(cb) {
        hoardLooted = true;
        var nodes = HOARD_CHOICES.map(function (h) {
          var btn = el('button', { class: 'btn cave-hoard-btn' }, [
            el('span', { class: 'cave-hoard-ic2', html: GK.iconHTML(h.icon) }),
            el('span', { class: 'cave-hoard-name', text: h.name }),
            el('span', { class: 'cave-hoard-risk', text: 'Risiko: ' + h.risk }),
            el('span', { class: 'cave-hoard-desc', text: h.desc })
          ]);
          btn.addEventListener('click', function () {
            GK.sfx('cash');
            var bonus = h.bonus;
            if (h.id === 'arken') {
              if (Math.random() < 0.12) { bonus = 90; GK.emojiRain(['👑', '💎', '✨'], 32); GK.toast('DER ARKENSTEIN! Unglaublicher Fund!', 'gold', '👑'); }
              else { bonus = 8; GK.toast('Nur vergoldeter Kies — aber immerhin.', 'bad', '💨'); }
            }
            mult += bonus;
            awareness = GK.clamp(awareness + h.awareness, 0, 100);
            GK.closeModal();
            cb();
          });
          return btn;
        });
        GK.modal({
          icon: 'dragonred',
          title: 'Smaugs Hort',
          text: 'Der Berg aus Gold glänzt im Feuerschein. Smaug schläft — für jetzt. Was nimmst du mit?',
          nodes: [el('div', { class: 'cave-hoard-grid' }, nodes)],
          locked: true
        });
      }

      /* ── Ende ── */
      function escape() {
        running = false; busy = false;
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        GK.logPlay('Smaugs Höhle', stake, win);
        GK.setResult(resultBox, 'Entkommen! ' + fmtX(mult) + ' → ' + GK.fmtSigned(win - stake), 'win');
        GK.celebrate(win - stake, mult);
        GK.emojiRain(['🐉', '💰', '🏃'], 26);
        endUI();
      }

      function cashOut() {
        if (!running || busy || huntingActive) return;
        running = false; busy = false;
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        GK.logPlay('Smaugs Höhle', stake, win);
        GK.setResult(resultBox, 'Rechtzeitig geflohen — ' + fmtX(mult) + ' → ' + GK.fmtSigned(win - stake), 'win');
        GK.celebrate(win - stake, mult);
        endUI();
      }

      function caught() {
        running = false; busy = false;
        GK.payout(0, { stake: stake });
        GK.logPlay('Smaugs Höhle', stake, 0);
        GK.setResult(resultBox, 'Smaug hat dich erwischt — Schatz und Einsatz verbrannt.', 'lose');
        GK.sfx('boom');
        boardWrap.classList.add('cave-caught');
        GK.shake(boardWrap, true);
        wait(1300, function () { boardWrap.classList.remove('cave-caught'); });
        endUI();
      }

      function endUI() {
        phase = 'idle';
        goBtn.disabled = false;
        cashBtn.disabled = true;
        bet.disable(false);
        syncPushControls();
        syncInfo();
      }

      /* ── Anzeige ── */
      function syncInfo() {
        var stageIdx = stageOf(awareness);
        var st = STAGES[stageIdx];
        awareBar.style.width = awareness + '%';
        awareBar.className = 'cave-aware-fill ' + st.cls;
        awareLabel.textContent = running
          ? (huntingActive ? 'SMAUG JAGT DICH!' : 'Smaug: ' + st.name + ' (' + Math.round(awareness) + '%)')
          : 'Smaug schläft tief.';

        multBox.querySelector('b').textContent = fmtX(mult);
        keysBox.querySelector('b').textContent = keys + '/' + KEYS_NEEDED;
        cashBox.querySelector('b').textContent = running ? GK.fmt(Math.floor(stake * mult)) : '0';
        cashBtn.textContent = running ? '🏃 FLIEHEN (' + GK.fmt(Math.floor(stake * mult)) + ')' : '🏃 FLIEHEN & SICHERN';
        cashBtn.disabled = !running || huntingActive || busy;

        if (running && huntingActive) {
          var dRes = bfs(dragon, undefined);
          var dk = player.r + ',' + player.c;
          distBox.querySelector('b').textContent = dRes.dist[dk] !== undefined ? dRes.dist[dk] : '—';
        } else {
          distBox.querySelector('b').textContent = '—';
        }
      }

      /* ── Start ── */
      function start() {
        if (running || stopped) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Smaugs Höhle')) return;

        running = true; busy = false;
        setupBoard();
        renderBoard();
        placePawns(false);
        GK.setResult(resultBox, 'Du schleichst dich in die Höhle…', '');
        GK.sfx('whoosh');
        goBtn.disabled = true;
        bet.disable(true);
        beginRound();
      }

      rotateBtn.addEventListener('click', function () {
        if (phase !== 'push' || busy) return;
        spare.mask = rotateMask(spare.mask);
        renderSpare();
        GK.sfx('tick');
      });
      goBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('click'); cashOut(); });

      setupBoard();
      buildPushControls();
      renderBoard();
      placePawns(false);
      syncPushControls();
      syncInfo();

      return function () {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    }
  });
})(window.GK);
