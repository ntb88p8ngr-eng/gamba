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
    closeGame();
    $('#game-title').textContent = g.emoji + ' ' + g.name;
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
      emoji: g.emoji,
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
      var card = el('button', { class: 'game-card', style: '--c1:' + g.color + ';animation-delay:' + (i * 40) + 'ms' }, [
        el('span', { class: 'game-badge', text: g.badge }),
        el('span', { class: 'game-emoji', text: g.emoji }),
        el('div', {}, [
          el('div', { class: 'game-name', text: g.name }),
          el('div', { class: 'game-blurb', text: g.blurb })
        ])
      ]);
      card.addEventListener('click', function () { GK.sfx('click'); openGame(g.id); });
      card.addEventListener('mouseenter', function () { GK.sfx('hover'); });
      grid.appendChild(card);
    });
  }

  function renderMarquee() {
    var track = $('#marquee-track');
    var players = GK.playerList().sort(function (a, b) { return b.balance - a.balance; });
    var lines = [
      '👑 GAMBAKING — DAS FANTASY CASINO',
      '💸 KEIN ECHTGELD · NUR EHRE',
      '🎰 10 SPIELE · 1 KRONE',
      '🔥 WER TRAUT SICH ALL IN?',
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
            el('div', { class: 'board-stats', text: p.plays + ' Spiele · ' + p.wins + ' Siege · Peak ' + GK.fmt(p.peak) })
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
    p.lastBonus = Date.now();
    GK.grant(p.id, 250, true);
    GK.logFeed(p.name + ' hat den Tagesbonus (+250) abgeholt', 'admin');
    GK.toast('Tagesbonus! +250 Chips 🎁', 'gold', '🎁');
    GK.sfx('cash');
    GK.confetti(90);
    GK.emojiRain(['🎁', '🪙'], 16);
    renderAll();
  }

  /* ─────────────── ADMIN ─────────────── */
  function adminEntry() {
    GK.sfx('click');
    if (GK.state.admin) { adminPanel(); return; }

    var pin = el('input', { class: 'input', type: 'password', placeholder: '••••', maxlength: '12' });
    var err = el('p', { class: 'hint', style: 'color:var(--red);display:none', text: 'Falsche PIN! Der Türsteher schaut böse.' });
    var ok = el('button', { class: 'btn btn-full', text: '🔓 EINLOGGEN' });

    function tryPin() {
      if (pin.value === GK.state.settings.adminPin) {
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
      GK.save();
      syncLuck();
      renderList();
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
      });
      GK.save();
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
      GK.save();
      GK.toast('Neue PIN gespeichert 🔑', 'gold', '🔑');
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
        el('div', { style: 'height:16px' }),
        el('div', { class: 'bet-label', text: 'GLÜCKS-REGLER (HEIMLICHER CHEAT)' }),
        el('div', { style: 'height:6px' }),
        el('div', { class: 'range-row' }, [luckSlider, el('div', { class: 'info-box', style: 'min-width:74px' }, [luckVal, el('span', { text: 'Luck' })])]),
        el('p', { class: 'hint', text: '0 = verflucht, 50 = neutral, 100 = gesegnet. Wirkt auf Slots, Roulette, Münze, Würfel, Crash, Rad, Plinko und Rubbellos.' }),
        el('div', { style: 'height:16px' }),
        el('div', { class: 'modal-actions' }, [allBtn, resetBtn]),
        el('div', { style: 'height:8px' }),
        el('div', { class: 'modal-actions' }, [pinBtn, exitBtn])
      ]
    });
  }

  /* ─────────────── BOOT ─────────────── */
  function boot() {
    GK.load();
    GK.initFX();
    renderGames();
    renderAll();

    // Header
    $('#brand-btn').addEventListener('click', function () { GK.sfx('click'); closeGame(); showView('view-lobby'); });
    $('#btn-back').addEventListener('click', function () { GK.sfx('click'); closeGame(); showView('view-lobby'); renderAll(); });
    $('#hud-player').addEventListener('click', playerSwitcher);
    $('#hud-balance').addEventListener('click', function () {
      GK.sfx('coin');
      var p = GK.player();
      if (p) GK.toast('Du hast ' + GK.fmt(p.balance) + ' Chips · ' + GK.fmtSigned(GK.profitOf(p)) + ' Profit', 'gold', '🪙');
    });
    $('#btn-sound').addEventListener('click', function () {
      var on = GK.toggleSound();
      $('#btn-sound').textContent = on ? '🔊' : '🔇';
      $('#btn-sound').classList.toggle('off', !on);
      GK.toast(on ? 'Sound an 🔊' : 'Sound aus 🔇', '', on ? '🔊' : '🔇');
    });
    $('#btn-admin').addEventListener('click', adminEntry);

    // Lobby-Aktionen
    $('#btn-play-random').addEventListener('click', function () {
      GK.sfx('click');
      openGame(GK.pick(GK.games).id);
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

    $('#btn-wipe').addEventListener('click', function () {
      if (!window.confirm('Wirklich ALLE Spieler, Chips und Statistiken löschen?')) return;
      GK.wipe();
      location.reload();
    });

    // Modal schließen
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', GK.closeModal); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') GK.closeModal();
    });

    // Sound-Button initial
    if (GK.state.settings.sound === false) {
      $('#btn-sound').textContent = '🔇';
      $('#btn-sound').classList.add('off');
    }

    // Audio erst nach erster Interaktion starten (Browser-Policy)
    var unlock = function () {
      GK.sound.init();
      GK.sound.resume();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    GK.on('player-changed', renderAll);
    GK.on('feed', renderFeed);

    // Feed-Zeiten frisch halten
    setInterval(renderFeed, 60000);

    // Der wichtigste Teil: Name abfragen
    if (!GK.player()) setTimeout(function () { askName(true); }, 450);
    else {
      GK.updateHUD();
      GK.toast('Willkommen zurück, ' + GK.player().name + '! 👑', 'gold', GK.player().avatar);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.GK);
