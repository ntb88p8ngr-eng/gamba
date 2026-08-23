/* ═══════════════════════════════════════════════════════════
   GAMBAKING — App: Lobby, Leaderboard, Spieler, Admin-Modus
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';
  var el = GK.el, $ = GK.$, $$ = GK.$$;

  var boardSort = 'balance';
  var currentCleanup = null;

  /* ─────────────── VIEWS ─────────────── */
  /* Die Kopfzeile im Spiel klebt unter der oberen Leiste — wie hoch die ist,
     hängt vom Gerät ab, deshalb wird sie gemessen statt geraten. */
  function kopfHoeheMessen() {
    var leiste = document.querySelector('.topbar');
    if (!leiste) return;
    document.documentElement.style.setProperty('--kopf-hoehe', Math.round(leiste.getBoundingClientRect().height) + 'px');
  }
  window.addEventListener('resize', kopfHoeheMessen);
  window.addEventListener('orientationchange', kopfHoeheMessen);

  function showView(id) {
    /* Wer die Mehrspieler-Seite verlaesst — egal auf welchem Weg: Zurueck-
       Knopf, Logo, ein anderes Spiel —, steht auch vom Tisch auf. Sonst
       bleiben seine Chips dort liegen, waehrend er die Seite gar nicht mehr
       sieht. Deshalb steht es hier an der einen Stelle, durch die jeder
       Wechsel laeuft, und nicht an jedem einzelnen Knopf. */
    if (id !== 'view-mp' && GK.mp && GK.mp.an) GK.mp.close();
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === id); });
    /* Am Körper vermerkt, welche Seite läuft: die Fußzeile steht außerhalb
       von <main> und lässt sich sonst nicht danach ausblenden. Am Handy war
       sie der einzige Grund, warum man im Spiel überhaupt scrollen konnte —
       und wer einmal gescrollt hatte, sah den LOBBY-Knopf nicht mehr. */
    document.body.classList.toggle('spielt', id === 'view-game');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openGame(id) {
    var g = GK.gameById(id);
    if (!g) return;
    /* Ausgeblendet heisst zu — auch fuer den, der die Kachel noch offen im
       Zufallsspiel oder in einem alten Fenster hat. */
    if (GK.gameAus(g.id)) {
      GK.toast(g.name + ' ist gerade geschlossen', 'bad', '🚧');
      GK.sfx('error');
      return;
    }
    /* In der Party gilt die Auswahl des Gastgebers — sonst spielt einer
       Roulette, waehrend die anderen an den Walzen sitzen. */
    if (GK.party && GK.party.an && !GK.party.erlaubt(g.id)) {
      GK.toast(g.name + ' ist in dieser Party nicht dabei', 'bad', '🎉');
      GK.sfx('error');
      return;
    }
    if (!spielbar(g)) {
      GK.toast(g.name + ' ist noch gesperrt — ab Level ' + g.minLevel, 'bad', '🔒');
      GK.sfx('error');
      return;
    }
    closeGame();
    /* Das Sound-Pack darf Klaenge pro Spiel ueberschreiben und braucht dafuer
       den Kontext. */
    GK.currentGame = g.id;
    $('#game-title').innerHTML = (g.icon ? GK.iconHTML(g.icon, 'title-ic') : '') + '<span>' + g.name + '</span>';
    var stageEl = $('#game-stage');
    stageEl.innerHTML = '';
    document.documentElement.style.setProperty('--game-color', g.color);
    /* Lag hier eine unterbrochene Runde, bekommt sie das Spiel mit und macht
       dort weiter, wo es aufgehoert hat. */
    currentCleanup = g.mount(stageEl, GK.loadGameState(g.id)) || null;
    /* Auf dem Handy klebt die Bedienung am unteren Rand. Spiele mit einer
       Zwischenaktion (Hit/Stand, Weiter/Aussteigen) brauchen dort eine Zeile
       mehr — das Einsatzfeld muss entsprechend höher sitzen. Welche das sind,
       weiß nur das gemountete Spiel, deshalb hier am DOM ablesen. */
    $('#view-game').classList.toggle('has-actions',
      !!stageEl.querySelector('.bj-actions, .btn-lime.btn-full'));
    $('#btn-rules').onclick = function () { showRules(g); };
    showView('view-game');
    GK.sfx('whoosh');
  }

  /* Mehrspieler braucht den Server und ein angemeldetes Konto — ohne beides
     gibt es niemanden, gegen den man spielen koennte. */
  function openMP() {
    if (!GK.net || !GK.net.online) {
      GK.toast('Multiplayer braucht den Casino-Server — offline geht nur allein', 'bad', '📡');
      GK.sfx('error');
      return;
    }
    if (!GK.player()) {
      GK.toast('Dafür brauchst du ein Konto', 'bad', '👤');
      GK.sfx('error');
      return;
    }
    closeGame();
    GK.mp.open($('#mp-stage'));
    showView('view-mp');
    GK.sfx('whoosh');
  }

  function closeGame(zwingend) {
    if (currentCleanup) { try { currentCleanup(); } catch (e) {} }
    currentCleanup = null;
    /* Die Aufraeumfunktion des Spiels hatte gerade Gelegenheit, ihren Stand
       zu sichern. Ist keiner da, war die Runde nicht fortsetzbar — dann
       kommt der Einsatz zurueck, statt im Nichts zu verschwinden.

       zwingend heisst: auch ein gesicherter Stand wird aufgeloest. Das
       braucht das Ende einer Party — dort gibt es kein Spaeter, und eine
       offen gebliebene Runde wuerde im normalen Casino aufs Konto
       verrechnet, obwohl ihr Einsatz aus der Party-Kasse kam. */
    refundOpenStake(zwingend);
    GK.currentGame = null;
    $('#game-stage').innerHTML = '';
  }

  /* Beim Verlassen und beim Start: liegengebliebene Runde aufloesen. Stand
     der Ausgang schon fest, wird zu Ende gespielt statt erstattet — sonst
     koennte man einen sich abzeichnenden Verlust durch Rausgehen umgehen. */
  function refundOpenStake(zwingend) {
    var r = GK.resolveOpenStake(null, zwingend);
    if (!r) return;
    if (r.settled) {
      var netto = r.chips - r.stake;
      GK.toast(netto >= 0
        ? 'Runde zu Ende gespielt — ' + GK.fmtSigned(netto) + ' Chips'
        : 'Runde zu Ende gespielt — ' + GK.fmt(r.stake) + ' Chips verloren',
        netto > 0 ? 'gold' : 'bad', netto > 0 ? '🎉' : '🎲');
    } else {
      GK.toast('Runde abgebrochen — ' + GK.fmt(r.chips) + ' Chips zurück', 'gold', '↩️');
    }
    renderAll();
  }

  function showRules(g) {
    GK.sfx('click');
    /* Die Regeln stehen als HTML in den Spielen; die englische Fassung liegt
       je Spiel in js/i18n-regeln.js. Fehlt sie oder passt die Anzahl nicht,
       bleibt es beim Original. */
    var regeln = g.rules || [];
    if (GK.lang && GK.lang() === 'en' && GK.regelnEn) {
      regeln = GK.regelnEn(g.id, regeln) || regeln;
    }
    var ul = el('ul', { class: 'rules-list' }, regeln.map(function (r) {
      return el('li', { html: r });
    }));
    GK.modal({
      icon: g.icon,
      title: g.name,
      text: g.blurb,
      nodes: [ul, el('p', { class: 'hint', html: '⚠️ Alle Chips sind <b>reine Fantasie</b> — kein echtes Geld, keine Auszahlung.' })]
    });
  }

  /**
   * Darf dieses Spiel gerade gespielt werden?
   *
   * Sonst entscheidet allein die Stufe. In einer Party kann der Gastgeber
   * die Sperre aufheben — er sucht die Spiele fuer alle aus und kann nicht
   * wissen, wer welches schon freigespielt hat.
   */
  function spielbar(g) {
    if (GK.party && GK.party.an && GK.party.alleFrei()) return true;
    return GK.isUnlocked(g);
  }

  /* ─────────────── LOBBY ─────────────── */
  /* Level, mit dem die Kacheln zuletzt gezeichnet wurden — damit die Schlösser
     auch dann verschwinden, wenn die XP vom Server kommen (Admin-Geschenk auf
     einem anderen Gerät) und nicht aus dem eigenen Spiel. */
  var drawnLevel = null;

  function renderGames() {
    var grid = $('#game-grid');
    grid.innerHTML = '';
    var me = GK.player();
    drawnLevel = me ? GK.levelOf(me.xp) : null;
    /* Waehrend einer Party stehen nur die Spiele da, die der Gastgeber
       ausgewaehlt hat — die uebrigen auszugrauen waere unnoetiger Krach. */
    var inParty = !!(GK.party && GK.party.an);
    /* Vom Admin ausgeblendete Spiele stehen nirgends — sie sollen fuer alle
       weg sein, nicht bloss gesperrt aussehen. */
    var liste = GK.games.filter(function (g) { return !GK.gameAus(g.id); });
    if (inParty) liste = liste.filter(function (g) { return GK.party.erlaubt(g.id); });
    liste.forEach(function (g, i) {
      var open = spielbar(g);
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
        if (!spielbar(g)) {
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
      /* Die Zahl kommt aus der Registry, nicht aus dem Text — sonst steht
         hier nach dem nächsten neuen Spiel wieder eine veraltete. */
      '🎰 ' + GK.games.length + ' SPIELE · 1 KRONE',
      '🔥 WER TRAUT SICH ALL IN?',
      '⭐ LEVEL STEIGEN · SPIELE FREISCHALTEN',
      '🃏 HAUS GEWINNT? NICHT HEUTE',
      '🚀 CASH OUT IST FÜR FEIGLINGE'
    ];
    /* In der Party fuehrt, wer den groessten Gewinn macht — der Kontostand
       aus dem Casino hat damit nichts zu tun und stuende hier nur im Weg. */
    var d = GK.party && GK.party.an && GK.party.daten;
    var vorn = d && (d.spieler || [])[0];
    if (vorn) {
      lines.splice(1, 0, '🎉 PARTY-SPITZE: ' + vorn.name.toUpperCase() + ' MIT ' + GK.fmtSigned(vorn.gewinn) + ' CHIPS');
    } else if (!d && players.length) {
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
      else if (boardSort === 'biggestWin') {
        val = '+' + GK.fmt(p.biggestWin);
        var wo = p.biggestWinGame && GK.gameById(p.biggestWinGame);
        sub = wo ? 'bester Win · ' + wo.name : 'bester Einzelwin';
      }
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

  /**
   * Die Aktionsliste unten in der Spielhalle.
   *
   * In einer Party zeigt sie nur, was in genau dieser Party passiert — das
   * Casino draussen läuft ja weiter, und dessen Zeilen haben mit dem Rennen
   * nichts zu tun. Ausserhalb stehen Partyzeilen mit "Party:" davor, damit
   * niemand einen Partygewinn für echte Chips hält.
   */
  function renderFeed() {
    var box = $('#feed');
    box.innerHTML = '';
    var meine = (GK.party && GK.party.an && GK.party.id) || null;
    var feed = GK.state.feed.filter(function (f) {
      return meine ? f.party === meine : true;
    });
    if (!feed.length) {
      box.appendChild(el('div', { class: 'feed-empty', text: meine
        ? 'Hier erscheint gleich, wer in der Party abräumt (oder alles verliert).'
        : 'Hier erscheint gleich, wer gerade abräumt (oder alles verliert).' }));
      return;
    }
    feed.slice(0, 25).forEach(function (f) {
      var fremd = !meine && f.party;
      box.appendChild(el('div', { class: 'feed-item ' + (f.type || '') + (f.party ? ' ist-party' : '') }, [
        el('span', { text: f.type === 'win' ? '🎉' : f.type === 'lose' ? '💀' : f.type === 'admin' ? '👑' : '🎲' }),
        el('span', {}, [
          fremd ? el('b', { class: 'feed-party', text: 'Party:' }) : null,
          el('span', { text: (fremd ? ' ' : '') + f.text })
        ]),
        el('span', { class: 'feed-when', text: timeAgo(f.t) })
      ]));
    });
  }

  function renderAll() {
    var me = GK.player();
    if ((me ? GK.levelOf(me.xp) : null) !== drawnLevel) renderGames();
    renderBoard();
    renderFeed();
    renderWipe();
    renderMarquee();
    renderLevel();
    GK.updateHUD();
  }

  /* ─────────────── SPIELER ─────────────── */
  /* ─────────────── ANMELDUNG ─────────────── */

  /** Login- und Registrierungsmaske. Ohne Server gibt es nur ein Profil. */
  function authModal(opts) {
    opts = opts || {};
    var online = GK.net.online;
    var mode = opts.mode || (online ? 'login' : 'register');

    var err = el('p', { class: 'auth-err', style: 'display:none' });
    function showErr(msg) {
      err.textContent = msg;
      err.style.display = '';
      GK.sfx('error');
      GK.shake($('#modal-root').querySelector('.modal'));
    }
    function clearErr() { err.style.display = 'none'; }

    /* ── Anmelden ── */
    var lName = el('input', { class: 'input', type: 'text', maxlength: '18', placeholder: 'Dein Spielername', autocomplete: 'username' });
    var lPass = el('input', { class: 'input', type: 'password', placeholder: 'Dein Passwort', autocomplete: 'current-password' });
    var lBtn = el('button', { class: 'btn btn-gold btn-full', text: '🔓 ANMELDEN' });
    var loginForm = el('div', {}, [
      el('div', { class: 'field' }, [el('label', { text: 'SPIELERNAME' }), lName]),
      el('div', { class: 'field' }, [el('label', { text: 'PASSWORT' }), lPass]),
      el('div', { class: 'modal-actions' }, [lBtn])
    ]);

    /* ── Neues Konto ── */
    var rName = el('input', { class: 'input', type: 'text', maxlength: '18', placeholder: 'z.B. DrachenDave', autocomplete: 'username' });
    var rPass = el('input', { class: 'input', type: 'password', placeholder: 'mindestens 4 Zeichen', autocomplete: 'new-password' });
    var rPass2 = el('input', { class: 'input', type: 'password', placeholder: 'Passwort wiederholen', autocomplete: 'new-password' });
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
    var rBtn = el('button', { class: 'btn btn-gold btn-full', text: '👑 KONTO ERSTELLEN' });
    var regForm = el('div', {}, [
      el('div', { class: 'field' }, [el('label', { text: 'SPIELERNAME' }), rName]),
      online ? el('div', { class: 'field' }, [el('label', { text: 'PASSWORT' }), rPass]) : null,
      online ? el('div', { class: 'field' }, [el('label', { text: 'PASSWORT WIEDERHOLEN' }), rPass2]) : null,
      el('div', { class: 'field' }, [el('label', { text: 'WÄHL DEINEN AVATAR' }), picker]),
      el('div', { class: 'modal-actions' }, [rBtn])
    ]);

    /* ── Umschalter ── */
    var tabLogin = el('button', { class: 'board-tab', text: '🔓 Anmelden' });
    var tabReg = el('button', { class: 'board-tab', text: '✨ Neues Konto' });
    var tabs = el('div', { class: 'board-tabs' }, [tabLogin, tabReg]);

    function setMode(m) {
      mode = m;
      clearErr();
      tabLogin.classList.toggle('active', m === 'login');
      tabReg.classList.toggle('active', m === 'register');
      loginForm.style.display = m === 'login' ? '' : 'none';
      regForm.style.display = m === 'register' ? '' : 'none';
      setTimeout(function () { (m === 'login' ? lName : rName).focus(); }, 60);
    }
    tabLogin.addEventListener('click', function () { setMode('login'); GK.sfx('chip'); });
    tabReg.addEventListener('click', function () { setMode('register'); GK.sfx('chip'); });

    function welcome(p, fresh) {
      GK.closeModal();
      GK.updateHUD();
      renderAll();
      if (fresh) {
        GK.logFeed(p.name + ' betritt das Casino mit ' + GK.fmt(GK.START_BALANCE) + ' Chips', 'admin');
        GK.toast('Willkommen, ' + p.name + '! ' + GK.fmt(GK.START_BALANCE) + ' Chips für dich 🎁', 'gold', p.avatar);
        GK.confetti(140);
        GK.emojiRain(['🎉', '👑', '🪙', '🎰'], 22);
      } else {
        GK.toast('Willkommen zurück, ' + p.name + '! 👑', 'gold', p.avatar);
      }
      GK.sfx('cash');
    }

    function doLogin() {
      var name = lName.value.trim();
      if (!name || !lPass.value) { showErr('Name und Passwort ausfüllen.'); return; }
      lBtn.disabled = true;
      GK.net.login(name, lPass.value).then(function (r) {
        lBtn.disabled = false;
        if (!r.ok) { showErr(r.error); lPass.value = ''; return; }
        welcome(GK.player(), false);
      });
    }

    function doRegister() {
      var name = rName.value.trim();
      if (name.length < 2) { showErr('Der Name braucht mindestens 2 Zeichen.'); return; }

      if (!online) {                       // ohne Server: nur lokales Profil
        var lp = GK.newPlayer(name, chosen);
        welcome(lp, true);
        return;
      }
      if (rPass.value.length < 4) { showErr('Das Passwort braucht mindestens 4 Zeichen.'); return; }
      if (rPass.value !== rPass2.value) { showErr('Die beiden Passwörter sind nicht gleich.'); return; }

      rBtn.disabled = true;
      GK.net.register(name, rPass.value, chosen).then(function (r) {
        rBtn.disabled = false;
        if (!r.ok) { showErr(r.error); return; }
        welcome(GK.player(), true);
      });
    }

    lName.addEventListener('keydown', function (e) { if (e.key === 'Enter') lPass.focus(); });
    lPass.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    lBtn.addEventListener('click', doLogin);
    rPass2.addEventListener('keydown', function (e) { if (e.key === 'Enter') doRegister(); });
    rName.addEventListener('keydown', function (e) { if (e.key === 'Enter') (online ? rPass : rPass2).focus(); });
    rBtn.addEventListener('click', doRegister);

    GK.modal({
      emoji: '👑',
      title: 'GambaKing',
      text: online
        ? 'Melde dich mit deinem Konto an. Jeder startet mit <b>' + GK.fmt(GK.START_BALANCE) + ' Chips</b> — ' +
          'es geht um <b>kein echtes Geld</b>, nur um Ehre und die Krone.'
        : 'Kein Server erreichbar — dein Spielstand bleibt nur in diesem Browser. ' +
          'Konten mit Passwort gibt es erst, wenn <b>server.js</b> läuft.',
      locked: !opts.closable,
      nodes: online ? [tabs, err, loginForm, regForm] : [err, regForm]
    });
    setMode(mode);
  }

  /** Kontomenü: Passwort ändern oder abmelden. */
  function accountMenu() {
    GK.sfx('click');
    var p = GK.player();
    if (!p) { authModal(); return; }
    var info = GK.levelInfo();

    var nodes = [
      el('div', { class: 'acc-head' }, [
        el('span', { class: 'acc-av', text: p.avatar }),
        el('div', {}, [
          el('div', { class: 'acc-name', text: p.name }),
          el('div', { class: 'acc-sub', text: 'Level ' + info.level + ' · ' + info.title.title + ' · ' + GK.fmt(p.balance) + ' Chips' })
        ])
      ]),
      el('div', { class: 'info-grid' }, [
        el('div', { class: 'info-box' }, [el('b', { text: GK.fmt(p.plays) }), el('span', { text: 'Spiele' })]),
        el('div', { class: 'info-box' }, [el('b', { text: GK.fmtSigned(GK.profitOf(p)) }), el('span', { text: 'Profit' })]),
        el('div', { class: 'info-box' }, [el('b', { text: '+' + GK.fmt(p.biggestWin) }),
          el('span', { text: (function () {
            var w = p.biggestWinGame && GK.gameById(p.biggestWinGame);
            return w ? 'Bester Win · ' + w.name : 'Bester Win';
          })() })])
      ]),
      el('div', { style: 'height:14px' })
    ];

    /* Am Handy sitzt der Sprachschalter hier statt im Kopf: dort war er
       am rechten Rand kaum zu treffen und wurde angeschnitten. Am Rechner
       bleibt er oben, deshalb blendet die CSS diese Zeile dort aus. */
    if (GK.langKnopf) {
      var langWas = el('div', { class: 'lang-zeile-was', text: GK.lang() === 'de' ? 'Deutsch' : 'English' });
      var langBtn = GK.langKnopf();
      /* Der Umschalter selbst hängt schon dran; unser Zuhörer kommt danach
         und sieht deshalb bereits die neue Sprache. */
      langBtn.addEventListener('click', function () {
        langWas.textContent = GK.lang() === 'de' ? 'Deutsch' : 'English';
      });
      nodes.push(
        el('div', { class: 'lang-zeile' }, [
          el('div', {}, [
            el('div', { class: 'bet-label', text: 'SPRACHE / LANGUAGE' }),
            langWas
          ]),
          langBtn
        ]),
        el('div', { style: 'height:14px' })
      );
    }

    /* Anstrich der Seite — gehört wie die Sprache zum Gerät. */
    if (GK.skins && GK.setSkin) {
      /* Bringt ein Skin mehrere Hintergründe mit, steht darunter eine zweite
         Reihe: die Bilder als Vorschau, dazu „Wechsel" für alle der Reihe
         nach. Sie wird bei jedem Skinwechsel neu gebaut, weil ein anderer
         Anstrich andere (oder gar keine) Bilder hat. */
      var bildReihe = el('div', { class: 'skin-bilder' });

      function bilderBauen() {
        bildReihe.innerHTML = '';
        var liste = GK.skinBilder ? GK.skinBilder() : [];
        if (liste.length < 2) { bildReihe.hidden = true; return; }
        bildReihe.hidden = false;
        var jetztBild = GK.skinBild();
        var mach = function (bildId, hintergrund, beschriftung) {
          var k = el('button', {
            class: 'skin-bild' + (bildId === jetztBild ? ' sel' : ''), type: 'button',
            title: beschriftung
          }, [el('span', { class: 'skin-bild-text', text: beschriftung })]);
          if (hintergrund) k.style.backgroundImage = 'url("' + hintergrund + '")';
          k.addEventListener('click', function () {
            GK.setSkinBild(bildId);
            GK.sfx('chip');
            bilderBauen();
          });
          bildReihe.appendChild(k);
        };
        liste.forEach(function (b, i) {
          /* Ein Film taugt nicht als Kachelbild — für ihn steht sein
             Standbild dort, und statt einer Nummer ein Filmzeichen. */
          mach(b.id,
               GK.skinBildVorschau ? GK.skinBildVorschau(GK.skin(), b.id)
                                   : GK.skinBildPfad(GK.skin(), b.id),
               b.film ? '🎬 Film' : String(i + 1));
        });
        mach('wechsel', '', '🔄 Wechsel');
      }

      var kacheln = GK.skins.map(function (sk) {
        var k = el('button', {
          class: 'skin-kachel' + (sk.id === GK.skin() ? ' sel' : ''), type: 'button'
        }, [
          el('span', { class: 'skin-probe skin-probe-' + sk.id }),
          el('span', { class: 'skin-text' }, [
            el('span', { class: 'skin-name', text: sk.emoji + ' ' + sk.name }),
            el('span', { class: 'skin-was', text: sk.was })
          ])
        ]);
        k.addEventListener('click', function () {
          GK.setSkin(sk.id);
          GK.sfx('chip');
          kacheln.forEach(function (o) { o.classList.toggle('sel', o === k); });
          bilderBauen();
          GK.toast(sk.emoji + ' ' + sk.name, 'gold', sk.emoji);
        });
        return k;
      });
      bilderBauen();
      nodes.push(
        el('div', { class: 'bet-label', text: 'ANSTRICH' }),
        el('div', { style: 'height:6px' }),
        el('div', { class: 'skin-wahl' }, kacheln),
        el('div', { style: 'height:8px' }),
        bildReihe,
        el('div', { style: 'height:14px' })
      );
    }

    if (GK.net.online) {
      var oldP = el('input', { class: 'input', type: 'password', placeholder: 'aktuelles Passwort' });
      var newP = el('input', { class: 'input', type: 'password', placeholder: 'neues Passwort (min. 4)' });
      var msg = el('p', { class: 'auth-err', style: 'display:none' });
      var pwBtn = el('button', { class: 'btn btn-ghost btn-full', text: '🔑 PASSWORT ÄNDERN' });
      pwBtn.addEventListener('click', function () {
        if (newP.value.length < 4) {
          msg.textContent = 'Das neue Passwort braucht mindestens 4 Zeichen.';
          msg.style.display = ''; GK.sfx('error'); return;
        }
        pwBtn.disabled = true;
        GK.net.changePassword(oldP.value, newP.value).then(function (r) {
          pwBtn.disabled = false;
          if (!r.ok) { msg.textContent = r.error; msg.style.display = ''; GK.sfx('error'); return; }
          GK.closeModal();
          GK.toast('Passwort geändert 🔑', 'gold', '🔑');
          GK.sfx('cash');
        });
      });
      nodes.push(
        el('div', { class: 'bet-label', text: 'PASSWORT ÄNDERN' }),
        el('div', { style: 'height:6px' }),
        oldP, el('div', { style: 'height:8px' }), newP,
        msg,
        el('div', { style: 'height:10px' }),
        pwBtn,
        el('div', { style: 'height:14px' })
      );
    }

    var outBtn = el('button', { class: 'btn btn-danger btn-full', text: '🚪 ABMELDEN' });
    outBtn.addEventListener('click', function () {
      GK.sfx('click');
      GK.net.logout().then(function () {
        GK.closeModal();
        GK.updateHUD();
        renderAll();
        setTimeout(function () { authModal(); }, 150);
      });
    });
    nodes.push(outBtn);

    GK.modal({ emoji: p.avatar, title: 'Dein Konto', text: '', nodes: nodes });
  }

  function dailyBonus() {
    var p = GK.player();
    if (!p) return;
    /* In der Party gibt es keinen Tagesbonus — der Knopf ist dort zwar
       ausgeblendet, aber die Tastatur kommt trotzdem an ihn heran. */
    if (GK.party && GK.party.an) {
      GK.toast('Den Tagesbonus gibt es nach der Party', 'bad', '🎉');
      GK.sfx('error');
      return;
    }
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

    /* Gezeigt wird, was zum laufenden Anstrich gehört: ein Stück aus dem
       Sound-Pack darf sich auf Skins beschränken. Die Position in der Liste
       taugt deshalb nicht als Kennung — setTrack bekommt den echten Index. */
    var trackRows = [];
    var list = el('div', { class: 'track-list' });

    function listeBauen() {
      trackRows = [];
      list.innerHTML = '';
      var sichtbar = M.sichtbar ? M.sichtbar() : M.tracks.map(function (t, i) {
        return { track: t, idx: i };
      });
      if (!sichtbar.length) {
        list.appendChild(el('p', { class: 'hint', text: 'Für diesen Anstrich ist kein Stück hinterlegt.' }));
        return;
      }
      sichtbar.forEach(function (x) {
        var t = x.track, i = x.idx;
        var fast = t.bpm >= 125;
        var row = el('button', {
          class: 'track-row' + (i === M.trackIdx && M.enabled ? ' playing' : '') + (fast ? ' fast' : '')
        }, [
          el('span', { class: 'tr-eq' }, [el('i'), el('i'), el('i')]),
          el('span', { class: 'tr-meta' }, [
            el('span', { class: 'tr-name', text: t.name + (t.datei ? ' 💿' : '') }),
            el('span', { class: 'tr-mood', text: t.mood })
          ]),
          el('span', { class: 'tr-bpm', text: t.bpm ? (fast ? '⚡ ' : '') + t.bpm : '💿' }),
          el('span', { class: 'tr-play', text: i === M.trackIdx && M.enabled ? '⏸' : '▶' })
        ]);
        row.dataset.idx = String(i);
        row.addEventListener('click', function () {
          if (i === M.trackIdx && M.enabled) { M.stop(); }
          else { M.setTrack(i); }
          sync();
          GK.sfx('chip');
        });
        trackRows.push(row);
        list.appendChild(row);
      });
    }
    listeBauen();
    /* Kommt das Sound-Pack nach oder wechselt der Anstrich, wird die Liste
       neu gebaut — das Fenster steht dann oft schon offen. */
    GK.on('musik-liste', function () {
      if (!list.isConnected) return;
      listeBauen();
      sync();
    });

    /* ── Radio ──
       Ein Sender spielt eine Reihe von Stücken hintereinander, statt eines
       im Loop. Der eingebaute Sender nimmt alles, was zum Anstrich passt;
       weitere kommen aus dem Sound-Pack. */
    var radioBox = el('div', { class: 'radio-wahl' });
    var radioAus = el('button', { class: 'btn btn-ghost btn-small', text: '⏹ RADIO AUS' });
    radioAus.addEventListener('click', function () {
      M.radioAus(); GK.sfx('click'); sync();
    });
    /* Der ganze Abschnitt hängt daran, ob es für den laufenden Anstrich
       überhaupt einen Sender gibt — ein leerer Kasten mit Überschrift wäre
       nur eine Frage ohne Antwort. */
    var radioTeile = [];

    function radioBauen() {
      radioBox.innerHTML = '';
      var sender = M.sender ? M.sender() : [];
      radioTeile.forEach(function (n) { n.hidden = !sender.length; });
      sender.forEach(function (sd) {
        var an = M.radio.an && M.radio.sender === sd.id;
        var k = el('button', { class: 'radio-kachel' + (an ? ' sel' : ''), type: 'button' }, [
          /* Ein Webradio bringt sein eigenes Zeichen mit; die Sender aus
             dem Pack behalten das Antennensymbol, solange sie laufen. */
          el('span', { class: 'radio-ic', text: an ? '📡' : (sd.icon || '📻') }),
          el('span', { class: 'radio-text' }, [
            el('span', { class: 'radio-name', text: sd.name }),
            el('span', { class: 'radio-was', text: sd.was || '' })
          ])
        ]);
        k.addEventListener('click', function () {
          if (M.radio.an && M.radio.sender === sd.id) { M.radioAus(); }
          else if (!M.radioAn(sd.id)) { GK.toast('Für diesen Sender gibt es kein Stück', 'bad', '📻'); }
          GK.sfx('chip');
          sync();
        });
        radioBox.appendChild(k);
      });
    }

    /* ── Läuft gerade ──
       Eine Zeile, die sagt, was man hört. Bei einem Sender vom Server
       steht daneben die Zeit — die ist für alle dieselbe, und genau das
       soll man sehen können. Der Balken läuft im Sekundentakt weiter,
       ohne dafür beim Server nachzufragen: die Startzeit steht fest,
       den Rest rechnet der Browser aus. */
    var jetztTitel = el('span', { class: 'rj-titel', text: '' });
    var jetztWas = el('span', { class: 'rj-was', text: '' });
    var jetztZeit = el('span', { class: 'rj-zeit', text: '' });
    var jetztFuell = el('i');
    var jetztBalken = el('div', { class: 'rj-balken' }, [jetztFuell]);
    var jetztBox = el('div', { class: 'radio-jetzt' }, [
      el('div', { class: 'rj-kopf' }, [
        el('span', { class: 'rj-ic', text: '▶' }),
        el('span', { class: 'rj-text' }, [jetztTitel, jetztWas]),
        jetztZeit
      ]),
      jetztBalken
    ]);
    var jetztUhr = null;

    function mmss(s) {
      s = Math.max(0, Math.floor(s || 0));
      return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }

    function jetztMalen() {
      var laeuft = M.radio.an && M.enabled;
      jetztBox.hidden = !laeuft;
      if (!laeuft) return;
      /* Bei einem Webradio weiß niemand, was gerade gespielt wird — der
         Strom sagt es nicht. Dann steht dort der Sender selbst. */
      if (M.strom && M.strom.an) {
        /* Gibt der Sender einen Titel heraus, steht der oben und der
           Sendername darunter — man will wissen, was läuft, nicht wo man
           eingeschaltet hat. Ohne Titel bleibt es beim Sender. */
        if (M.strom.titel) {
          jetztTitel.textContent = M.strom.titel;
          jetztWas.textContent = M.strom.name || 'Webradio';
        } else {
          jetztTitel.textContent = M.strom.name || '—';
          jetztWas.textContent = 'Webradio';
        }
        jetztZeit.textContent = 'live';
        jetztBalken.hidden = true;
        return;
      }
      var t = M.tracks[M.trackIdx] || {};
      jetztTitel.textContent = t.name || '—';
      jetztWas.textContent = t.mood || '';
      /* Nur eine Sendung vom Server hat eine feste Länge. Ein erzeugter
         Loop hört nie von allein auf — dort wäre jede Zeitangabe
         erfunden. */
      if (M.sync && M.sync.an && M.sync.dauer) {
        var ab = Math.min(M.sync.offset(), M.sync.dauer);
        jetztZeit.textContent = mmss(ab) + ' / ' + mmss(M.sync.dauer);
        jetztBalken.hidden = false;
        jetztFuell.style.width = (100 * ab / M.sync.dauer).toFixed(1) + '%';
      } else {
        jetztZeit.textContent = '';
        jetztBalken.hidden = true;
      }
    }

    function jetztUhrStellen() {
      if (jetztUhr) { clearInterval(jetztUhr); jetztUhr = null; }
      jetztUhr = setInterval(function () {
        /* Das Fenster kann zu sein — dann hat der Takt hier nichts mehr
           zu tun und räumt sich selbst weg. */
        if (!jetztBox.isConnected) { clearInterval(jetztUhr); jetztUhr = null; return; }
        jetztMalen();
      }, 1000);
    }

    var radioKopf = el('div', { class: 'bet-label', text: '📻 RADIO' });
    var radioLuft = el('div', { style: 'height:6px' });
    var radioLuft2 = el('div', { style: 'height:14px' });
    var radioHinweis = el('p', { class: 'hint', text: 'Ein Sender spielt seine Stücke hintereinander und schaltet von selbst weiter. Wer ein Stück oben anklickt, beendet die Sendung.' });
    radioTeile.push(radioKopf, radioLuft, radioBox, jetztBox, radioHinweis, radioLuft2);
    radioBauen();

    var musicVol = el('input', { type: 'range', min: '0', max: '100', step: '1', value: M.volume });
    var musicVolLabel = el('b', { text: M.volume });
    var sfxVol = el('input', { type: 'range', min: '0', max: '100', step: '1', value: GK.volume() });
    var sfxVolLabel = el('b', { text: GK.volume() });
    var offBtn = el('button', { class: 'btn btn-danger btn-full', text: '🔇 MUSIK AUS' });

    function sync() {
      /* Läuft ein Webradio, läuft kein Stück aus der Liste — auch wenn
         trackIdx noch auf dem letzten steht. Ohne diese Ausnahme stand
         dort ein Stück als „spielt gerade", das gar nicht zu hören war. */
      var stromLaeuft = !!(M.strom && M.strom.an);
      trackRows.forEach(function (r) {
        var on = !stromLaeuft && Number(r.dataset.idx) === M.trackIdx && M.enabled;
        r.classList.toggle('playing', on);
        r.querySelector('.tr-play').textContent = on ? '⏸' : '▶';
      });
      radioBauen();
      jetztMalen();
      radioAus.hidden = !M.radio.an || !(M.sender ? M.sender().length : 0);
      offBtn.textContent = M.enabled ? '🔇 MUSIK AUS' : '🎵 MUSIK AN';
      offBtn.className = 'btn btn-full ' + (M.enabled ? 'btn-danger' : 'btn-lime');
      musicVolLabel.textContent = M.volume;
      sfxVolLabel.textContent = GK.volume();
      /* Auch die Regler selbst nachziehen, nicht nur die Zahl daneben:
         ändert sich die Lautstärke woanders, stünde der Knopf sonst noch
         an der alten Stelle und der nächste Tastendruck spränge von dort. */
      if (musicVol.value !== String(M.volume)) musicVol.value = M.volume;
      if (sfxVol.value !== String(GK.volume())) sfxVol.value = GK.volume();
      if ($('#vol-slider')) $('#vol-slider').value = GK.volume();
    }

    musicVol.addEventListener('input', function () { M.setVolume(musicVol.value); sync(); });
    sfxVol.addEventListener('input', function () { GK.setVolume(sfxVol.value); sync(); });
    sfxVol.addEventListener('change', function () { GK.sfx('coin'); });
    offBtn.addEventListener('click', function () { M.toggle(); sync(); GK.sfx('click'); });

    GK.modal({
      emoji: '🎵',
      title: 'Musik & Sound',
      text: 'Fünf Techno-Loops, live im Browser erzeugt — zwei tiefe Dub-Stücke, ein krummer Minimal-Groove und zwei Acid-Nummern. Dazu alles, was im Sound-Pack als Datei liegt (💿) — ganze Sendungen laufen nur unten im Radio. Jederzeit abschaltbar.',
      nodes: [
        el('div', { class: 'bet-label', text: 'HINTERGRUND-TRACKS' }),
        el('div', { style: 'height:8px' }),
        list,
        el('div', { style: 'height:14px' }),
        radioKopf,
        radioLuft,
        radioBox,
        jetztBox,
        radioHinweis,
        radioAus,
        radioLuft2,
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
    jetztUhrStellen();
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

  /* Welcher Reiter im Admin-Panel zuletzt offen war. Steht ausserhalb der
     Funktion, damit er ein Schliessen überlebt: wer an den Quoten sitzt,
     will beim nächsten Öffnen nicht wieder bei den Spielern landen. */
  var adminReiter = 'spieler';

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
              el('div', { style: 'font-size:.68rem;color:var(--muted)', text: 'Luck ' + luckText(GK.luckWert(p.luck)) + ' · ' + p.plays + ' Spiele' })
            ])
          ]),
          el('span', { class: 'bal', text: GK.fmt(p.balance) }),
          el('button', { class: 'mini-btn', text: '🔑', title: 'Passwort zurücksetzen', onClick: function (e) {
            e.stopPropagation();
            var np = window.prompt('Neues Passwort für "' + p.name + '" (min. 4 Zeichen):', '');
            if (np === null) return;
            np = String(np).trim();
            if (np.length < 4) { GK.toast('Passwort braucht mindestens 4 Zeichen', 'bad', '⚠️'); return; }
            GK.commit('resetPassword', { id: p.id, password: np }).then(function () {
              GK.logFeed('👑 ADMIN: Passwort von ' + p.name + ' zurückgesetzt', 'admin');
              GK.toast(p.name + ': neues Passwort gesetzt 🔑', 'gold', '🔑');
              GK.sfx('cash');
            });
          } }),
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

    /* Genauso fein wie die Quoten: Regler in Zehnteln, daneben ein Feld zum
       Eintippen — 1000 Stufen trifft man mit der Maus sonst nicht. */
    var luckSlider = el('input', { type: 'range', min: '0', max: '100', step: '0.1', value: '50' });
    var luckFeld = el('input', { class: 'quote-feld', type: 'number', min: '0', max: '100', step: '0.1', value: '50' });
    var luckVal = el('b', { text: '⚖️' });
    function syncLuck(vomFeld) {
      var p = target();
      var v = p ? GK.luckWert(p.luck) : 50;
      luckSlider.value = String(v);
      if (!vomFeld) luckFeld.value = luckFeldText(v);
      luckVal.textContent = v > 50 ? '🍀' : (v < 50 ? '💀' : '⚖️');
    }
    function luckSetzen(v, vomFeld) {
      var p = target();
      if (!p) return;
      p.luck = GK.luckWert(v);
      syncLuck(vomFeld);
      renderList();
    }
    luckSlider.addEventListener('input', function () { luckSetzen(luckSlider.value); });
    // erst beim Loslassen zum Server, nicht bei jedem Pixel
    luckSlider.addEventListener('change', function () {
      var p = target();
      if (!p) return;
      GK.commit('luck', { id: p.id, luck: p.luck });
    });
    luckFeld.addEventListener('change', function () {
      var p = target();
      if (!p) return;
      if (String(luckFeld.value).trim() === '') { syncLuck(); return; }
      luckSetzen(luckFeld.value, true);
      luckFeld.value = luckFeldText(p.luck);
      GK.commit('luck', { id: p.id, luck: p.luck });
      GK.sfx('click');
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

    /* Einzelnen Spieler auf Anfang stellen. Konto, Name und Passwort bleiben —
       nur Chips, XP und Statistik gehen zurueck. Der Gluecks-Regler bleibt
       ebenfalls stehen, den dreht der Admin bewusst. */
    var resetOneBtn = el('button', { class: 'btn btn-ghost btn-small', text: '♻️ SPIELER ZURÜCKSETZEN', onClick: function () {
      var p = target();
      if (!p) { GK.toast('Erst einen Spieler auswählen!', 'bad', '👆'); return; }
      if (!window.confirm(p.name + ' auf 0 XP und ' + GK.START_BALANCE + ' Chips zurücksetzen?\n\n' +
                          'Konto und Passwort bleiben erhalten.')) return;

      p.balance = GK.START_BALANCE;
      p.granted = 0; p.wagered = 0; p.returned = 0;
      p.plays = 0; p.wins = 0; p.losses = 0;
      p.biggestWin = 0; p.peak = GK.START_BALANCE;
      p.xp = 0; p.claimedLevel = 1;
      p.lastBailout = 0;

      GK.commit('resetPlayer', { id: p.id });
      GK.logFeed('👑 ADMIN: ' + p.name + ' startet neu — 0 XP, ' + GK.fmt(GK.START_BALANCE) + ' Chips', 'admin');
      GK.toast(p.name + ' zurückgesetzt ♻️', 'gold', '♻️');
      GK.sfx('cash');
      renderList(); renderAll(); syncLuck();
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

    /* ── Offene Tische und Partys ──
       Der Admin sieht hier, was gerade laeuft, und kann aufraeumen: einen
       Tisch, an dem seit einer Stunde einer allein sitzt, oder eine Party,
       die nie gestartet wurde. Die Chips gehen dabei zurueck aufs Konto —
       darum kuemmert sich der Server. */
    var mpBox = el('div', { class: 'admin-players' });

    function renderMP() {
      mpBox.innerHTML = '';
      mpBox.appendChild(el('div', { class: 'feed-empty', text: 'Lade…' }));
      if (!GK.mp || !GK.mp.uebersicht) return;
      GK.mp.uebersicht().then(function (l) {
        mpBox.innerHTML = '';
        var alles = [];
        (l && l.tische || []).forEach(function (t) {
          alles.push({
            id: t.id, name: t.name, art: t.game,
            wer: (t.spieler || []).map(function (s) { return s.name; }),
            zustand: t.laeuft ? 'läuft' : 'wartet',
            zahl: t.besetzt + '/' + t.plaetze
          });
        });
        (l && l.partys || []).forEach(function (pa) {
          alles.push({
            id: pa.id, name: pa.name, art: 'Party',
            wer: (pa.spieler || []).map(function (s) { return s.name; }),
            zustand: pa.status === 'lobby' ? 'wartet' : pa.status,
            zahl: pa.besetzt + '/' + pa.max
          });
        });
        if (!alles.length) {
          mpBox.appendChild(el('div', { class: 'feed-empty', text: 'Gerade ist nichts offen.' }));
          return;
        }
        alles.forEach(function (e) {
          var weg = el('button', { class: 'mini-btn', text: '🗑', title: 'Auflösen' });
          weg.addEventListener('click', function (ev) {
            ev.stopPropagation();
            GK.mp.aufloesen(e.id).then(function () {
              GK.toast('"' + e.name + '" aufgelöst', 'gold', '🗑');
              GK.sfx('chip');
              renderMP();
              renderAll();
            }).catch(function (err) {
              GK.toast(err && err.message ? err.message : 'Ging nicht', 'bad', '⚠️');
              GK.sfx('error');
            });
          });
          mpBox.appendChild(el('div', { class: 'admin-row' }, [
            el('div', { class: 'who' }, [
              el('div', {}, [
                el('div', { class: 'nm', text: e.name }),
                el('div', { style: 'font-size:.68rem;color:var(--muted)',
                            text: e.art + ' · ' + e.zustand + ' · ' + e.zahl +
                                  (e.wer.length ? ' · ' + e.wer.join(', ') : '') })
              ])
            ]),
            weg
          ]));
        });
      }).catch(function () {
        mpBox.innerHTML = '';
        mpBox.appendChild(el('div', { class: 'feed-empty', text: 'Übersicht nicht erreichbar.' }));
      });
    }

    var mpNeu = el('button', { class: 'btn btn-small', text: '🔄 AKTUALISIEREN' });
    mpNeu.addEventListener('click', function () { GK.sfx('click'); renderMP(); });

    /* ── Quoten je Spiel ──
       Der Regler darueber verschiebt einen Spieler, dieser hier ein Spiel —
       fuer alle. Beide zaehlen als Abweichung von 50 und addieren sich. */
    /* Diese beiden fragen das Glueck nirgends ab: es sind ausgeteilte
       Kartenspiele, in denen ein heimlicher Schubs die Karten verbiegen
       muesste. Ein Regler waere dort eine Attrappe — deshalb stehen sie
       gar nicht erst in der Liste. */
    var OHNE_QUOTE = { blackjack: 1, baccarat: 1 };
    var quotenBox = el('div', { class: 'quoten-liste' });

    /* Zum Lesen mit Komma und ohne unnoetige Null: 62,5 statt 62.5, und 50
       bleibt 50 statt 50,0. Zahlenfelder bekommen das nicht — ein
       <input type=number> versteht nur den Punkt und leert sich beim Komma
       kommentarlos. Fuer die gibt es luckFeldText. */
    function luckText(v) {
      var t = (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
      return t.replace(/,0$/, '');
    }
    function luckFeldText(v) {
      return String(Math.round(v * 10) / 10);
    }

    function quoteZeile(g) {
      var wert = GK.gameLuck(g.id);
      /* Regler fuer grob, Zahlenfeld fuer genau: 1000 Stufen trifft man mit
         der Maus nicht, getippt steht der Wert sofort. */
      var regler = el('input', { type: 'range', min: '0', max: '100', step: '0.1', value: String(wert) });
      var feld = el('input', { class: 'quote-feld', type: 'number', min: '0', max: '100', step: '0.1',
                               value: String(wert) });
      var zeile = el('div', { class: 'quote-zeile' }, [
        el('span', { class: 'quote-ic', html: GK.iconHTML(g.icon) }),
        el('span', { class: 'quote-name', text: g.name }),
        regler, feld
      ]);
      zeile.title = g.name + ': 50 ist neutral, darüber gewinnt der Spieler öfter.';

      function zeigen(v) {
        zeile.classList.toggle('hoch', v > 50);
        zeile.classList.toggle('tief', v < 50);
      }
      zeigen(wert);

      function setzen(v, vomFeld) {
        v = GK.luckWert(v);
        regler.value = String(v);
        if (!vomFeld) feld.value = luckFeldText(v);
        zeigen(v);
        return v;
      }
      setzen(wert);

      regler.addEventListener('input', function () { setzen(regler.value); });
      regler.addEventListener('change', function () {
        GK.setGameLuck(g.id, setzen(regler.value));
        GK.sfx('click');
      });
      feld.addEventListener('change', function () {
        /* Leeres Feld heisst "nichts eingegeben", nicht "null" — sonst
           verstellte ein weggewischter Wert die Quote auf 0. */
        if (String(feld.value).trim() === '') { setzen(GK.gameLuck(g.id)); return; }
        var v = setzen(feld.value, true);
        feld.value = luckFeldText(v);
        GK.setGameLuck(g.id, v);
        GK.sfx('click');
      });
      return { node: zeile, setzen: setzen, id: g.id };
    }

    var quotenZeilen = [];
    function renderQuoten() {
      quotenBox.innerHTML = '';
      quotenZeilen = GK.games
        .filter(function (g) { return !OHNE_QUOTE[g.id]; })
        .map(quoteZeile);
      quotenZeilen.forEach(function (z) { quotenBox.appendChild(z.node); });
    }
    function syncQuoten() {
      quotenZeilen.forEach(function (z) { z.setzen(GK.gameLuck(z.id)); });
    }

    var quotenNeutral = el('button', { class: 'btn btn-ghost btn-small', text: '⚖️ ALLE NEUTRAL' });
    quotenNeutral.addEventListener('click', function () {
      GK.sfx('click');
      GK.resetGameLuck();
      syncQuoten();
      GK.toast('Alle Quoten stehen wieder neutral', 'gold', '⚖️');
    });

    /* ── Spiele: sichtbar? und in welchem Rahmen wird gesetzt? ──
       Beides gilt fuer alle Spieler. Ausgeblendete Spiele verschwinden aus
       der Halle, aus dem Zufallsspiel und lassen sich auch nicht mehr ueber
       einen alten Link oeffnen. Min/Max 0 heisst: es gilt, was das Spiel
       selbst vorgibt. */
    var regelBox = el('div', { class: 'regel-liste' });

    function regelZeile(g) {
      var r = GK.spielRegel(g.id);
      var an = el('input', { type: 'checkbox' });
      an.checked = !r.aus;
      var min = el('input', { class: 'regel-feld', type: 'number', min: '0', step: '1',
                              value: r.min ? String(r.min) : '', placeholder: 'min' });
      var max = el('input', { class: 'regel-feld', type: 'number', min: '0', step: '1',
                              value: r.max ? String(r.max) : '', placeholder: 'max' });
      var zeile = el('div', { class: 'regel-zeile' }, [
        el('label', { class: 'regel-an', title: 'Spiel in der Halle zeigen' }, [
          an, el('span', { class: 'regel-ic', html: GK.iconHTML(g.icon) }),
          el('span', { class: 'regel-name', text: g.name })
        ]),
        min, el('span', { class: 'regel-bis', text: '–' }), max
      ]);

      function zeigen() { zeile.classList.toggle('aus', !an.checked); }
      zeigen();

      function speichern() {
        zeigen();
        GK.setGameRule(g.id, {
          aus: !an.checked,
          min: parseInt(min.value, 10) || 0,
          max: parseInt(max.value, 10) || 0
        });
        renderGames();
      }
      an.addEventListener('change', function () { GK.sfx('click'); speichern(); });
      min.addEventListener('change', speichern);
      max.addEventListener('change', speichern);
      return { node: zeile, id: g.id, an: an, min: min, max: max };
    }

    var regelZeilen = [];
    function renderRegeln() {
      regelBox.innerHTML = '';
      regelZeilen = GK.games.map(regelZeile);
      regelZeilen.forEach(function (z) { regelBox.appendChild(z.node); });
    }
    function syncRegeln() {
      regelZeilen.forEach(function (z) {
        var r = GK.spielRegel(z.id);
        z.an.checked = !r.aus;
        z.min.value = r.min ? String(r.min) : '';
        z.max.value = r.max ? String(r.max) : '';
        z.node.classList.toggle('aus', !!r.aus);
      });
    }

    var regelnZurueck = el('button', { class: 'btn btn-ghost btn-small', text: '↩️ ALLE SPIELE OFFEN' });
    regelnZurueck.addEventListener('click', function () {
      GK.sfx('click');
      GK.resetGameRules();
      syncRegeln();
      renderGames();
      GK.toast('Alle Spiele sind offen, ohne Einsatzgrenzen', 'gold', '🎮');
    });

    /* ── Statistik ──
       Der Server rechnet die Zahlen aus (siehe /api/stats), hier werden sie
       nur gezeichnet. Umschaltbar sind Zeitraum, Reihe und Zuschnitt — alles
       drei sind einfache Knopfreihen, damit man mit einem Blick sieht, was
       gerade gezeigt wird. */
    var statSpanne = 12 * 3600000;      // 12 Stunden
    var statReihe = 'netto';
    var statSpieler = '';               // leer = alle
    var statSpiel = '';                 // leer = alle
    var statDaten = null;
    var statLaeuft = false;
    var statTyp = 'balken';   // 'balken' oder 'linie'
    /* Trefferflächen der zuletzt gezeichneten Kurve — daran hängt der
       Zeiger-Hinweis. Ein Eintrag je Eimer: Mitte, Breite, Wert, Zeit. */
    var statGeo = [];
    var statHover = -1;

    var statCanvas = el('canvas', { class: 'stat-canvas', width: '900', height: '260' });
    var statKopf = el('div', { class: 'stat-kopf' });
    var statTabelle = el('div', { class: 'stat-tabelle' });

    var SPANNEN = [['1 Std', 3600000], ['3 Std', 3 * 3600000], ['6 Std', 6 * 3600000],
                   ['12 Std', 12 * 3600000], ['24 Std', 86400000],
                   ['7 Tage', 7 * 86400000], ['30 Tage', 30 * 86400000], ['Gesamt', 0]];
    var REIHEN = [['Netto Spieler', 'netto'], ['Einsätze', 'einsatz'],
                  ['Auszahlungen', 'gewinn'], ['Runden', 'runden'], ['Logins', 'logins']];
    var TYPEN = [['📊 Balken', 'balken'], ['📈 Linie', 'linie']];

    function knopfReihe(paare, holen, setzen) {
      var box = el('div', { class: 'stat-knoepfe' });
      var knoepfe = paare.map(function (pa) {
        var b = el('button', { class: 'chip-btn', text: pa[0] });
        b.addEventListener('click', function () {
          setzen(pa[1]);
          GK.sfx('click');
          knoepfe.forEach(function (o) { o.b.classList.toggle('sel', o.wert === holen()); });
        });
        box.appendChild(b);
        return { b: b, wert: pa[1] };
      });
      knoepfe.forEach(function (o) { o.b.classList.toggle('sel', o.wert === holen()); });
      return box;
    }

    var spannenReihe = knopfReihe(SPANNEN, function () { return statSpanne; },
      function (v) { statSpanne = v; statHolen(); });
    var reihenReihe = knopfReihe(REIHEN, function () { return statReihe; },
      function (v) { statReihe = v; statZeichnen(); });
    var typReihe = knopfReihe(TYPEN, function () { return statTyp; },
      function (v) { statTyp = v; statZeichnen(); });

    var spielerWahl = el('select', { class: 'mp-feld' });
    var spielWahl = el('select', { class: 'mp-feld' });
    function wahlenFuellen() {
      spielerWahl.innerHTML = '';
      spielerWahl.appendChild(el('option', { value: '', text: 'Alle Spieler' }));
      GK.playerList().slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (p) {
          spielerWahl.appendChild(el('option', { value: p.id, text: p.name,
                                                 selected: p.id === statSpieler ? 'selected' : null }));
        });
      spielWahl.innerHTML = '';
      spielWahl.appendChild(el('option', { value: '', text: 'Alle Spiele' }));
      GK.games.forEach(function (g) {
        spielWahl.appendChild(el('option', { value: g.id, text: g.name,
                                             selected: g.id === statSpiel ? 'selected' : null }));
      });
    }
    spielerWahl.addEventListener('change', function () { statSpieler = spielerWahl.value; statHolen(); });
    spielWahl.addEventListener('change', function () { statSpiel = spielWahl.value; statHolen(); });

    function statHolen() {
      if (statLaeuft || !GK.net || !GK.net.stats) return;
      statLaeuft = true;
      statKopf.textContent = 'Lade…';
      GK.net.stats({ spanne: statSpanne, spieler: statSpieler, spiel: statSpiel })
        .then(function (d) {
          statLaeuft = false;
          statDaten = d;
          statZeichnen();
        }).catch(function (e) {
          statLaeuft = false;
          statKopf.textContent = 'Statistik nicht erreichbar' + (e && e.message ? ': ' + e.message : '');
        });
    }

    function statZeichnen() {
      var d = statDaten;
      if (!d) return;
      var g = d.gesamt;
      statKopf.innerHTML =
        '<span><b>' + GK.fmt(g.runden) + '</b> Runden</span>' +
        '<span><b>' + GK.fmt(g.einsatz) + '</b> gesetzt</span>' +
        '<span><b>' + GK.fmt(g.gewinn) + '</b> ausgezahlt</span>' +
        '<span class="' + (g.netto >= 0 ? 'plus' : 'minus') + '"><b>' + GK.fmtSigned(g.netto) +
          '</b> für die Spieler</span>' +
        '<span><b>' + (g.einsatz ? Math.round(g.quote * 1000) / 10 : 0) + ' %</b> Quote</span>' +
        '<span><b>' + GK.fmt(g.logins) + '</b> Logins</span>' +
        '<span><b>' + GK.fmt(g.aktive) + '</b> aktive von ' + GK.fmt(g.spieler) + '</span>';

      statTabelleZeichnen(d);
      kurveZeichnen();
    }

    /** Die Tabelle darunter: welche Spiele zahlen für die Spieler positiv? */
    function statTabelleZeichnen(d) {
      statTabelle.innerHTML = '';
      var reihen = (d.spiele || []).slice(0, 30);
      if (!reihen.length) {
        statTabelle.appendChild(el('div', { class: 'feed-empty', text: 'In diesem Zeitraum wurde nicht gespielt.' }));
        return;
      }
      statTabelle.appendChild(el('div', { class: 'stat-zeile kopf' }, [
        el('span', { class: 'nm', text: 'Spiel' }),
        el('span', { text: 'Runden' }),
        el('span', { text: 'Einsatz' }),
        el('span', { text: 'Quote' }),
        el('span', { text: 'Netto Spieler' })
      ]));
      reihen.forEach(function (r) {
        var sp = GK.gameById(r.id);
        statTabelle.appendChild(el('div', { class: 'stat-zeile' + (r.netto >= 0 ? ' plus' : '') }, [
          el('span', { class: 'nm', text: sp ? sp.name : (r.id || '—') }),
          el('span', { text: GK.fmt(r.runden) }),
          el('span', { text: GK.fmt(r.einsatz) }),
          el('span', { text: (Math.round(r.quote * 1000) / 10) + ' %' }),
          el('span', { class: r.netto >= 0 ? 'plus' : 'minus', text: GK.fmtSigned(r.netto) })
        ]));
      });
    }

    /** Zeitstempel für die Achse — bei langen Zeiträumen das Datum. */
    function statZeit(t, lang) {
      var dt = new Date(t);
      var uhr = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2);
      if (!lang) return uhr;
      return dt.getDate() + '.' + (dt.getMonth() + 1) + '. ' + uhr;
    }

    /**
     * Die Kurve zeichnen — als Balken oder als Linie mit Punkten.
     *
     * Nebenbei füllt sie statGeo: je Eimer eine Trefferfläche mit Mitte,
     * Wert und Zeit. Daran hängt der Hinweis unter dem Zeiger, ohne dass
     * dafür noch einmal gerechnet werden müsste.
     */
    function kurveZeichnen() {
      var d = statDaten;
      if (!d) return;
      var c = statCanvas, ctx = c.getContext('2d');
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var br = c.clientWidth || 900, ho = 260;
      c.width = Math.round(br * dpr); c.height = Math.round(ho * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, br, ho);

      var werte = d.punkte.map(function (p) {
        if (statReihe === 'netto') return p.gewinn - p.einsatz;
        return p[statReihe] || 0;
      });
      var max = Math.max(1, Math.max.apply(null, werte.map(Math.abs)));
      /* Auf eine runde Zahl aufrunden: eine Achse, die bei 3.847 endet,
         liest sich schlecht. */
      var stufe = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
      max = Math.ceil(max / (stufe / 2)) * (stufe / 2);

      var LINKS = 52;                       // Platz für die Wertachse
      var UNTEN = 22;                       // Platz für die Zeitachse
      var feldB = br - LINKS - 6, feldH = ho - UNTEN - 14;
      var minus = statReihe === 'netto';
      var null0 = 14 + (minus ? feldH / 2 : feldH);
      var hoch = minus ? feldH / 2 : feldH;
      var bx = feldB / werte.length;
      function yVon(w) { return null0 - (w / max) * hoch; }

      /* ── Wertachse: waagerechte Linien mit ihrer Zahl daneben ── */
      ctx.font = '11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      var stufenListe = minus ? [1, 0.5, 0, -0.5, -1] : [1, 0.75, 0.5, 0.25, 0];
      stufenListe.forEach(function (f) {
        var w = f * max, y = yVon(w);
        ctx.strokeStyle = f === 0 ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.09)';
        ctx.beginPath(); ctx.moveTo(LINKS, y); ctx.lineTo(br - 4, y); ctx.stroke();
        ctx.fillStyle = f === 0 ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.5)';
        ctx.textAlign = 'right';
        ctx.fillText(GK.fmt(Math.round(w)), LINKS - 6, y);
      });
      /* Die Achse selbst */
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.moveTo(LINKS, 8); ctx.lineTo(LINKS, ho - UNTEN + 2); ctx.stroke();

      /* ── Trefferflächen ── */
      statGeo = werte.map(function (w, i) {
        return { x: LINKS + i * bx, b: bx, mitte: LINKS + i * bx + bx / 2,
                 y: yVon(w), wert: w, t: d.punkte[i].t, punkt: d.punkte[i] };
      });

      /* ── Senkrechte Marke unter dem Zeiger ── */
      if (statHover >= 0 && statGeo[statHover]) {
        var gz = statGeo[statHover];
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.fillRect(gz.x, 8, bx, ho - UNTEN - 6);
        ctx.strokeStyle = 'rgba(255,209,46,.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(gz.mitte, 8); ctx.lineTo(gz.mitte, ho - UNTEN + 2); ctx.stroke();
        ctx.lineWidth = 1;
      }

      var farbe = function (w) {
        return statReihe === 'netto'
          ? (w >= 0 ? 'rgba(124,255,59,.85)' : 'rgba(255,59,107,.85)')
          : 'rgba(0,229,255,.8)';
      };

      if (statTyp === 'balken') {
        werte.forEach(function (w, i) {
          var y = yVon(w);
          var oben = Math.min(y, null0), h = Math.max(1, Math.abs(null0 - y));
          ctx.fillStyle = farbe(w);
          if (i === statHover) ctx.fillStyle = w >= 0 || statReihe !== 'netto' ? '#fff' : '#ffb3c4';
          ctx.fillRect(LINKS + i * bx + 1.5, oben, Math.max(1, bx - 3), h);
        });
      } else {
        /* Linie mit Punkten: die Fläche darunter ganz zart, damit die
           Richtung auch bei flachen Kurven ins Auge fällt. */
        ctx.beginPath();
        werte.forEach(function (w, i) {
          var x = LINKS + i * bx + bx / 2, y = yVon(w);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = statReihe === 'netto' ? 'rgba(255,209,46,.9)' : 'rgba(0,229,255,.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineTo(LINKS + (werte.length - 1) * bx + bx / 2, null0);
        ctx.lineTo(LINKS + bx / 2, null0);
        ctx.closePath();
        ctx.fillStyle = statReihe === 'netto' ? 'rgba(255,209,46,.10)' : 'rgba(0,229,255,.10)';
        ctx.fill();
        ctx.lineWidth = 1;
        werte.forEach(function (w, i) {
          var x = LINKS + i * bx + bx / 2, y = yVon(w);
          ctx.beginPath();
          ctx.arc(x, y, i === statHover ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = i === statHover ? '#fff' : farbe(w);
          ctx.fill();
        });
      }

      /* ── Zeitachse ── */
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.textBaseline = 'alphabetic';
      var lang = d.bis - d.von > 2 * 86400000;
      var f = function (t) {
        var dt = new Date(t);
        return lang ? dt.getDate() + '.' + (dt.getMonth() + 1) + '.' : statZeit(t);
      };
      ctx.textAlign = 'left'; ctx.fillText(f(d.von), LINKS, ho - 6);
      ctx.textAlign = 'center'; ctx.fillText(f((d.von + d.bis) / 2), LINKS + feldB / 2, ho - 6);
      ctx.textAlign = 'right'; ctx.fillText(f(d.bis), br - 4, ho - 6);
      ctx.textAlign = 'left';
    }

    /* ── Hinweis unter dem Zeiger ──
       Er hängt im Rahmen über dem Canvas und zeigt Zeitpunkt und Zahl des
       Eimers, auf dem der Zeiger gerade steht. Am Handy tut es ein Tipp:
       dieselbe Behandlung, nur mit pointerdown. */
    var statTip = el('div', { class: 'stat-tip', hidden: 'hidden' });
    var statRahmen = el('div', { class: 'stat-rahmen' }, [statCanvas, statTip]);

    function statTreffer(ev) {
      if (!statGeo.length) return -1;
      var r = statCanvas.getBoundingClientRect();
      var x = ev.clientX - r.left;
      /* Der nächstliegende Eimer, nicht der genau getroffene: bei vierzig
         schmalen Balken trifft man sonst ständig daneben. */
      var best = -1, dist = 1e9;
      for (var i = 0; i < statGeo.length; i++) {
        var dd = Math.abs(statGeo[i].mitte - x);
        if (dd < dist) { dist = dd; best = i; }
      }
      return dist <= Math.max(14, statGeo[0].b) ? best : -1;
    }

    function statTipZeigen(i, ev) {
      var g = statGeo[i];
      if (!g) { statTip.hidden = true; return; }
      var p = g.punkt;
      var lang = statDaten && (statDaten.bis - statDaten.von) > 2 * 86400000;
      var reihenName = (REIHEN.filter(function (x) { return x[1] === statReihe; })[0] || ['', ''])[0];
      statTip.innerHTML =
        '<b>' + GK.fmtSigned(Math.round(g.wert)) + '</b>' +
        '<span class="stat-tip-reihe">' + reihenName + '</span>' +
        '<span class="stat-tip-zeit">' + statZeit(g.t, lang) + ' – ' +
          statZeit(g.t + (statDaten ? statDaten.breite : 0), lang) + '</span>' +
        '<span class="stat-tip-mehr">' + GK.fmt(p.runden) + ' Runden · ' +
          GK.fmt(p.einsatz) + ' gesetzt · ' + GK.fmt(p.gewinn) + ' ausgezahlt' +
          (p.logins ? ' · ' + GK.fmt(p.logins) + ' Logins' : '') + '</span>';
      statTip.hidden = false;
      /* Am Rand kippt der Hinweis auf die andere Seite, sonst steht er
         halb außerhalb des Rahmens. */
      var breite = statTip.offsetWidth || 160;
      var platz = statCanvas.clientWidth;
      var links = Math.max(4, Math.min(platz - breite - 4, g.mitte - breite / 2));
      statTip.style.left = links + 'px';
      statTip.style.top = Math.max(4, Math.min(200, g.y - 12)) + 'px';
    }

    function statZeiger(ev) {
      var i = statTreffer(ev);
      if (i === statHover) { if (i >= 0) statTipZeigen(i, ev); return; }
      statHover = i;
      kurveZeichnen();
      if (i >= 0) statTipZeigen(i, ev); else statTip.hidden = true;
    }
    statCanvas.addEventListener('pointermove', statZeiger);
    statCanvas.addEventListener('pointerdown', statZeiger);
    statCanvas.addEventListener('pointerleave', function () {
      if (statHover < 0) return;
      statHover = -1; statTip.hidden = true; kurveZeichnen();
    });

    /* ── Protokoll der Partys ──
       Eine Party lebt nur, solange sie läuft; danach ist sie weg. Der
       Server hebt deshalb je Sitzung einen Abzug auf, und hier lässt sich
       eine davon auswählen und nachlesen. */
    var partyWahl = el('select', { class: 'mp-feld' });
    var partyBox = el('div', { class: 'party-log' });
    var partyListe = [];

    function partyLogHolen() {
      if (!GK.net || !GK.net.partys) return;
      partyBox.innerHTML = '';
      partyBox.appendChild(el('p', { class: 'hint', text: 'Lade…' }));
      GK.net.partys().then(function (d) {
        partyListe = (d && d.liste) || [];
        partyWahl.innerHTML = '';
        if (!partyListe.length) {
          partyWahl.appendChild(el('option', { value: '', text: 'Noch keine Party gespielt' }));
          partyBox.innerHTML = '';
          partyBox.appendChild(el('p', { class: 'hint', text: 'Sobald eine Party zu Ende gespielt ist, steht sie hier.' }));
          return;
        }
        partyListe.forEach(function (x) {
          var d1 = new Date(x.von);
          partyWahl.appendChild(el('option', { value: x.id, text:
            d1.getDate() + '.' + (d1.getMonth() + 1) + '. ' +
            ('0' + d1.getHours()).slice(-2) + ':' + ('0' + d1.getMinutes()).slice(-2) +
            ' · ' + x.name + ' · ' + x.leute + (x.eigeneChips ? ' · Buy-in' : '') }));
        });
        partyZeigen(partyListe[0].id);
      }).catch(function (e) {
        partyBox.innerHTML = '';
        partyBox.appendChild(el('p', { class: 'hint', text: 'Protokoll nicht erreichbar' +
          (e && e.message ? ': ' + e.message : '') }));
      });
    }

    function partyZeigen(id) {
      if (!id) return;
      GK.net.partys(id).then(function (d) {
        var pa = d && d.party;
        partyBox.innerHTML = '';
        if (!pa) { partyBox.appendChild(el('p', { class: 'hint', text: 'Nichts gefunden.' })); return; }
        var von = new Date(pa.von), bis = new Date(pa.bis);
        var uhr = function (t) { return ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2); };
        var lief = Math.max(1, Math.round((pa.bis - pa.von) / 60000));
        partyBox.appendChild(el('div', { class: 'party-log-kopf' }, [
          el('span', { class: 'chip-marke ' + (pa.eigeneChips ? 'marke-eigen' : 'marke-frei'),
                       text: pa.eigeneChips ? '💰 YOUR CHIPS' : '🎁 FREE CHIPS' }),
          el('span', { text: von.getDate() + '.' + (von.getMonth() + 1) + '. ' +
                             uhr(von) + '–' + uhr(bis) + ' (' + lief + ' min)' }),
          el('span', { text: GK.fmt(pa.startChips) + ' Startchips' }),
          el('span', { text: pa.nachschub ? 'Nachschub ' + GK.fmt(pa.nachschub) : 'kein Nachschub' }),
          el('span', { text: (pa.minBet || pa.maxBet)
            ? 'Einsatz ' + (pa.minBet || 1) + '–' + (pa.maxBet || '∞')
            : 'Einsatz frei' }),
          el('span', { text: (pa.spiele || []).length + ' Spiele' })
        ]));
        partyBox.appendChild(el('div', { class: 'stat-zeile kopf party-log-zeile' }, [
          el('span', { class: 'nm', text: 'Spieler' }),
          el('span', { text: 'Runden' }),
          el('span', { text: 'Bester Win' }),
          el('span', { text: 'Endstand' }),
          el('span', { text: pa.eigeneChips ? 'Aufs Konto' : 'Gewinn' })
        ]));
        (pa.spieler || []).forEach(function (s, i) {
          partyBox.appendChild(el('div', { class: 'stat-zeile party-log-zeile' + (s.gewinn >= 0 ? ' plus' : '') }, [
            el('span', { class: 'nm', text: (i + 1) + '. ' + (s.avatar || '👤') + ' ' + s.name +
                                            (s.nachschub ? ' 🎁' : '') }),
            el('span', { text: GK.fmt(s.runden) }),
            el('span', { text: '+' + GK.fmt(s.besterWin) }),
            el('span', { text: GK.fmt(s.chips) }),
            el('span', { class: s.gewinn >= 0 ? 'plus' : 'minus',
                         text: pa.eigeneChips ? GK.fmt(s.ausgezahlt) : GK.fmtSigned(s.gewinn) })
          ]));
        });
        if (pa.eigeneChips) {
          partyBox.appendChild(el('p', { class: 'hint', text:
            'Buy-in: jeder hat ' + GK.fmt(pa.startChips) + ' Chips eingezahlt. Der Sieger nimmt ' +
            'die Gewinne aller mit — „Aufs Konto" ist, was tatsächlich zurückging.' }));
        }
      }).catch(function () {
        partyBox.innerHTML = '';
        partyBox.appendChild(el('p', { class: 'hint', text: 'Nicht erreichbar.' }));
      });
    }
    partyWahl.addEventListener('change', function () { GK.sfx('click'); partyZeigen(partyWahl.value); });
    var partyNeu = el('button', { class: 'btn btn-small', text: '🔄 AKTUALISIEREN' });
    partyNeu.addEventListener('click', function () { GK.sfx('click'); partyLogHolen(); });

    var statNeu = el('button', { class: 'btn btn-small', text: '🔄 AKTUALISIEREN' });
    statNeu.addEventListener('click', function () { GK.sfx('click'); statHolen(); });

    /* ── Musik & Radio ──────────────────────────────────────────────
       Drei Dinge, die zusammengehören und deshalb in einem Kasten stehen:
       die einzelnen Stücke, die Sender aus eigenen Dateien und die
       Webradios. Alles, was hier bearbeitet wird, landet in
       assets/sfx/sounds.json — das Panel ist der Weg dorthin, statt die
       Datei von Hand zu pflegen. */

    var packDaten = { musik: [], sender: [] };
    var titelBox = el('div', { class: 'pack-liste' });
    var senderBox = el('div', { class: 'pack-liste' });

    function packHolen() {
      if (!GK.net || !GK.net.pack) return;
      GK.net.pack().then(function (d) {
        if (!d || !d.musik) return;
        packDaten = d;
        packMalen();
      }, function () {});
    }

    /** Ein Regler von 0 bis 150 Prozent, direkt an einem Stück. */
    function lautstaerkeRegler(t) {
      var wert = el('b', { text: Math.round((t.volume === undefined ? 1 : t.volume) * 100) + '%' });
      var reg = el('input', {
        type: 'range', min: '0', max: '150', step: '5',
        value: String(Math.round((t.volume === undefined ? 1 : t.volume) * 100))
      });
      reg.addEventListener('input', function () {
        wert.textContent = reg.value + '%';
      });
      /* Erst beim Loslassen speichern — sonst ginge bei jedem Pixel eine
         Schreiboperation auf die Datei. */
      reg.addEventListener('change', function () {
        GK.sfx('chip');
        GK.net.op('packTrack', { id: t.id, volume: Number(reg.value) / 100 })
          .then(function (out) { if (out && out.pack) { packDaten = out.pack; } });
      });
      reg.addEventListener('click', function (e) { e.stopPropagation(); });
      return el('div', { class: 'pack-laut' }, [reg, wert]);
    }

    function mmssKurz(s) {
      s = Math.max(0, Math.round(s || 0));
      return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }

    /**
     * Die kleine Zeile unter einem Namen.
     *
     * Jede Marke bekommt ihr eigenes Element. Aneinandergehängt als ein
     * Text fände die Übersetzung nichts wieder — „nur Radio · Old Vegas ·
     * 4:13" steht in keinem Wörterbuch, die drei Teile schon.
     */
    function markenZeile(teile) {
      var kinder = [];
      teile.forEach(function (m, i) {
        if (i) kinder.push(el('i', { class: 'pack-punkt', text: '·' }));
        kinder.push(el('span', { text: m }));
      });
      return el('span', { class: 'pack-marken' }, kinder);
    }

    /** Hoch und runter — für Sender wie für Stücke darin. */
    function schieber(art, id, sender) {
      var mach = function (richtung, zeichen) {
        var k = el('button', { class: 'btn btn-small btn-ghost pack-pfeil', text: zeichen });
        k.addEventListener('click', function (ev) {
          ev.stopPropagation();
          GK.sfx('click');
          GK.net.op('packMove', { art: art, id: id, sender: sender || '', richtung: richtung })
            .then(function (out) {
              if (out && out.pack) { packDaten = out.pack; packMalen(); }
              if (out && out.state && art === 'webradio') wrBauen();
            });
        });
        return k;
      };
      return el('div', { class: 'pack-schieber' }, [mach(-1, '▲'), mach(1, '▼')]);
    }

    /** Zu welchen Sendern gehört ein Stück? */
    function senderVon(id) {
      var raus = [];
      packDaten.sender.forEach(function (s) {
        if (!s.tracks || s.tracks.indexOf(id) >= 0) raus.push(s.name);
      });
      return raus;
    }

    function titelZeile(t) {
      var weg = el('button', { class: 'btn btn-small btn-danger', text: '🗑' });
      weg.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!window.confirm(GK.txt('Stück „' + t.name + '" aus der Liste nehmen? Die Datei bleibt liegen.',
                                   'Remove track "' + t.name + '" from the list? The file stays on disk.'))) return;
        GK.net.op('packTrack', { id: t.id, weg: true }).then(function (out) {
          if (out && out.pack) { packDaten = out.pack; packMalen(); }
        });
      });
      var wo = senderVon(t.id);
      var marken = [];
      if (t.nurRadio) marken.push('nur Radio');
      if (t.skins && t.skins.length) {
        t.skins.forEach(function (s) { marken.push(GK.skinInfo(s).name); });
      }
      wo.forEach(function (n) { marken.push(n); });
      if (t.dauer) marken.push(mmssKurz(t.dauer));

      return el('div', { class: 'pack-zeile' }, [
        el('span', { class: 'pack-ic', text: '💿' }),
        el('span', { class: 'pack-text' }, [
          el('b', { text: t.name }),
          markenZeile(marken.length ? marken : [t.file])
        ]),
        lautstaerkeRegler(t),
        weg
      ]);
    }

    function senderZeile(s) {
      var stuecke = s.tracks
        ? s.tracks.map(function (id) {
            for (var i = 0; i < packDaten.musik.length; i++) {
              if (packDaten.musik[i].id === id) return packDaten.musik[i];
            }
            return null;
          }).filter(Boolean)
        : packDaten.musik.slice();

      var innen = el('div', { class: 'pack-unter' }, stuecke.length
        ? stuecke.map(function (t, i) {
            var unten = [
              el('span', { class: 'pack-nr', text: String(i + 1) }),
              el('span', { class: 'pack-text' }, [
                el('b', { text: t.name }),
                markenZeile(t.dauer ? [t.mood || '', mmssKurz(t.dauer)].filter(Boolean)
                                    : [t.mood || ''])
              ])
            ];
            /* Verschieben nur, wenn der Sender eine eigene Reihenfolge
               führt. Nimmt er ohnehin alles, gibt es nichts zu ordnen. */
            if (s.tracks) unten.push(schieber('track', t.id, s.id));
            unten.push(lautstaerkeRegler(t));
            return el('div', { class: 'pack-unterzeile' }, unten);
          })
        : [el('p', { class: 'hint', text: 'Noch kein Stück in diesem Sender.' })]);
      innen.hidden = true;

      var auf = el('button', { class: 'btn btn-small btn-ghost', text: '▾ TITEL' });
      auf.addEventListener('click', function (ev) {
        ev.stopPropagation();
        innen.hidden = !innen.hidden;
        auf.textContent = innen.hidden ? '▾ TITEL' : '▴ TITEL';
        GK.sfx('click');
      });

      var wo = (s.skins && s.skins.length)
        ? s.skins.map(function (id) { return GK.skinInfo(id).name; }).join(', ')
        : 'überall';

      return el('div', { class: 'pack-block' }, [
        el('div', { class: 'pack-zeile' }, [
          el('span', { class: 'pack-ic', text: '📼' }),
          el('span', { class: 'pack-text' }, [
            el('b', { text: s.name }),
            markenZeile([stuecke.length + ' Titel', wo,
                         s.mischen ? 'gemischt' : 'feste Reihenfolge'])
          ]),
          schieber('sender', s.id),
          auf
        ]),
        innen
      ]);
    }

    /**
     * Ein eingebauter Loop.
     *
     * Er entsteht im Browser und liegt in keiner Datei — hinauswerfen
     * lässt er sich also nicht, ausblenden schon. Deshalb ein Schalter
     * statt eines Papierkorbs: was hier verschwindet, ist wiederholbar.
     */
    function loopZeile(l) {
      var reg = el('input', {
        type: 'range', min: '0', max: '150', step: '5', value: String(Math.round(l.volume * 100))
      });
      var wert = el('b', { text: Math.round(l.volume * 100) + '%' });
      reg.addEventListener('input', function () { wert.textContent = reg.value + '%'; });
      reg.addEventListener('change', function () {
        GK.sfx('chip');
        GK.net.op('loopRegel', { id: l.id, volume: Number(reg.value) / 100 });
      });

      var schalter = el('input', { type: 'checkbox' });
      schalter.checked = !l.aus;
      schalter.addEventListener('change', function () {
        GK.sfx('click');
        GK.net.op('loopRegel', { id: l.id, aus: !schalter.checked });
      });

      var marken = [l.mood];
      if (l.bpm) marken.push(l.bpm + ' BPM');
      if (l.aus) marken.push('ausgeblendet');

      return el('div', { class: 'pack-zeile' + (l.aus ? ' pack-aus' : '') }, [
        el('label', { class: 'pack-schalter', title: 'Sichtbar für alle' }, [schalter]),
        el('span', { class: 'pack-ic', text: '🎛' }),
        el('span', { class: 'pack-text' }, [
          el('b', { text: l.name }),
          markenZeile(marken)
        ]),
        el('div', { class: 'pack-laut' }, [reg, wert])
      ]);
    }

    var loopBox = el('div', { class: 'pack-liste' });
    function loopsMalen() {
      loopBox.innerHTML = '';
      var loops = (GK.music && GK.music.loops) ? GK.music.loops() : [];
      loops.forEach(function (l) { loopBox.appendChild(loopZeile(l)); });
    }
    /* Der Serverstand kommt nach — dann steht hier, was wirklich gilt. */
    GK.on('musik-liste', function () { if (loopBox.isConnected) loopsMalen(); });
    loopsMalen();

    function packMalen() {
      titelBox.innerHTML = '';
      if (!packDaten.musik.length) {
        titelBox.appendChild(el('p', { class: 'hint', text: 'Noch keine eigenen Stücke aus Dateien.' }));
      } else {
        packDaten.musik.forEach(function (t) { titelBox.appendChild(titelZeile(t)); });
      }
      senderBox.innerHTML = '';
      if (!packDaten.sender.length) {
        senderBox.appendChild(el('p', { class: 'hint', text: 'Noch kein Offline-Sender angelegt.' }));
      } else {
        packDaten.sender.forEach(function (s) { senderBox.appendChild(senderZeile(s)); });
      }
      zielFuellen();
    }

    /* ── Hochladen ── */
    var upDatei = el('input', { type: 'file', accept: 'audio/*', class: 'mp-feld' });
    var upName = el('input', { class: 'mp-feld', type: 'text', maxlength: '60', placeholder: 'Wie soll es heißen?' });
    var upZiel = el('select', { class: 'mp-feld' });
    var upNurRadio = el('input', { type: 'checkbox' });
    var upKnopf = el('button', { class: 'btn btn-small btn-lime', text: '⬆ HOCHLADEN' });
    var upStand = el('div', { class: 'pack-fortschritt' }, [el('i')]);
    upStand.hidden = true;

    function zielFuellen() {
      var vorher = upZiel.value;
      upZiel.innerHTML = '';
      upZiel.appendChild(el('option', { value: '', text: '— nur Hintergrundmusik —' }));
      packDaten.sender.forEach(function (s) {
        upZiel.appendChild(el('option', { value: s.id, text: s.name }));
      });
      if (vorher) upZiel.value = vorher;
    }

    upDatei.addEventListener('change', function () {
      var f = upDatei.files && upDatei.files[0];
      /* Den Dateinamen als Vorschlag nehmen, ohne Endung — meistens steht
         der Titel ohnehin darin. */
      if (f && !upName.value) upName.value = f.name.replace(/\.[a-z0-9]+$/i, '');
    });

    upKnopf.addEventListener('click', function () {
      var f = upDatei.files && upDatei.files[0];
      if (!f) { GK.toast('Erst eine Datei auswählen', 'bad', '⬆'); return; }
      if (!upName.value.trim()) { GK.toast('Der Titel braucht einen Namen', 'bad', '⬆'); return; }
      GK.sfx('click');
      upKnopf.disabled = true;
      upStand.hidden = false;
      upStand.firstChild.style.width = '0%';
      GK.net.upload(f, {
        name: upName.value.trim(),
        datei: f.name,
        sender: upZiel.value,
        nurRadio: upNurRadio.checked ? '1' : '0'
      }, function (anteil) {
        upStand.firstChild.style.width = (anteil * 100).toFixed(1) + '%';
      }).then(function (out) {
        upKnopf.disabled = false;
        upStand.hidden = true;
        if (out && out.pack) { packDaten = out.pack; packMalen(); }
        GK.toast('Hochgeladen: ' + upName.value.trim()
          + (out && out.dauer ? ' (' + mmssKurz(out.dauer) + ')' : ''), 'gold', '🎵');
        upDatei.value = '';
        upName.value = '';
      }, function (e) {
        upKnopf.disabled = false;
        upStand.hidden = true;
        GK.toast(e.message, 'bad', '⬆');
      });
    });

    /* ── Webradios ──
       Ein fremder Strom, der ohnehin schon läuft: keine Stückliste, keine
       Längen, nichts zu takten. Angelegt wird er hier und liegt danach
       beim Server, damit ihn alle sehen.

       Dasselbe Formular legt an und ändert: wer einen Eintrag anklickt,
       holt ihn zum Bearbeiten herunter. */
    var wrListe = el('div', { class: 'webradio-liste' });
    var wrName = el('input', { class: 'mp-feld', type: 'text', maxlength: '40', placeholder: 'z. B. Radio Paradise' });
    var wrIcon = el('input', { class: 'mp-feld', type: 'text', maxlength: '4', placeholder: '📻' });
    var wrUrl = el('input', { class: 'mp-feld', type: 'url', maxlength: '500', placeholder: 'https://…' });
    var wrWas = el('input', { class: 'mp-feld', type: 'text', maxlength: '90', placeholder: 'Kurze Zeile darunter (optional)' });
    /* Eine Handvoll Zeichen zum Anklicken. Kein vollständiger Satz —
       das kann die Tastatur des Geräts besser. Hier stehen die, die man
       für einen Sender tatsächlich nimmt: Radios, Musik, ein paar
       Stilrichtungen, ein paar Stimmungen. Tippen geht weiterhin. */
    var EMOJIS = ('📻 📡 🎙 🎚 🎛 🔊 🎵 🎶 🎧 💿 📀 🎼 🪩 ✨ 🔥 ❄️ 🌙 ☀️ ' +
                  '🎸 🎺 🎷 🥁 🎻 🪕 🎹 🪗 🎤 🕺 💃 🍸 🍹 🥃 🎲 🃏 👑 💎 ' +
                  '🚀 🛸 🌌 🪐 🌴 🏝 🌊 🇯🇲 🤠 🐉 👻 🎃 🧊 ⚡ 💀 🖤 ❤️ 💜').split(' ');

    var wrEmojiBox = el('div', { class: 'emoji-wahl' });
    function emojiBauen() {
      wrEmojiBox.innerHTML = '';
      EMOJIS.forEach(function (e) {
        var k = el('button', {
          class: 'emoji-knopf' + (wrIcon.value === e ? ' sel' : ''),
          type: 'button', title: e, text: e
        });
        k.addEventListener('click', function () {
          wrIcon.value = e;
          GK.sfx('chip');
          emojiBauen();
        });
        wrEmojiBox.appendChild(k);
      });
    }
    /* Wer selbst tippt, soll die Markierung mitwandern sehen. */
    wrIcon.addEventListener('input', emojiBauen);
    emojiBauen();

    var wrSkinBox = el('div', { class: 'webradio-skins' });
    var wrSpeichern = el('button', { class: 'btn btn-small btn-lime', text: '＋ ANLEGEN' });
    var wrNeu = el('button', { class: 'btn btn-small btn-ghost', text: '✕ FORMULAR LEEREN' });
    var wrId = '';                 // leer = ein neuer Eintrag

    var wrSkinFelder = GK.skins.map(function (sk) {
      var box = el('input', { type: 'checkbox' });
      box.dataset.skin = sk.id;
      wrSkinBox.appendChild(el('label', { class: 'party-schalter webradio-skin' }, [
        box, el('span', {}, [el('b', { text: sk.emoji + ' ' + sk.name })])
      ]));
      return box;
    });

    function wrFormular(eintrag) {
      wrId = (eintrag && eintrag.id) || '';
      wrName.value = (eintrag && eintrag.name) || '';
      wrIcon.value = (eintrag && eintrag.icon) || '';
      wrUrl.value = (eintrag && eintrag.url) || '';
      wrWas.value = (eintrag && eintrag.was) || '';
      var gewaehlt = (eintrag && eintrag.skins) || [];
      wrSkinFelder.forEach(function (b) { b.checked = gewaehlt.indexOf(b.dataset.skin) >= 0; });
      wrSpeichern.textContent = wrId ? '✓ ÄNDERN' : '＋ ANLEGEN';
      emojiBauen();                       // Markierung auf das Zeichen des Eintrags
    }

    function wrBauen() {
      wrListe.innerHTML = '';
      var alle = (GK.state.webRadios || []);
      if (!alle.length) {
        wrListe.appendChild(el('p', { class: 'hint', text: 'Noch kein Webradio angelegt.' }));
        return;
      }
      alle.forEach(function (r) {
        var wo = (r.skins && r.skins.length)
          ? r.skins.map(function (id) { return GK.skinInfo(id).name; }).join(', ')
          : 'überall';
        var weg = el('button', { class: 'btn btn-small btn-danger', text: '🗑' });
        weg.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (!window.confirm(GK.txt('Webradio „' + r.name + '" entfernen?',
                                     'Remove web radio "' + r.name + '"?'))) return;
          GK.net.op('webRadioDel', { id: r.id }).then(function () {
            if (wrId === r.id) wrFormular(null);
            wrBauen();
          });
        });
        var zeile = el('div', { class: 'webradio-zeile' }, [
          el('span', { class: 'webradio-ic', text: r.icon || '📻' }),
          el('span', { class: 'webradio-text' }, [
            el('b', { text: r.name }),
            el('span', { text: wo })
          ]),
          schieber('webradio', r.id),
          weg
        ]);
        /* Anklicken holt den Eintrag ins Formular — Ändern ist häufiger
           als Löschen, also liegt es auf der ganzen Zeile. */
        zeile.addEventListener('click', function () { wrFormular(r); GK.sfx('chip'); });
        wrListe.appendChild(zeile);
      });
    }

    wrNeu.addEventListener('click', function () { GK.sfx('click'); wrFormular(null); });
    wrSpeichern.addEventListener('click', function () {
      GK.sfx('click');
      var skins = wrSkinFelder.filter(function (b) { return b.checked; })
                              .map(function (b) { return b.dataset.skin; });
      GK.net.op('webRadioSet', {
        id: wrId, name: wrName.value, icon: wrIcon.value,
        url: wrUrl.value, was: wrWas.value, skins: skins
      }).then(function (out) {
        if (!out || out.error) return;             // die Meldung kommt vom Netzteil
        wrFormular(null);
        wrBauen();
        GK.toast('Webradio gespeichert', 'gold', '📻');
      });
    });
    GK.on('musik-liste', function () { if (wrListe.isConnected) wrBauen(); });
    wrFormular(null);
    wrBauen();

    /* ── Radio ──
       Der Sender läuft auf dem Server, also lässt er sich auch von dort
       aus bedienen: einmal weiter, oder gleich ein bestimmtes Stück. Was
       hier gedrückt wird, hören alle — deshalb steht daneben, was gerade
       läuft, und nicht nur die Knöpfe. */
    var radioStand = el('div', { class: 'radio-admin-stand', text: 'Wird geladen …' });
    var radioSenderWahl = el('select', { class: 'mp-feld' });
    var radioStueckWahl = el('select', { class: 'mp-feld' });
    var radioSkip = el('button', { class: 'btn btn-small', text: '⏭ WEITER' });
    var radioAuflegen = el('button', { class: 'btn btn-small btn-lime', text: '▶ AUFLEGEN' });
    var radioNeu = el('button', { class: 'btn btn-small', text: '🔄 AKTUALISIEREN' });
    var radioSender = [];       // Kennungen der Sender, die auf dem Server laufen
    var radioUhr = null;

    /** Stücke eines Senders, wie sie im Sound-Pack stehen. */
    function radioStuecke(senderId) {
      if (!GK.sfxPack || !GK.sfxPack.radio) return [];
      var alle = GK.sfxPack.musik ? GK.sfxPack.musik() : [];
      var st = null;
      GK.sfxPack.radio().forEach(function (r) { if (r.id === senderId) st = r; });
      if (!st) return [];
      if (!st.tracks) return alle;
      var raus = [];
      st.tracks.forEach(function (id) {
        alle.forEach(function (t) { if (t.id === id) raus.push(t); });
      });
      return raus;
    }

    function radioStueckeFuellen() {
      var vorher = radioStueckWahl.value;
      radioStueckWahl.innerHTML = '';
      radioStuecke(radioSenderWahl.value).forEach(function (t) {
        radioStueckWahl.appendChild(el('option', { value: t.id, text: t.name }));
      });
      if (vorher) radioStueckWahl.value = vorher;
    }

    function radioStandHolen() {
      if (!GK.net || !GK.net.radio) return;
      var id = radioSenderWahl.value;
      if (!id) return;
      GK.net.radio(id).then(function (d) {
        if (!d || !d.track) { radioStand.textContent = 'Sender läuft nicht'; return; }
        var name = d.track, mood = '';
        (GK.sfxPack && GK.sfxPack.musik ? GK.sfxPack.musik() : []).forEach(function (t) {
          if (t.id === d.track) { name = t.name; mood = t.mood || ''; }
        });
        var ab = Math.max(0, Math.round((d.jetzt - d.start) / 1000));
        /* Jedes Stück Text für sich: der Untertitel kommt aus dem
           Sound-Pack und bleibt, wie er dort steht, die Zeit ist nur
           Zahlen — zu übersetzen ist allein die Zählung am Ende. */
        radioStand.innerHTML = '';
        radioStand.appendChild(el('b', { text: '▶ ' + name }));
        if (mood) radioStand.appendChild(el('span', { text: ' · ' + mood }));
        radioStand.appendChild(el('span', { text: ' · ' + ab + ' / ' + d.dauer + ' s · ' }));
        radioStand.appendChild(el('span', { text: 'Stück ' + (d.pos + 1) + ' von ' + d.laenge }));
      }, function () { radioStand.textContent = 'Kein Server'; });
    }

    function radioSenderHolen() {
      if (!GK.net || !GK.net.radio) { radioStand.textContent = 'Kein Server'; return; }
      GK.net.radio().then(function (d) {
        radioSender = (d && d.sender) || [];
        radioSenderWahl.innerHTML = '';
        radioSender.forEach(function (id) {
          var name = id;
          (GK.sfxPack && GK.sfxPack.radio ? GK.sfxPack.radio() : []).forEach(function (r) {
            if (r.id === id) name = r.name;
          });
          radioSenderWahl.appendChild(el('option', { value: id, text: name }));
        });
        if (!radioSender.length) { radioStand.textContent = 'Kein Sender läuft auf dem Server'; return; }
        radioStueckeFuellen();
        radioStandHolen();
      }, function () { radioStand.textContent = 'Kein Server'; });
    }

    radioSenderWahl.addEventListener('change', function () { radioStueckeFuellen(); radioStandHolen(); });
    radioNeu.addEventListener('click', function () { GK.sfx('click'); radioStandHolen(); });
    radioSkip.addEventListener('click', function () {
      GK.sfx('click');
      GK.net.op('radioSkip', { sender: radioSenderWahl.value }).then(function () {
        radioStandHolen();
        /* Wer selbst zuhört, soll den Sprung sofort hören und nicht erst
           beim nächsten Nachfragen. */
        if (GK.music && GK.music.syncHolen) GK.music.syncHolen(true);
      });
    });
    radioAuflegen.addEventListener('click', function () {
      GK.sfx('click');
      GK.net.op('radioPick', { sender: radioSenderWahl.value, track: radioStueckWahl.value })
        .then(function () {
          radioStandHolen();
          if (GK.music && GK.music.syncHolen) GK.music.syncHolen(true);
        });
    });

    /* ── Ausfuhr und Zurücksetzen ──
       Ausgeführt wird, was der Server an Rohdaten hat: jede Runde, jede
       Anmeldung, das Party-Protokoll und eine Namensliste. Als JSON zum
       Weiterverarbeiten, als CSV zum Aufmachen in einer Tabelle. Die Datei
       baut der Browser selbst aus der Antwort — so hängt kein Download an
       einer offenen Kennung in der Adresse. */
    function datenSpeichern(name, text, typ) {
      var blob = new Blob([text], { type: typ + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = el('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }

    function stempel() {
      var d = new Date(), z = function (n) { return ('0' + n).slice(-2); };
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) +
             '_' + z(d.getHours()) + z(d.getMinutes());
    }

    /** Ein CSV-Feld: Anführungszeichen verdoppeln, alles einpacken. */
    function csvFeld(v) {
      var t = String(v === undefined || v === null ? '' : v);
      return '"' + t.replace(/"/g, '""') + '"';
    }

    function exportieren(alsCsv) {
      if (!GK.net || !GK.net.statExport) return;
      GK.sfx('click');
      GK.net.statExport().then(function (d) {
        if (!d) { GK.toast('Ausfuhr nicht möglich', 'bad', '📡'); return; }
        var namen = d.namen || {};
        if (!alsCsv) {
          datenSpeichern('gambaking-statistik_' + stempel() + '.json',
            JSON.stringify(d, null, 2), 'application/json');
          GK.toast('Statistik als JSON gespeichert 📥', 'gold', '📥');
          return;
        }
        /* Eine Zeile je Runde — das ist die Tabelle, mit der man rechnet. */
        var zeilen = ['Zeit;Spieler;Spiel;Einsatz;Auszahlung;Netto'];
        (d.runden || []).forEach(function (r) {
          var sp = GK.gameById(r.g);
          zeilen.push([
            csvFeld(new Date(r.t).toISOString()),
            csvFeld(namen[r.p] || r.p),
            csvFeld(sp ? sp.name : r.g),
            csvFeld(r.e), csvFeld(r.w), csvFeld(r.w - r.e)
          ].join(';'));
        });
        /* BOM voran, sonst zeigt Excel Umlaute falsch an. */
        datenSpeichern('gambaking-runden_' + stempel() + '.csv',
          '\ufeff' + zeilen.join('\r\n'), 'text/csv');
        GK.toast(GK.fmt((d.runden || []).length) + ' Runden als CSV gespeichert 📄', 'gold', '📄');
      }).catch(function (e) {
        GK.toast('Ausfuhr fehlgeschlagen' + (e && e.message ? ': ' + e.message : ''), 'bad', '📡');
      });
    }

    var statJson = el('button', { class: 'btn btn-small', text: '📥 JSON' });
    var statCsv = el('button', { class: 'btn btn-small', text: '📄 CSV' });
    statJson.addEventListener('click', function () { exportieren(false); });
    statCsv.addEventListener('click', function () { exportieren(true); });

    /* Gefragt wird wie bei den anderen gefährlichen Knöpfen mit confirm:
       ein eigenes Fenster würde das Admin-Panel schließen, und danach stünde
       man ohne Statistik da, die man gerade prüfen wollte. */
    var statLeeren = el('button', { class: 'btn btn-danger btn-small', text: '🗑 STATISTIK LEEREN' });
    statLeeren.addEventListener('click', function () {
      GK.sfx('click');
      if (!window.confirm(GK.txt(
            'Alle aufgezeichneten Runden und Anmeldungen löschen?\n\n' +
            'Die Kurven fangen danach bei null an. Chips, Stufen und Konten bleiben unberührt.',
            'Delete every recorded round and login?\n\n' +
            'The charts start from zero afterwards. Chips, levels and accounts stay untouched.'))) return;
      var mitParty = window.confirm(GK.txt(
        'Auch das Party-Protokoll löschen?\n\nOK = mit löschen, Abbrechen = vergangene Partys behalten',
        'Delete the party log as well?\n\nOK = delete it too, Cancel = keep past parties'));
      GK.commit('statReset', { runden: true, logins: true, party: mitParty })
        .then(function () {
          statDaten = null;
          statHolen();
          if (mitParty) partyLogHolen();
          GK.toast('Statistik zurückgesetzt 🗑', 'gold', '🗑');
          GK.sfx('click');
        });
    });

    /* ── Nächster Wipe ──
       Datum wählen, Haken für die Stufen setzen, fertig. Um Mitternacht
       dieses Tages setzt der Server alle Konten zurück — er sieht dafür
       jede halbe Minute nach und holt einen verpassten Termin nach, falls
       er zu dem Zeitpunkt gerade nicht lief. */
    var wipeDatum = el('input', { class: 'input', type: 'date' });
    var wipeXpBox = el('input', { type: 'checkbox' });
    var wipeStand = el('p', { class: 'hint' });
    var wipeSetzen = el('button', { class: 'btn btn-gold btn-small', text: '🧹 WIPE PLANEN' });
    var wipeAus = el('button', { class: 'btn btn-ghost btn-small', text: '✖ ABSAGEN' });

    function wipeSync() {
      var at = GK.wipeAt ? GK.wipeAt() : 0;
      if (at) {
        var d = new Date(at);
        wipeStand.textContent = 'Geplant: ' + d.toLocaleDateString('de-DE') + ' um ' +
          d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) +
          (GK.wipeXp() ? ' — mit Stufen' : ' — nur Chips');
        var iso = new Date(at - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        if (!wipeDatum.value) wipeDatum.value = iso;
        wipeXpBox.checked = GK.wipeXp();
      } else {
        wipeStand.textContent = 'Kein Wipe geplant. Ohne Termin bleibt die Anzeige im Hauptmenü aus.';
      }
      wipeAus.disabled = !at;
    }

    wipeSetzen.addEventListener('click', function () {
      if (!wipeDatum.value) { GK.toast('Erst ein Datum wählen', 'bad', '📅'); return; }
      /* Mitternacht des gewählten Tages in der Zeit dieses Geräts. */
      var teile = wipeDatum.value.split('-');
      var ziel = new Date(Number(teile[0]), Number(teile[1]) - 1, Number(teile[2]), 0, 0, 0, 0).getTime();
      if (ziel <= Date.now()) { GK.toast('Das Datum liegt schon hinter uns', 'bad', '📅'); return; }
      GK.setWipe(ziel, wipeXpBox.checked).then(function () {
        GK.logFeed('👑 ADMIN: Wipe geplant für ' + new Date(ziel).toLocaleDateString('de-DE'), 'admin');
        GK.toast('Wipe geplant', 'gold', '🧹');
        GK.sfx('cash');
        wipeSync();
        renderWipe();
      });
    });
    wipeAus.addEventListener('click', function () {
      GK.setWipe(0, false).then(function () {
        GK.toast('Wipe abgesagt', 'gold', '✖');
        GK.sfx('click');
        wipeSync();
        renderWipe();
      });
    });

    renderList();
    renderMP();
    renderQuoten();
    renderRegeln();
    partyLogHolen();
    wahlenFuellen();
    statHolen();
    wipeSync();
    syncLuck();

    /* Jeder Abschnitt ist eine eigene Karte. Auf dem Handy stehen sie
       untereinander wie bisher, auf dem Rechner nebeneinander im Gitter. */
    function feld(titel, kinder, breit) {
      return el('section', { class: 'admin-feld' + (breit ? ' admin-feld--breit' : '') },
        [el('div', { class: 'bet-label', text: titel }), el('div', { style: 'height:6px' })]
          .concat(kinder));
    }

    /* ── Reiter ──────────────────────────────────────────────────
       Dreizehn Kästen untereinander waren mehrere Bildschirmlängen zum
       Scrollen, in denen man nichts wiederfand. Jetzt liegen sie in fünf
       Gruppen, und oben steht, welche man gerade sieht.

       Gebaut werden alle auf einmal, versteckt wird nur. Die Kästen halten
       nämlich Zustand — die getroffene Spielerauswahl, ein aufgeklappter
       Sender, die laufende Uhr des Radios —, und der ginge beim Neubauen
       jedes Mal verloren. */
    var gruppen = [
      { id: 'spieler', icon: '👥', name: 'Spieler', felder: [
        feld('SPIELER', [
                    listBox,
                    el('div', { class: 'field' }, [el('label', { text: 'BETRAG' }), amount]),
                    quick,
                    el('div', { style: 'height:12px' }),
                    el('div', { class: 'modal-actions' }, [giveBtn, takeBtn, setBtn])
                  ]),

        feld('ERFAHRUNG (XP & LEVEL)', [
                    el('div', { class: 'field' }, [el('label', { text: 'XP-BETRAG' }), xpAmount]),
                    xpQuick,
                    el('div', { style: 'height:10px' }),
                    xpGiveBtn,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [xpAllBtn]),
                    el('p', { class: 'hint', text: 'Level bringen Chips und schalten Spiele frei. XP abziehen kann ein Spiel auch wieder sperren.' })
                  ]),

        feld('GLÜCKS-REGLER (HEIMLICHER CHEAT)', [
                    el('div', { class: 'range-row' }, [
                      luckSlider,
                      el('div', { class: 'info-box', style: 'min-width:92px' }, [
                        el('div', { class: 'luck-eingabe' }, [luckFeld, luckVal]),
                        el('span', { text: 'Luck' })
                      ])
                    ]),
                    el('p', { class: 'hint', text: '0 = verflucht, 50 = neutral, 100 = gesegnet, auf ein Zehntel genau. Gilt nur für den oben gewählten Spieler und kommt zur Quote des Spiels dazu.' })
                  ]),

        feld('EINZELNEN SPIELER ZURÜCKSETZEN', [
                    el('div', { class: 'modal-actions' }, [resetOneBtn]),
                    el('p', { class: 'hint', text: 'Setzt den oben gewählten Spieler auf 0 XP und ' + GK.START_BALANCE + ' Chips. Statistik geht mit zurück, Konto, Name, Passwort und Glücks-Regler bleiben.' })
                  ])
      ] },
      { id: 'spiele', icon: '🎰', name: 'Spielhalle', felder: [
        feld('SPIELE & EINSÄTZE', [
                    regelBox,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [regelnZurueck]),
                    el('p', { class: 'hint', text: 'Das Häkchen zeigt oder versteckt ein Spiel — für alle, überall: Spielhalle, Zufallsspiel, Party. Min und Max begrenzen den Einsatz in diesem Spiel; leer heißt, es gilt die Grenze des Spiels selbst. In einer Party kann der Gastgeber zusätzlich eigene Grenzen setzen — es gilt immer die engere.' })
                  ], true),

        feld('QUOTEN JE SPIEL', [
                    quotenBox,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [quotenNeutral]),
                    el('p', { class: 'hint', text: '50 ist neutral, Zehntel sind möglich — 50,5 ist ein Hauch gnädiger. Höher heißt: dieses Spiel ist zu allen Spielern gnädiger, tiefer heißt gieriger. Wirkt zusätzlich zum Glücks-Regler des Spielers. Blackjack und Baccarat stehen nicht in der Liste: dort werden echte Karten ausgeteilt, da gibt es nichts zu schieben.' })
                  ], true)
      ] },
      { id: 'musik', icon: '🎵', name: 'Musik', felder: [
        feld('MUSIK & RADIO', [
                    el('div', { class: 'pack-kopf', text: '⬆ NEUEN TITEL HOCHLADEN' }),
                    upDatei,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'mp-zwei' }, [
                      el('div', {}, [el('label', { class: 'mp-label', text: 'NAME' }), upName]),
                      el('div', {}, [el('label', { class: 'mp-label', text: 'WOHIN?' }), upZiel])
                    ]),
                    el('label', { class: 'party-schalter' }, [
                      upNurRadio,
                      el('span', {}, [
                        el('b', { text: 'Nur im Radio' }),
                        el('span', { class: 'party-schalter-was',
                                     text: 'Ohne Haken steht der Titel auch einzeln in der Stückauswahl.' })
                      ])
                    ]),
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [upKnopf]),
                    upStand,
                    el('p', { class: 'hint', text: 'Die Datei wandert nach assets/sfx/music/, die Spieldauer liest der Server selbst aus dem Dateikopf, und der Eintrag landet in sounds.json. MP3 wird dabei genau vermessen — bei anderen Formaten zählt für das Radio die Voreinstellung des Senders.' }),

                    el('div', { class: 'pack-kopf', text: '🎛 EINGEBAUTE LOOPS' }),
                    loopBox,
                    el('p', { class: 'hint', text: 'Diese fünf entstehen live im Browser und liegen in keiner Datei — löschen lassen sie sich deshalb nicht. Das Häkchen blendet einen aus, für alle. Läuft er bei jemandem gerade, springt der auf das nächste Stück.' }),

                    el('div', { class: 'pack-kopf', text: '💿 EINZELNE TITEL' }),
                    titelBox,
                    el('p', { class: 'hint', text: 'Der Regler richtet einen Titel gegen die anderen aus — aufgenommen ist nicht alles gleich laut. 100 % heißt: so, wie die Datei klingt. Der Papierkorb nimmt den Eintrag heraus, die Datei bleibt liegen.' }),

                    el('div', { class: 'pack-kopf', text: '📼 OFFLINE-RADIOS' }),
                    senderBox,
                    el('div', { style: 'height:8px' }),
                    radioStand,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'mp-zwei' }, [
                      el('div', {}, [el('label', { class: 'mp-label', text: 'SENDER' }), radioSenderWahl]),
                      el('div', {}, [el('label', { class: 'mp-label', text: 'STÜCK' }), radioStueckWahl])
                    ]),
                    el('div', { style: 'height:10px' }),
                    el('div', { class: 'modal-actions' }, [radioSkip, radioAuflegen, radioNeu]),
                    el('p', { class: 'hint', text: 'Diese Sender laufen aus eigenen Dateien auf dem Server — alle Zuhörer hören dasselbe Stück an derselben Stelle. WEITER überspringt den Rest, AUFLEGEN startet das gewählte Stück sofort. Beides gilt für alle.' }),

                    el('div', { class: 'pack-kopf', text: '📻 WEBRADIOS' }),
                    wrListe,
                    el('div', { style: 'height:10px' }),
                    el('div', { class: 'mp-zwei' }, [
                      el('div', {}, [el('label', { class: 'mp-label', text: 'NAME' }), wrName]),
                      el('div', {}, [el('label', { class: 'mp-label', text: 'SYMBOL' }), wrIcon])
                    ]),
                    wrEmojiBox,
                    el('label', { class: 'mp-label', text: 'ADRESSE DES STROMS' }), wrUrl,
                    el('label', { class: 'mp-label', text: 'UNTERZEILE' }), wrWas,
                    el('label', { class: 'mp-label', text: 'IN WELCHEN ANSTRICHEN?' }),
                    wrSkinBox,
                    el('div', { style: 'height:10px' }),
                    el('div', { class: 'modal-actions' }, [wrSpeichern, wrNeu]),
                    el('p', { class: 'hint', text: 'Die Adresse eines Radiostroms, wie ihn ein Sender im Netz anbietet — sie muss mit http:// oder https:// anfangen. Eine Wiedergabeliste (.pls oder .m3u) geht auch: der Server holt die eigentliche Adresse selbst heraus. Ein Webradio läuft, wie es läuft — spulen und weiterschalten geht nicht. Was gerade gespielt wird, steht im Musikfenster, sofern der Sender es mitschickt. Ohne Häkchen erscheint es in jedem Anstrich. Eine Zeile anklicken holt sie zum Ändern herunter.' })
                  ], true)
      ] },
      { id: 'zahlen', icon: '📊', name: 'Statistiken', felder: [
        feld('STATISTIK', [
                    el('div', { class: 'stat-waehler' }, [spielerWahl, spielWahl]),
                    el('div', { style: 'height:8px' }),
                    spannenReihe,
                    reihenReihe,
                    typReihe,
                    el('div', { style: 'height:8px' }),
                    statKopf,
                    statRahmen,
                    el('div', { style: 'height:8px' }),
                    statTabelle,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [statNeu, statJson, statCsv, statLeeren]),
                    el('p', { class: 'hint', text: 'Netto ist aus Sicht der Spieler: positiv heißt, das Spiel hat in diesem Zeitraum mehr ausgezahlt als eingenommen. Aufgezeichnet werden die letzten 31 Tage.' })
                  ], true),

        feld('PARTY-PROTOKOLL', [
                    partyWahl,
                    el('div', { style: 'height:8px' }),
                    partyBox,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [partyNeu]),
                    el('p', { class: 'hint', text: 'Jede zu Ende gespielte Party landet hier mit ihren Einstellungen und dem Endstand — die letzten 120 Sitzungen.' })
                  ], true),

                  /* Alles, was klingt, in einem Kasten: die Stücke selbst, die
                     Sender aus eigenen Dateien und die Webradios. Vorher standen
                     die an drei Stellen, und wer eine Lautstärke geraderücken
                     wollte, musste an die Datei. */,

        feld('OFFENE TISCHE & PARTYS', [
                    mpBox,
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [mpNeu]),
                    el('p', { class: 'hint', text: 'Auflösen bucht alle Einkäufe zurück aufs Konto. Tische und Partys, in denen drei Minuten lang nichts passiert und die nie gestartet sind, verschwinden von selbst.' })
                  ])
      ] },
      { id: 'system', icon: '⚙️', name: 'Einstellungen', felder: [
        feld('VERWALTUNG', [
                    el('div', { class: 'modal-actions' }, [allBtn, resetBtn]),
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [pinBtn, exitBtn])
                  ]),

        feld('NÄCHSTER WIPE', [
                    el('div', { class: 'field' }, [el('label', { text: 'DATUM (0 UHR)' }), wipeDatum]),
                    el('label', { class: 'party-schalter' }, [
                      wipeXpBox,
                      el('span', {}, [
                        el('b', { text: 'Stufen mit zurücksetzen' }),
                        el('span', { class: 'party-schalter-was',
                                     text: 'Ohne Haken bleiben XP und Level stehen, nur die Chips gehen zurück.' })
                      ])
                    ]),
                    el('div', { style: 'height:8px' }),
                    el('div', { class: 'modal-actions' }, [wipeSetzen, wipeAus]),
                    wipeStand
                  ]),

        feld('GEFAHRENZONE', [
                    el('div', { class: 'admin-note', html: '⚠️ Löscht alle Spieler, Chips und Statistiken — für alle, auf dem Server. Nicht rückgängig zu machen.' }),
                    el('div', { class: 'modal-actions' }, [wipeBtn])
                  ])
      ] }
    ];

    var reiterLeiste = el('nav', { class: 'admin-reiter' });
    var flaechen = {};
    var reiterKnoepfe = [];

    function reiterZeigen(id) {
      adminReiter = id;
      Object.keys(flaechen).forEach(function (k) { flaechen[k].hidden = k !== id; });
      reiterKnoepfe.forEach(function (b) { b.classList.toggle('sel', b.dataset.reiter === id); });
      /* Die Statistik zeichnet auf ein Canvas, und ein verstecktes misst
         null — die Kurve käme in falscher Breite heraus. Also neu malen,
         sobald der Reiter wirklich sichtbar ist. */
      if (id === 'zahlen') setTimeout(function () { try { statZeichnen(); } catch (e) {} }, 0);
    }

    gruppen.forEach(function (g) {
      var knopf = el('button', { class: 'btn btn-small', type: 'button' }, [
        el('span', { class: 'reiter-ic', text: g.icon }),
        el('span', { text: g.name })
      ]);
      knopf.dataset.reiter = g.id;
      knopf.addEventListener('click', function () { GK.sfx('click'); reiterZeigen(g.id); });
      reiterLeiste.appendChild(knopf);
      reiterKnoepfe.push(knopf);
      var flaeche = el('div', { class: 'admin-gitter' }, g.felder);
      flaeche.hidden = true;
      flaechen[g.id] = flaeche;
    });

    GK.modal({
      emoji: '👑',
      weit: true,
      title: 'Admin-Panel',
      text: 'Spieler wählen, Chips verteilen, Schicksal manipulieren. Mit großer Macht kommt großes Chaos.',
      nodes: [
        reiterLeiste,
        el('div', { class: 'admin-note', html: '💡 <b>Money-Give:</b> Spieler antippen, Betrag eingeben, <b>GEBEN</b> drücken. Geschenkte Chips zählen nicht als Profit im Leaderboard.' })
      ].concat(gruppen.map(function (g) { return flaechen[g.id]; }))
    });

    /* Beim nächsten Öffnen steht man wieder da, wo man aufgehört hat. */
    reiterZeigen(flaechen[adminReiter] ? adminReiter : 'spieler');

    /* Der Sender läuft weiter, während das Panel offen steht — die Anzeige
       zieht im Takt nach und räumt sich weg, sobald das Fenster zu ist. */
    radioSenderHolen();
    packHolen();
    radioUhr = setInterval(function () {
      if (!radioStand.isConnected) { clearInterval(radioUhr); radioUhr = null; return; }
      radioStandHolen();
    }, 5000);
  }

  /* ─────────────── BOOT ─────────────── */
  function fillStaticIcons() {
    $$('[data-icon]').forEach(function (n) {
      if (!n.firstChild) n.innerHTML = GK.iconHTML(n.getAttribute('data-icon'));
    });
  }

  /* Die Zahl im Hero kam aus dem HTML und blieb bei jedem neuen Spiel stehen.
     Jetzt zaehlt sie die Registry — einmal registriert, stimmt sie von selbst. */
  function renderGameCount() {
    var n = $('#game-count');
    if (!n) return;
    /* In der Party zaehlt nur, was der Gastgeber freigegeben hat. */
    var d = GK.party && GK.party.an && GK.party.daten;
    if (d) {
      var wieviele = (GK.party.spiele() || GK.games.map(function (g) { return g.id; })).length;
      n.textContent = wieviele + ' SPIELE';
      return;
    }
    n.textContent = GK.games.length + ' SPIELE';
  }

  /**
   * Der Kopf der Spielhalle passt sich der Party an.
   *
   * Sonst steht dort waehrend einer Party weiter "Jeder startet mit 500
   * Chips" und darunter, welches Spiel als naechstes freischaltet — beides
   * gilt gerade nicht: die Party hat ihr eigenes Guthaben, und gespielt wird
   * nur, was ausgewaehlt wurde.
   */
  /**
   * Countdown bis zum naechsten Wipe.
   *
   * Steht keiner an, bleibt die Zeile ausgeblendet — sie soll nur dann Platz
   * kosten, wenn es wirklich etwas zu wissen gibt.
   */
  function renderWipe() {
    var box = $('#wipe-uhr');
    if (!box) return;
    var ziel = GK.wipeAt ? GK.wipeAt() : 0;
    var rest = ziel - Date.now();
    if (!ziel || rest <= 0) { box.hidden = true; return; }
    var tage = Math.floor(rest / 86400000);
    var std = Math.floor(rest / 3600000) % 24;
    var min = Math.floor(rest / 60000) % 60;
    var sek = Math.floor(rest / 1000) % 60;
    var txt = tage > 0 ? tage + ' T ' + std + ' Std ' + min + ' Min'
      : (std > 0 ? std + ' Std ' + min + ' Min ' + sek + ' Sek' : min + ' Min ' + sek + ' Sek');
    box.hidden = false;
    box.innerHTML = '🧹 <span>Nächster Wipe in</span> <b>' + txt + '</b> <span>· alle zurück auf ' +
      GK.fmt(GK.START_BALANCE) + ' Chips' + (GK.wipeXp && GK.wipeXp() ? ' und Stufe 1' : '') + '</span>';
  }

  function renderHero() {
    var sub = $('.hero-sub'), card = $('#level-card');
    var d = GK.party && GK.party.an && GK.party.daten;
    if (sub) {
      sub.innerHTML = d
        ? 'Party läuft: alle mit <b>' + GK.fmt(d.startChips) + ' Chips</b>. ' +
          'Wer am Ende den <b>größten Gewinn</b> hat, gewinnt. Die Rangliste steht oben links.'
        : 'Jeder startet mit <b>500 Chips</b>. Wer am Ende die dickste Krone trägt, ' +
          'gewinnt Ruhm, Ehre und ewiges Angeben-Recht.';
    }
    if (card) card.style.display = d ? 'none' : '';
    /* Der Tagesbonus gehört zum Konto, nicht zur Party: er würde 250 echte
       Chips gutschreiben, die in der Partykasse niemand sieht — und wer ihn
       mitten in der Runde abholt, hätte sie nach der Party trotzdem. Während
       einer Party ist der Knopf deshalb weg. */
    var bonus = $('#btn-daily');
    if (bonus) bonus.style.display = d ? 'none' : '';
    /* Das Casino-Leaderboard hat in der Party nichts zu suchen — dort zählt
       die Rangliste oben links, und die steht auf Partychips. Der Knopf
       führte sonst zu einer ausgeblendeten Tafel. */
    var zumBoard = $('#btn-goto-board');
    if (zumBoard) zumBoard.style.display = d ? 'none' : '';
  }

  function boot() {
    GK.initFX();
    kopfHoeheMessen();
    fillStaticIcons();
    renderGameCount();
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
      /* Fenster mitten in einer Runde zugemacht? Dann steht der Einsatz noch
         offen und niemand kann ihn mehr gewinnen — zurueck damit. Runden mit
         gesichertem Stand bleiben unangetastet und lassen sich fortsetzen. */
      refundOpenStake();
      afterLoad();
    });

    // Header
    $('#brand-btn').addEventListener('click', function () { GK.sfx('click'); closeGame(); showView('view-lobby'); });
    $('#btn-back').addEventListener('click', function () { GK.sfx('click'); closeGame(); showView('view-lobby'); renderAll(); });
    $('#hud-player').addEventListener('click', accountMenu);
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
      /* In der Party stehen nur die Spiele zur Wahl, die der Gastgeber
         freigegeben hat — sonst landet der Zufall auf einer Kachel, die es
         dort gar nicht gibt. */
      var topf = GK.games.filter(function (g) {
        if (GK.gameAus(g.id)) return false;
        if (GK.party && GK.party.an && !GK.party.erlaubt(g.id)) return false;
        return spielbar(g);
      });
      if (!topf.length) { GK.toast('Kein Spiel verfügbar', 'bad', '🎲'); return; }
      openGame(GK.pick(topf).id);
    });
    $('#btn-multiplayer').addEventListener('click', function () { GK.sfx('click'); openMP(); });
    $('#btn-mp-back').addEventListener('click', function () {
      GK.sfx('click');
      showView('view-lobby');          // steht auch vom Tisch auf, siehe showView
      renderAll();
    });
    $('#btn-mp-rules').addEventListener('click', function () { GK.sfx('click'); GK.mp.rules(); });
    $('#btn-goto-board').addEventListener('click', function () {
      GK.sfx('click');
      showView('view-lobby');
      setTimeout(function () { $('#board-anchor').scrollIntoView({ behavior: 'smooth' }); }, 80);
    });
    $('#btn-daily').addEventListener('click', function () { GK.sfx('click'); dailyBonus(); });
    $('#btn-new-player').addEventListener('click', function () { GK.sfx('click'); authModal({ mode: 'register', closable: true }); });

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
      if (GK.music.wanted) {
        /* Lief zuletzt das Radio, geht es damit weiter — sonst mit dem
           zuletzt gewählten Stück. */
        if (GK.music._radioWunsch) GK.music.radioAn(GK.music._radioWunsch);
        else GK.music.start();
      }
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    /* Party an oder aus: die Spielhalle zeigt danach andere Kacheln, und der
       Kontostand in der Kopfleiste kommt aus einer anderen Kasse. */
    /* renderGames ausdruecklich: renderAll zeichnet die Kacheln nur neu, wenn
       sich die Stufe geaendert hat — hier aendert sich aber die Auswahl. */
    GK.on('party-start', function () {
      showView('view-lobby'); renderGames(); renderGameCount(); renderHero(); renderAll();
    });
    /* Party vorbei: erst raus aus dem Spiel, dann raeumt party.js die Kasse
       ab. Die Reihenfolge ist wichtig — siehe beenden() in js/party.js. */
    GK.on('party-schliessen', function () {
      /* Nur wer gerade in einem Spiel sitzt, wird herausgeholt. Wer die Party
         von der Mehrspieler-Seite aus verlaesst, soll dort bleiben — sonst
         landet er ohne Grund in der Spielhalle. */
      var imSpiel = $('#view-game').classList.contains('active');
      closeGame(true);
      if (imSpiel) showView('view-lobby');
    });
    GK.on('party-ende', function () {
      renderGames(); renderGameCount(); renderHero(); renderAll();
    });

    GK.on('player-changed', function () {
      renderAll();
      // Vom Admin auf einem anderen Gerät gelöscht? Dann neu anmelden.
      if (!GK.player() && $('#modal-root').hidden) authModal();
    });
    GK.on('feed', renderFeed);
    GK.on('logged-out', function () {
      renderAll();
      if ($('#modal-root').hidden) authModal();
    });
    GK.on('xp', renderLevel);
    GK.on('level-up', celebrateLevel);

    // Feed-Zeiten frisch halten
    setInterval(renderFeed, 60000);
    // Der Wipe-Countdown laeuft sekundengenau
    setInterval(renderWipe, 1000);

    // Regelmäßig den Stand der anderen holen, solange die Lobby offen ist
    GK.net.startPolling(function () {
      return $('#view-lobby').classList.contains('active');
    });
  }

  /** läuft, sobald Server- oder Offline-Daten geladen sind */
  function afterLoad() {
    // Gespeicherte Sitzung? Dann direkt weiterspielen.
    GK.net.resume().then(function (r) {
      if (r && r.ok && GK.player()) {
        GK.updateHUD();
        renderAll();
        GK.toast('Willkommen zurück, ' + GK.player().name + '! 👑', 'gold', GK.player().avatar);
        return;
      }
      if (!GK.net.online && GK.player()) {   // Offline-Profil auf diesem Gerät
        GK.updateHUD();
        renderAll();
        GK.toast('Willkommen zurück, ' + GK.player().name + '! 👑', 'gold', GK.player().avatar);
        return;
      }
      GK.state.currentId = null;
      GK.updateHUD();
      setTimeout(function () { authModal(); }, 350);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.GK);
