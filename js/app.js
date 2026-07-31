/* ═══════════════════════════════════════════════════════════
   GAMBAKING — App: Lobby, Leaderboard, Spieler, Admin-Modus
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';
  var el = GK.el, $ = GK.$, $$ = GK.$$;

  var boardSort = 'balance';
  var currentCleanup = null;

  /* ─────────────── VIEWS ─────────────── */
  function showView(id) {
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === id); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openGame(id) {
    var g = GK.gameById(id);
    if (!g) return;
    if (!GK.isUnlocked(g)) {
      GK.toast(g.name + ' ist noch gesperrt — ab Level ' + g.minLevel, 'bad', '🔒');
      GK.sfx('error');
      return;
    }
    closeGame();
    $('#game-title').innerHTML = (g.icon ? GK.iconHTML(g.icon, 'title-ic') : '') + '<span>' + g.name + '</span>';
    var stageEl = $('#game-stage');
    stageEl.innerHTML = '';
    document.documentElement.style.setProperty('--game-color', g.color);
    currentCleanup = g.mount(stageEl) || null;
    $('#btn-rules').onclick = function () { showRules(g); };
    showView('view-game');
    GK.sfx('whoosh');
  }

  function closeGame() {
    if (currentCleanup) { try { currentCleanup(); } catch (e) {} }
    currentCleanup = null;
    $('#game-stage').innerHTML = '';
  }

  function showRules(g) {
    GK.sfx('click');
    var ul = el('ul', { class: 'rules-list' }, (g.rules || []).map(function (r) {
      return el('li', { html: r });
    }));
    GK.modal({
      icon: g.icon,
      title: g.name,
      text: g.blurb,
      nodes: [ul, el('p', { class: 'hint', html: '⚠️ Alle Chips sind <b>reine Fantasie</b> — kein echtes Geld, keine Auszahlung.' })]
    });
  }

  /* ─────────────── LOBBY ─────────────── */
  function renderGames() {
    var grid = $('#game-grid');
    grid.innerHTML = '';
    GK.games.forEach(function (g, i) {
      var open = GK.isUnlocked(g);
      var kids = [
        el('span', { class: 'game-badge', text: g.badge }),
        el('span', { class: 'game-emoji', html: g.icon ? GK.iconHTML(g.icon) : '' }),
        el('div', {}, [
          el('div', { class: 'game-name', text: g.name }),
          el('div', { class: 'game-blurb', text: g.blurb })
        ])
      ];
      if (!open) {
        kids.push(el('div', { class: 'lock-veil' }, [
          el('span', { class: 'lk', html: GK.iconHTML('lock') }),
          el('span', { class: 'lt', text: 'AB LEVEL ' + g.minLevel })
        ]));
      }
      var card = el('button', {
        class: 'game-card' + (open ? '' : ' locked'),
        style: '--c1:' + g.color + ';animation-delay:' + (i * 40) + 'ms'
      }, kids);

      card.addEventListener('click', function () {
        if (!GK.isUnlocked(g)) {
          var info = GK.levelInfo();
          GK.sfx('error');
          GK.shake(card);
          GK.toast(g.name + ' öffnet sich ab Level ' + g.minLevel + ' — du bist Level ' + (info ? info.level : 1), 'bad', '🔒');
          return;
        }
        GK.sfx('click');
        openGame(g.id);
      });
      card.addEventListener('mouseenter', function () { GK.sfx('hover'); });
      grid.appendChild(card);
    });
  }

  /* ─────────────── LEVEL ─────────────── */
  function nextUnlock(level) {
    var best = null;
    GK.games.forEach(function (g) {
      if (g.minLevel && g.minLevel > level && (!best || g.minLevel < best.minLevel)) best = g;
    });
    return best;
  }

  function renderLevel() {
    var info = GK.levelInfo();
    var lv = $('#level-value'), fill = $('#xp-fill'), card = $('#level-card');

    if (!info) {
      if (lv) lv.textContent = '1';
      if (fill) fill.style.width = '0%';
      if (card) card.innerHTML = '';
      return;
    }
    if (lv) lv.textContent = info.level;
    if (fill) fill.style.width = info.pct + '%';
    if (!card) return;

    var nxt = nextUnlock(info.level);
    card.innerHTML = '';
    card.appendChild(el('div', { class: 'lc-top' }, [
      el('span', { class: 'lc-badge', text: 'LEVEL ' + info.level }),
      el('span', { class: 'lc-title', text: info.title.icon + ' ' + info.title.title }),
      el('span', { class: 'lc-xp', text: info.max ? 'MAX' : GK.fmt(info.have) + ' / ' + GK.fmt(info.need) + ' XP' })
    ]));
    var bar = el('div', { class: 'lc-bar' }, [el('i')]);
    card.appendChild(bar);
    requestAnimationFrame(function () { bar.firstChild.style.width = info.pct + '%'; });
    card.appendChild(el('div', {
      class: 'lc-next',
      html: nxt
        ? '🔒 <b>' + nxt.name + '</b> schaltet auf Level ' + nxt.minLevel + ' frei — noch ' +
          GK.fmt(GK.xpForLevel(nxt.minLevel) - info.xp) + ' XP'
        : '✅ Alle Spiele freigeschaltet. Jedes Level bringt weiter Chips.'
    }));
  }

  function celebrateLevel(data) {
    var pop = el('div', { class: 'levelup-pop' }, [
      el('div', { class: 'levelup-inner' }, [
        el('div', { class: 'l1', text: 'LEVEL ' + data.level + '!' }),
        el('div', { class: 'l2', text: '+' + GK.fmt(data.reward) + ' Chips geschenkt' }),
        el('div', { class: 'l3', text: GK.titleOf(data.level).icon + ' ' + GK.titleOf(data.level).title })
      ])
    ]);
    document.body.appendChild(pop);
    setTimeout(function () { pop.remove(); }, 2700);

    GK.sfx('jackpot');
    GK.confetti(200);
    GK.emojiRain(['⭐', '🎉', '👑', '💎'], 26);
    $('#hud-level').classList.add('levelup');
    setTimeout(function () { $('#hud-level').classList.remove('levelup'); }, 700);

    var freshly = GK.games.filter(function (g) { return g.minLevel === data.level; });
    freshly.forEach(function (g) {
      GK.toast(g.name + ' ist jetzt freigeschaltet!', 'gold', '🔓');
      GK.logFeed(GK.player().name + ' schaltet ' + g.name + ' frei (Level ' + data.level + ')', 'admin');
    });
    renderGames();
    if (freshly.length) {
      setTimeout(function () {
        $$('.game-card').forEach(function (c, i) {
          if (GK.games[i] && freshly.indexOf(GK.games[i]) >= 0) c.classList.add('fresh');
        });
      }, 60);
    }
    renderLevel();
  }

  function renderMarquee() {
    var track = $('#marquee-track');
    var players = GK.playerList().sort(function (a, b) { return b.balance - a.balance; });
    var lines = [
      '👑 GAMBAKING — DAS FANTASY CASINO',
      '💸 KEIN ECHTGELD · NUR EHRE',
      '🎰 13 SPIELE · 1 KRONE',
      '🔥 WER TRAUT SICH ALL IN?',
      '⭐ LEVEL STEIGEN · SPIELE FREISCHALTEN',
      '🃏 HAUS GEWINNT? NICHT HEUTE',
      '🚀 CASH OUT IST FÜR FEIGLINGE'
    ];
    if (players.length) {
      lines.splice(1, 0, '🏆 SPITZENREITER: ' + players[0].name.toUpperCase() + ' MIT ' + GK.fmt(players[0].balance) + ' CHIPS');
    }
    var html = lines.map(function (l) { return '<span>' + l + '</span>'; }).join('');
    track.innerHTML = html + html;
  }

  function renderBoard() {
    var box = $('#leaderboard');
    box.innerHTML = '';
    var players = GK.playerList();
    if (!players.length) {
      box.appendChild(el('div', { class: 'feed-empty', text: 'Noch keine Spieler. Leg los und hol dir die Krone!' }));
      return;
    }
    players.sort(function (a, b) {
      if (boardSort === 'profit') return GK.profitOf(b) - GK.profitOf(a);
      if (boardSort === 'biggestWin') return b.biggestWin - a.biggestWin;
      if (boardSort === 'plays') return b.plays - a.plays;
      return b.balance - a.balance;
    });

    var me = GK.player();
    var medals = ['🥇', '🥈', '🥉'];
    players.forEach(function (p, i) {
      var profit = GK.profitOf(p);
      var val, sub;
      if (boardSort === 'profit') { val = GK.fmtSigned(profit); sub = GK.fmt(p.balance) + ' Chips'; }
      else if (boardSort === 'biggestWin') { val = '+' + GK.fmt(p.biggestWin); sub = 'bester Einzelwin'; }
      else if (boardSort === 'plays') { val = GK.fmt(p.plays); sub = p.wins + 'W / ' + p.losses + 'L'; }
      else { val = GK.fmt(p.balance); sub = GK.fmtSigned(profit) + ' Profit'; }

      var row = el('div', {
        class: 'board-row' + (me && me.id === p.id ? ' is-me' : ''),
        style: 'animation-delay:' + (i * 45) + 'ms'
      }, [
        el('div', { class: 'board-rank', text: medals[i] || '#' + (i + 1) }),
        el('div', { class: 'board-who' }, [
          el('span', { class: 'board-av', text: p.avatar }),
          el('div', { class: 'board-meta' }, [
            el('div', { class: 'board-nm', text: p.name + (me && me.id === p.id ? ' (du)' : '') }),
            el('div', { class: 'board-stats', text: '⭐ Lv ' + GK.levelOf(p.xp) + ' ' + GK.titleOf(GK.levelOf(p.xp)).title +
              ' · ' + p.plays + ' Spiele · ' + p.wins + ' Siege' })
          ])
        ]),
        el('div', { class: 'board-val ' + (boardSort === 'profit' ? (profit >= 0 ? 'pos' : 'neg') : '') }, [
          val, el('small', { text: sub })
        ])
      ]);
      row.addEventListener('click', function () {
        if (!me || me.id === p.id) return;
        GK.switchPlayer(p.id);
        GK.toast('Willkommen zurück, ' + p.name + '!', 'gold', p.avatar);
        GK.sfx('coin');
      });
      box.appendChild(row);
    });
  }

  function timeAgo(t) {
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'gerade eben';
    if (s < 3600) return Math.floor(s / 60) + ' Min.';
    if (s < 86400) return Math.floor(s / 3600) + ' Std.';
    return Math.floor(s / 86400) + ' T.';
  }

  function renderFeed() {
    var box = $('#feed');
    box.innerHTML = '';
    var feed = GK.state.feed;
    if (!feed.length) {
      box.appendChild(el('div', { class: 'feed-empty', text: 'Hier erscheint gleich, wer gerade abräumt (oder alles verliert).' }));
      return;
    }
    feed.slice(0, 25).forEach(function (f) {
      box.appendChild(el('div', { class: 'feed-item ' + (f.type || '') }, [
        el('span', { text: f.type === 'win' ? '🎉' : f.type === 'lose' ? '💀' : f.type === 'admin' ? '👑' : '🎲' }),
        el('span', { text: f.text }),
        el('span', { class: 'feed-when', text: timeAgo(f.t) })
      ]));
    });
  }

  function renderAll() {
    renderBoard();
    renderFeed();
    renderMarquee();
    renderLevel();
    GK.updateHUD();
  }

  /* ─────────────── SPIELER ─────────────── */
  function askName(first) {
    var nameInput = el('input', { class: 'input', type: 'text', maxlength: '18', placeholder: 'z.B. DrachenDave' });
    var chosen = GK.pick(GK.AVATARS);
    var picker = el('div', { class: 'avatar-pick' }, GK.AVATARS.map(function (a) {
      var b = el('button', { class: 'avatar-opt' + (a === chosen ? ' sel' : ''), text: a, type: 'button' });
      b.addEventListener('click', function () {
        chosen = a;
        $$('.avatar-opt', picker).forEach(function (x) { x.classList.toggle('sel', x.textContent === a); });
        GK.sfx('chip');
      });
      return b;
    }));

    var err = el('p', { class: 'hint', style: 'color:var(--red);display:none', text: 'Bitte gib einen Namen ein!' });
    var goBtn = el('button', { class: 'btn btn-gold btn-full', text: '👑 REIN INS CASINO' });

    function submit() {
      var name = nameInput.value.trim();
      if (!name) {
        err.style.display = '';
        GK.sfx('error');
        GK.shake($('#modal-root').querySelector('.modal'));
        return;
      }
      var p = GK.newPlayer(name, chosen);
      GK.closeModal();
      GK.updateHUD();
      GK.logFeed(p.name + ' betritt das Casino mit ' + GK.fmt(GK.START_BALANCE) + ' Chips', 'admin');
      renderAll();
      GK.toast('Willkommen, ' + p.name + '! ' + GK.fmt(GK.START_BALANCE) + ' Chips für dich 🎁', 'gold', p.avatar);
      GK.sfx('cash');
      GK.confetti(140);
      GK.emojiRain(['🎉', '👑', '🪙', '🎰'], 22);
    }

    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    goBtn.addEventListener('click', submit);

    GK.modal({
      emoji: '👑',
      title: first ? 'Willkommen im GambaKing!' : 'Neuer Spieler',
      text: 'Wie heißt du am Tisch? Jeder startet mit <b>' + GK.fmt(GK.START_BALANCE) + ' Chips</b>. ' +
            'Es geht um <b>kein echtes Geld</b> — nur um Ehre, Angeben und die Krone.',
      locked: !!first,
      nodes: [
        el('div', { class: 'field' }, [el('label', { text: 'DEIN SPIELERNAME' }), nameInput]),
        el('div', { class: 'field' }, [el('label', { text: 'WÄHL DEINEN AVATAR' }), picker]),
        err,
        el('div', { class: 'modal-actions' }, [goBtn])
      ]
    });
    setTimeout(function () { nameInput.focus(); }, 200);
  }

  function playerSwitcher() {
    GK.sfx('click');
    var players = GK.playerList().sort(function (a, b) { return b.balance - a.balance; });
    var me = GK.player();
    var list = el('div', { class: 'admin-players' }, players.map(function (p) {
      var row = el('div', { class: 'admin-row' + (me && me.id === p.id ? ' sel' : '') }, [
        el('div', { class: 'who' }, [
          el('span', { style: 'font-size:1.5rem', text: p.avatar }),
          el('div', {}, [
            el('div', { class: 'nm', text: p.name }),
            el('div', { style: 'font-size:.7rem;color:var(--muted)', text: p.plays + ' Spiele · ' + GK.fmtSigned(GK.profitOf(p)) + ' Profit' })
          ])
        ]),
        el('span', { class: 'bal', text: GK.fmt(p.balance) })
      ]);
      row.addEventListener('click', function () {
        GK.switchPlayer(p.id);
        GK.closeModal();
        renderAll();
        GK.toast('Jetzt am Zug: ' + p.name, 'gold', p.avatar);
        GK.sfx('coin');
      });
      return row;
    }));

    var addBtn = el('button', { class: 'btn btn-full', text: '➕ NEUEN SPIELER ANLEGEN' });
    addBtn.addEventListener('click', function () { GK.closeModal(); setTimeout(function () { askName(false); }, 120); });

    GK.modal({
      emoji: '🎭',
      title: 'Spieler wechseln',
      text: 'Alle sitzen am selben Tisch (same device). Wähl aus, wer gerade zockt.',
      nodes: [list, el('div', { class: 'modal-actions' }, [addBtn])]
    });
  }

  function dailyBonus() {
    var p = GK.player();
    if (!p) return;
    var DAY = 24 * 3600 * 1000;
    var left = (p.lastBonus || 0) + DAY - Date.now();
    if (left > 0) {
      var h = Math.ceil(left / 3600000);
      GK.toast('Tagesbonus schon abgeholt — komm in ' + h + ' Std. wieder 😴', 'bad', '⏳');
      GK.sfx('error');
      return;
    }
    GK.claimBonus().then(function (ok) {
      if (!ok) return;
      GK.logFeed(p.name + ' hat den Tagesbonus (+250) abgeholt', 'admin');
      GK.toast('Tagesbonus! +250 Chips 🎁', 'gold', '🎁');
      GK.sfx('cash');
      GK.confetti(90);
      GK.emojiRain(['🎁', '🪙'], 16);
      renderAll();
    });
  }

  /* ─────────────── SOUND & MUSIK ─────────────── */
  function soundMenu() {
    GK.sfx('click');
    var M = GK.music;

    var trackRows = [];
    var list = el('div', { class: 'track-list' }, M.tracks.map(function (t, i) {
      var fast = t.bpm >= 125;
      var row = el('button', {
        class: 'track-row' + (i === M.trackIdx && M.enabled ? ' playing' : '') + (fast ? ' fast' : '')
      }, [
        el('span', { class: 'tr-eq' }, [el('i'), el('i'), el('i')]),
        el('span', { class: 'tr-meta' }, [
          el('span', { class: 'tr-name', text: t.name }),
          el('span', { class: 'tr-mood', text: t.mood })
        ]),
        el('span', { class: 'tr-bpm', text: (fast ? '⚡ ' : '') + t.bpm }),
        el('span', { class: 'tr-play', text: i === M.trackIdx && M.enabled ? '⏸' : '▶' })
      ]);
      row.addEventListener('click', function () {
        if (i === M.trackIdx && M.enabled) { M.stop(); }
        else { M.setTrack(i); }
        sync();
        GK.sfx('chip');
      });
      trackRows.push(row);
      return row;
    }));

    var musicVol = el('input', { type: 'range', min: '0', max: '100', step: '5', value: M.volume });
    var musicVolLabel = el('b', { text: M.volume });
    var sfxVol = el('input', { type: 'range', min: '0', max: '100', step: '5', value: GK.volume() });
    var sfxVolLabel = el('b', { text: GK.volume() });
    var offBtn = el('button', { class: 'btn btn-danger btn-full', text: '🔇 MUSIK AUS' });

    function sync() {
      trackRows.forEach(function (r, i) {
        var on = i === M.trackIdx && M.enabled;
        r.classList.toggle('playing', on);
        r.querySelector('.tr-play').textContent = on ? '⏸' : '▶';
      });
      offBtn.textContent = M.enabled ? '🔇 MUSIK AUS' : '🎵 MUSIK AN';
      offBtn.className = 'btn btn-full ' + (M.enabled ? 'btn-danger' : 'btn-lime');
      musicVolLabel.textContent = M.volume;
      sfxVolLabel.textContent = GK.volume();
      if ($('#vol-slider')) $('#vol-slider').value = GK.volume();
    }

    musicVol.addEventListener('input', function () { M.setVolume(musicVol.value); sync(); });
    sfxVol.addEventListener('input', function () { GK.setVolume(sfxVol.value); sync(); });
    sfxVol.addEventListener('change', function () { GK.sfx('coin'); });
    offBtn.addEventListener('click', function () { M.toggle(); sync(); GK.sfx('click'); });

    GK.modal({
      emoji: '🎵',
      title: 'Musik & Sound',
      text: 'Acht Loops, live im Browser erzeugt — vier ruhige und vier schnelle. Keine Downloads, jederzeit abschaltbar.',
      nodes: [
        el('div', { class: 'bet-label', text: 'HINTERGRUND-TRACKS' }),
        el('div', { style: 'height:8px' }),
        list,
        el('div', { style: 'height:14px' }),
        el('div', { class: 'bet-label', text: 'MUSIK-LAUTSTÄRKE' }),
        el('div', { class: 'range-row' }, [musicVol, el('div', { class: 'info-box', style: 'min-width:66px' }, [musicVolLabel, el('span', { text: 'Musik' })])]),
        el('div', { style: 'height:10px' }),
        el('div', { class: 'bet-label', text: 'SPIEL-SOUNDS' }),
        el('div', { class: 'range-row' }, [sfxVol, el('div', { class: 'info-box', style: 'min-width:66px' }, [sfxVolLabel, el('span', { text: 'Effekte' })])]),
        el('div', { style: 'height:14px' }),
        offBtn
      ]
    });
    sync();
  }

  /* ─────────────── ADMIN ─────────────── */
  function adminEntry() {
    GK.sfx('click');
    if (GK.state.admin) { adminPanel(); return; }

    var pin = el('input', { class: 'input', type: 'password', placeholder: '••••', maxlength: '12' });
    var err = el('p', { class: 'hint', style: 'color:var(--red);display:none', text: 'Falsche PIN! Der Türsteher schaut böse.' });
    var ok = el('button', { class: 'btn btn-full', text: '🔓 EINLOGGEN' });

    function tryPin() {
      var entered = pin.value;
      ok.disabled = true;
      GK.net.adminLogin(entered).then(function (good) {
        ok.disabled = false;
        if (good) {
          GK.state.admin = true;
          GK.closeModal();
          $('#btn-admin').classList.add('admin-on');
          GK.toast('Admin-Modus aktiv 👑 Du bist jetzt der König.', 'gold', '🛡️');
          GK.sfx('jackpot');
          GK.emojiRain(['👑', '🛡️', '💸'], 20);
          setTimeout(adminPanel, 400);
        } else {
          err.style.display = '';
          pin.value = '';
          GK.sfx('error');
          GK.shake($('#modal-root').querySelector('.modal'));
        }
      });
    }
    pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPin(); });
    ok.addEventListener('click', tryPin);

    GK.modal({
      emoji: '🛡️',
      title: 'Admin-Modus',
      text: 'Nur für den Spielleiter. Standard-PIN ist <b>1337</b> (im Panel änderbar).',
      nodes: [
        el('div', { class: 'field' }, [el('label', { text: 'ADMIN-PIN' }), pin]),
        err,
        el('div', { class: 'modal-actions' }, [ok])
      ]
    });
  }

  function adminPanel() {
    var selectedId = (GK.player() || {}).id || null;

    var listBox = el('div', { class: 'admin-players' });
    var amount = el('input', { class: 'input', type: 'number', value: '500', step: '50' });

    function renderList() {
      listBox.innerHTML = '';
      var players = GK.playerList().sort(function (a, b) { return b.balance - a.balance; });
      if (!players.length) {
        listBox.appendChild(el('div', { class: 'feed-empty', text: 'Keine Spieler vorhanden.' }));
        return;
      }
      players.forEach(function (p) {
        var row = el('div', { class: 'admin-row' + (p.id === selectedId ? ' sel' : '') }, [
          el('div', { class: 'who' }, [
            el('span', { style: 'font-size:1.4rem', text: p.avatar }),
            el('div', {}, [
              el('div', { class: 'nm', text: p.name }),
              el('div', { style: 'font-size:.68rem;color:var(--muted)', text: 'Luck ' + p.luck + ' · ' + p.plays + ' Spiele' })
            ])
          ]),
          el('span', { class: 'bal', text: GK.fmt(p.balance) }),
          el('button', { class: 'mini-btn danger', text: '🗑', title: 'Spieler löschen', onClick: function (e) {
            e.stopPropagation();
            if (!window.confirm('Spieler "' + p.name + '" wirklich löschen?')) return;
            GK.deletePlayer(p.id);
            if (selectedId === p.id) selectedId = (GK.player() || {}).id || null;
            GK.logFeed('👑 ADMIN: ' + p.name + ' wurde entfernt', 'admin');
            renderList(); renderAll(); syncLuck();
            GK.sfx('error');
          } })
        ]);
        row.querySelector('.who').addEventListener('click', function () {
          selectedId = p.id;
          renderList();
          syncLuck();
          GK.sfx('chip');
        });
        listBox.appendChild(row);
      });
    }

    function target() { return GK.state.players[selectedId] || null; }

    function give(mult) {
      var p = target();
      if (!p) { GK.toast('Erst einen Spieler auswählen!', 'bad', '👆'); return; }
      var amt = Math.floor(Number(amount.value) || 0) * mult;
      if (!amt) return;
      GK.grant(p.id, amt);
      renderList(); renderAll();
    }

    function setBalance() {
      var p = target();
      if (!p) { GK.toast('Erst einen Spieler auswählen!', 'bad', '👆'); return; }
      var amt = Math.max(0, Math.floor(Number(amount.value) || 0));
      GK.grant(p.id, amt - p.balance);
      renderList(); renderAll();
    }

    /* ── XP verschenken ── */
    var xpAmount = el('input', { class: 'input', type: 'number', value: '250', step: '50' });

    function giveXp(sign) {
      var p = target();
      if (!p) { GK.toast('Erst einen Spieler auswählen!', 'bad', '👆'); return; }
      var amt = Math.floor(Number(xpAmount.value) || 0) * sign;
      if (!amt) return;

      var beforeLvl = GK.levelOf(p.xp || 0);
      p.xp = Math.max(0, (p.xp || 0) + amt);
      var afterLvl = GK.levelOf(p.xp);
      if (afterLvl < (p.claimedLevel || 1)) p.claimedLevel = afterLvl;
      if (afterLvl > beforeLvl) {
        var reward = 0;
        for (var l = beforeLvl + 1; l <= afterLvl; l++) reward += GK.levelReward(l);
        p.balance += reward;
        p.granted = (p.granted || 0) + reward;
        p.peak = Math.max(p.peak, p.balance);
        p.claimedLevel = afterLvl;
      }
      GK.commit('grantXp', { id: p.id, amount: amt });

      GK.logFeed('👑 ADMIN: ' + p.name + (amt >= 0 ? ' bekommt ' : ' verliert ') + GK.fmt(Math.abs(amt)) + ' XP', 'admin');
      GK.toast(p.name + ': ' + GK.fmtSigned(amt) + ' XP  (Level ' + afterLvl + ')', amt >= 0 ? 'gold' : 'bad', '⭐');
      GK.sfx(amt >= 0 ? 'cash' : 'error');
      if (amt >= 0) GK.emojiRain(['⭐', '✨'], 14);

      // War der aktive Spieler gemeint, feiern wir den Aufstieg richtig
      var me = GK.player();
      if (me && me.id === p.id && afterLvl > beforeLvl) {
        celebrateLevel({ level: afterLvl, reward: reward || 0 });
      }
      renderList(); renderAll(); syncLuck();
    }

    var xpQuick = el('div', { class: 'bet-quick' }, [
      el('button', { class: 'chip-btn', text: '+100 XP', onClick: function () { xpAmount.value = 100; giveXp(1); } }),
      el('button', { class: 'chip-btn', text: '+500 XP', onClick: function () { xpAmount.value = 500; giveXp(1); } }),
      el('button', { class: 'chip-btn', text: '+2000 XP', onClick: function () { xpAmount.value = 2000; giveXp(1); } }),
      el('button', { class: 'chip-btn', text: '➖ abziehen', onClick: function () { giveXp(-1); } })
    ]);
    var xpGiveBtn = el('button', { class: 'btn btn-lime btn-full', text: '⭐ XP GEBEN', onClick: function () { giveXp(1); } });

    var xpAllBtn = el('button', { class: 'btn btn-ghost btn-small', text: '⭐ ALLEN XP GEBEN', onClick: function () {
      var amt = Math.floor(Number(xpAmount.value) || 0);
      if (!amt) return;
      GK.playerList().forEach(function (p) {
        p.xp = Math.max(0, (p.xp || 0) + amt);
        var lvl = GK.levelOf(p.xp);
        var claimed = p.claimedLevel || 1;
        var rew = 0;
        while (claimed < lvl) { claimed++; rew += GK.levelReward(claimed); }
        if (rew) { p.balance += rew; p.granted = (p.granted || 0) + rew; }
        p.claimedLevel = claimed;
        GK.commit('grantXp', { id: p.id, amount: amt });
      });
      GK.logFeed('👑 ADMIN: Alle bekommen ' + GK.fmt(amt) + ' XP!', 'admin');
      GK.toast('XP-Regen für alle! ⭐', 'gold', '⭐');
      GK.sfx('jackpot');
      GK.confetti(160);
      renderList(); renderAll();
    } });

    var luckSlider = el('input', { type: 'range', min: '0', max: '100', step: '5', value: '50' });
    var luckVal = el('b', { text: '50' });
    function syncLuck() {
      var p = target();
      luckSlider.value = p ? p.luck : 50;
      luckVal.textContent = (p ? p.luck : 50) + (p && p.luck > 50 ? ' 🍀' : (p && p.luck < 50 ? ' 💀' : ' ⚖️'));
    }
    luckSlider.addEventListener('input', function () {
      var p = target();
      if (!p) return;
      p.luck = Number(luckSlider.value);
      syncLuck();
      renderList();
    });
    // erst beim Loslassen zum Server, nicht bei jedem Pixel
    luckSlider.addEventListener('change', function () {
      var p = target();
      if (!p) return;
      GK.commit('luck', { id: p.id, luck: p.luck });
    });

    var quick = el('div', { class: 'bet-quick' }, [
      el('button', { class: 'chip-btn', text: '+100', onClick: function () { amount.value = 100; give(1); } }),
      el('button', { class: 'chip-btn', text: '+500', onClick: function () { amount.value = 500; give(1); } }),
      el('button', { class: 'chip-btn', text: '+1000', onClick: function () { amount.value = 1000; give(1); } }),
      el('button', { class: 'chip-btn', text: '+10000', onClick: function () { amount.value = 10000; give(1); } })
    ]);

    var giveBtn = el('button', { class: 'btn btn-lime', text: '💸 GEBEN', onClick: function () { give(1); } });
    var takeBtn = el('button', { class: 'btn btn-danger', text: '✂️ ABZIEHEN', onClick: function () { give(-1); } });
    var setBtn = el('button', { class: 'btn btn-ghost', text: '🎯 SETZEN AUF', onClick: setBalance });

    var allBtn = el('button', { class: 'btn btn-ghost btn-small', text: '🎁 ALLEN GEBEN', onClick: function () {
      var amt = Math.floor(Number(amount.value) || 0);
      if (!amt) return;
      GK.playerList().forEach(function (p) { GK.grant(p.id, amt, true); });
      GK.logFeed('👑 ADMIN: Alle bekommen ' + GK.fmt(amt) + ' Chips!', 'admin');
      GK.toast('Chips-Regen für alle! 💸', 'gold', '🎉');
      GK.sfx('jackpot');
      GK.confetti(180);
      GK.emojiRain(['💸', '🪙', '💰', '🎉'], 30);
      renderList(); renderAll();
    } });

    var resetBtn = el('button', { class: 'btn btn-ghost btn-small', text: '♻️ ALLE AUF 500', onClick: function () {
      if (!window.confirm('Alle Spieler auf ' + GK.START_BALANCE + ' Chips zurücksetzen?')) return;
      GK.playerList().forEach(function (p) {
        p.balance = GK.START_BALANCE;
        p.granted = 0; p.wagered = 0; p.returned = 0;
        p.plays = 0; p.wins = 0; p.losses = 0;
        p.biggestWin = 0; p.peak = GK.START_BALANCE;
        p.xp = 0; p.claimedLevel = 1;
      });
      GK.commit('resetAll', {});
      GK.logFeed('👑 ADMIN: Neue Runde — alle zurück auf ' + GK.START_BALANCE, 'admin');
      GK.toast('Alle Konten zurückgesetzt ♻️', 'gold', '♻️');
      GK.sfx('cash');
      renderList(); renderAll();
    } });

    var pinBtn = el('button', { class: 'btn btn-ghost btn-small', text: '🔑 PIN ÄNDERN', onClick: function () {
      var np = window.prompt('Neue Admin-PIN:', GK.state.settings.adminPin);
      if (np === null) return;
      np = String(np).trim();
      if (!np) { GK.toast('PIN darf nicht leer sein', 'bad', '⚠️'); return; }
      GK.state.settings.adminPin = np;
      GK.commit('setPin', { pin: np });
      GK.toast('Neue PIN gespeichert 🔑', 'gold', '🔑');
    } });

    var wipeBtn = el('button', { class: 'btn btn-danger btn-small', text: '🗑 ALLE DATEN LÖSCHEN', onClick: function () {
      if (!window.confirm('Wirklich ALLE Spieler, Chips und Statistiken unwiderruflich löschen?')) return;
      if (!window.confirm('Ganz sicher? Das trifft alle Spieler auf dem Server.')) return;
      GK.wipe().then(function () { location.reload(); });
    } });

    var exitBtn = el('button', { class: 'btn btn-ghost btn-small', text: '🚪 ADMIN VERLASSEN', onClick: function () {
      GK.state.admin = false;
      $('#btn-admin').classList.remove('admin-on');
      GK.closeModal();
      GK.toast('Admin-Modus beendet', '', '🔒');
      GK.sfx('click');
    } });

    renderList();
    syncLuck();

    GK.modal({
      emoji: '👑',
      title: 'Admin-Panel',
      text: 'Spieler wählen, Chips verteilen, Schicksal manipulieren. Mit großer Macht kommt großes Chaos.',
      nodes: [
        el('div', { class: 'admin-note', html: '💡 <b>Money-Give:</b> Spieler antippen, Betrag eingeben, <b>GEBEN</b> drücken. Geschenkte Chips zählen nicht als Profit im Leaderboard.' }),
        el('div', { class: 'bet-label', text: 'SPIELER' }),
        el('div', { style: 'height:6px' }),
        listBox,
        el('div', { class: 'field' }, [el('label', { text: 'BETRAG' }), amount]),
        quick,
        el('div', { style: 'height:12px' }),
        el('div', { class: 'modal-actions' }, [giveBtn, takeBtn, setBtn]),
        el('div', { style: 'height:18px' }),
        el('div', { class: 'bet-label', text: 'ERFAHRUNG (XP & LEVEL)' }),
        el('div', { style: 'height:6px' }),
        el('div', { class: 'field' }, [el('label', { text: 'XP-BETRAG' }), xpAmount]),
        xpQuick,
        el('div', { style: 'height:10px' }),
        xpGiveBtn,
        el('div', { style: 'height:8px' }),
        el('div', { class: 'modal-actions' }, [xpAllBtn]),
        el('p', { class: 'hint', text: 'Level bringen Chips und schalten Spiele frei. XP abziehen kann ein Spiel auch wieder sperren.' }),
        el('div', { style: 'height:16px' }),
        el('div', { class: 'bet-label', text: 'GLÜCKS-REGLER (HEIMLICHER CHEAT)' }),
        el('div', { style: 'height:6px' }),
        el('div', { class: 'range-row' }, [luckSlider, el('div', { class: 'info-box', style: 'min-width:74px' }, [luckVal, el('span', { text: 'Luck' })])]),
        el('p', { class: 'hint', text: '0 = verflucht, 50 = neutral, 100 = gesegnet. Wirkt auf Slots, Roulette, Münze, Würfel, Crash, Rad, Plinko und Rubbellos.' }),
        el('div', { style: 'height:16px' }),
        el('div', { class: 'modal-actions' }, [allBtn, resetBtn]),
        el('div', { style: 'height:8px' }),
        el('div', { class: 'modal-actions' }, [pinBtn, exitBtn]),
        el('div', { style: 'height:16px' }),
        el('div', { class: 'admin-note', html: '⚠️ <b>Gefahrenzone:</b> löscht alle Spieler, Chips und Statistiken — für alle, auf dem Server. Nicht rückgängig zu machen.' }),
        el('div', { class: 'modal-actions' }, [wipeBtn])
      ]
    });
  }

  /* ─────────────── BOOT ─────────────── */
  function fillStaticIcons() {
    $$('[data-icon]').forEach(function (n) {
      if (!n.firstChild) n.innerHTML = GK.iconHTML(n.getAttribute('data-icon'));
    });
  }

  function boot() {
    GK.initFX();
    fillStaticIcons();
    renderGames();

    GK.init().then(function (online) {
      var note = $('#storage-note');
      if (note) {
        note.textContent = online
          ? 'Spielstände liegen auf dem Casino-Server'
          : 'Offline-Modus: Spielstände nur in diesem Browser';
      }
      if (!online) {
        GK.toast('Kein Server gefunden — Leaderboard bleibt lokal', 'bad', '📡');
      }
      renderAll();
      afterLoad();
    });

    // Header
    $('#brand-btn').addEventListener('click', function () { GK.sfx('click'); closeGame(); showView('view-lobby'); });
    $('#btn-back').addEventListener('click', function () { GK.sfx('click'); closeGame(); showView('view-lobby'); renderAll(); });
    $('#hud-player').addEventListener('click', playerSwitcher);
    $('#hud-balance').addEventListener('click', function () {
      GK.sfx('coin');
      var p = GK.player();
      if (p) GK.toast('Du hast ' + GK.fmt(p.balance) + ' Chips · ' + GK.fmtSigned(GK.profitOf(p)) + ' Profit', 'gold', '🪙');
    });
    var volSlider = $('#vol-slider');
    function syncSoundUI() {
      var on = GK.state.settings.sound !== false;
      var vol = GK.volume();
      $('#btn-sound').textContent = !on || vol === 0 ? '🔇' : (vol < 40 ? '🔉' : '🔊');
      $('#btn-sound').classList.toggle('off', !on);
      $('.sound-box').classList.toggle('muted', !on);
      volSlider.value = vol;
    }
    $('#btn-sound').addEventListener('click', function () {
      var on = GK.toggleSound();
      syncSoundUI();
      GK.toast(on ? 'Sound an 🔊' : 'Sound aus 🔇', '', on ? '🔊' : '🔇');
    });
    volSlider.addEventListener('input', function () {
      GK.setVolume(volSlider.value);
      syncSoundUI();
    });
    volSlider.addEventListener('change', function () {
      GK.setVolume(volSlider.value, true);   // kurzer Ton als Hörprobe
    });
    $('#btn-admin').addEventListener('click', adminEntry);
    $('#btn-music').addEventListener('click', soundMenu);

    // Lobby-Aktionen
    $('#btn-play-random').addEventListener('click', function () {
      GK.sfx('click');
      openGame(GK.pick(GK.unlockedGames()).id);
    });
    $('#btn-goto-board').addEventListener('click', function () {
      GK.sfx('click');
      showView('view-lobby');
      setTimeout(function () { $('#board-anchor').scrollIntoView({ behavior: 'smooth' }); }, 80);
    });
    $('#btn-daily').addEventListener('click', function () { GK.sfx('click'); dailyBonus(); });
    $('#btn-new-player').addEventListener('click', function () { GK.sfx('click'); askName(false); });

    $$('.board-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        boardSort = tab.dataset.sort;
        $$('.board-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        renderBoard();
        GK.sfx('chip');
      });
    });

    // Daten löschen gibt es nur noch im Admin-Panel

    // Modal schließen
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', GK.closeModal); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') GK.closeModal();
    });

    syncSoundUI();

    // Audio erst nach erster Interaktion starten (Browser-Policy)
    GK.music.load();
    var unlock = function () {
      GK.sound.init();
      GK.sound.resume();
      if (GK.music.wanted) GK.music.start();   // war beim letzten Mal an
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    GK.on('player-changed', function () {
      renderAll();
      // Vom Admin auf einem anderen Gerät gelöscht? Dann neu anmelden.
      if (!GK.player() && $('#modal-root').hidden) askName(true);
    });
    GK.on('feed', renderFeed);
    GK.on('xp', renderLevel);
    GK.on('level-up', celebrateLevel);

    // Feed-Zeiten frisch halten
    setInterval(renderFeed, 60000);

    // Regelmäßig den Stand der anderen holen, solange die Lobby offen ist
    GK.net.startPolling(function () {
      return $('#view-lobby').classList.contains('active');
    });
  }

  /** läuft, sobald Server- oder Offline-Daten geladen sind */
  function afterLoad() {
    if (!GK.player()) setTimeout(function () { askName(true); }, 450);
    else {
      GK.updateHUD();
      GK.toast('Willkommen zurück, ' + GK.player().name + '! 👑', 'gold', GK.player().avatar);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.GK);
