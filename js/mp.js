/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Mehrspieler (Browser-Seite)

   Zeigt an, was der Server sagt, und schickt Zuege hin. Gerechnet wird hier
   nichts: welche Karte faellt und wer gewinnt, entscheidet mp.js auf dem
   Server. Diese Datei kennt nicht einmal die Karten der anderen — sie kommen
   erst beim Showdown mit.

   Neue Zustaende holt eine Langabfrage: die Anfrage bleibt offen, bis sich
   etwas aendert. Dadurch sieht man den Zug des Gegenuebers sofort, ohne im
   Sekundentakt zu fragen.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var el = GK.el;

  var MP = GK.mp = {
    an: false,          // Ansicht offen
    tisch: null,        // aktueller Tisch (Serversicht)
    lobby: null,
    seit: 0,
    laeuft: false
  };

  var stage = null;
  var abbruch = null;   // laufende Langabfrage abbrechen

  /* ── Server ───────────────────────────────────────────────────────── */

  function ruf(pfad, daten) {
    if (!GK.net || !GK.net.online) {
      return Promise.reject(new Error('Mehrspieler braucht den Casino-Server'));
    }
    var body = Object.assign({ session: GK.net.session }, daten || {});
    var ctrl = window.AbortController ? new AbortController() : null;
    if (pfad === 'lobby' || pfad === 'table') abbruch = ctrl;
    return fetch('api/mp/' + pfad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (b.state && GK.adoptState) GK.adoptState(b.state);
        if (!r.ok) { var e = new Error(b.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return b;
      });
    });
  }

  function fehler(e) {
    if (e && e.name === 'AbortError') return;
    GK.toast(e && e.message ? e.message : 'Da ging etwas schief', 'bad', '📡');
    GK.sfx('error');
  }

  /* ── Schleife ─────────────────────────────────────────────────────── */

  function schleife() {
    if (!MP.an) return;
    var wo = MP.tisch ? 'table' : 'lobby';
    var daten = { since: MP.seit };
    if (MP.tisch) daten.table = MP.tisch.id;

    ruf(wo, daten).then(function (b) {
      if (!MP.an) return;
      if (b.lobby) { MP.lobby = b.lobby; MP.seit = b.lobby.v; }
      if (b.tisch) { MP.tisch = b.tisch; MP.seit = Math.max(MP.seit, b.v || b.tisch.v || 0); }
      else if (wo === 'table') {
        /* Der Tisch ist weg — zurueck in die Uebersicht. */
        MP.tisch = null; MP.seit = 0;
        GK.toast('Der Tisch wurde aufgelöst', 'bad', '🃏');
      }
      zeichne();
      schleife();
    }).catch(function (e) {
      if (!MP.an) return;
      /* Abgebrochen heisst: gerade ist etwas passiert, das sofort neu
         abgefragt werden soll. Ohne diesen Neustart bliebe die Schleife
         stehen und die Ansicht fror nach dem ersten eigenen Zug ein. */
      if (e && e.name === 'AbortError') { schleife(); return; }
      if (e && e.status === 404 && MP.tisch) { MP.tisch = null; MP.seit = 0; zeichne(); }
      // nicht sofort weiterhaemmern, wenn der Server gerade nicht mag
      setTimeout(function () { if (MP.an) schleife(); }, 2500);
    });
  }

  function anstossen() {
    if (abbruch) { try { abbruch.abort(); } catch (e) {} abbruch = null; }
  }

  /* ── Ansicht oeffnen und schliessen ───────────────────────────────── */

  MP.open = function (root) {
    stage = root;
    MP.an = true;
    MP.seit = 0;
    stage.innerHTML = '';
    stage.appendChild(el('p', { class: 'mp-laden', text: 'Verbinde mit dem Casino…' }));
    schleife();
  };

  MP.close = function () {
    MP.an = false;
    anstossen();
  };

  /* ── Aktionen ─────────────────────────────────────────────────────── */

  function tue(pfad, daten) {
    return ruf(pfad, daten).then(function (b) {
      anstossen();          // laufende Langabfrage sofort erneuern
      MP.seit = 0;
      return b;
    }).catch(fehler);
  }

  function beitreten(tisch, einkauf) {
    GK.sfx('click');
    tue('join', { table: tisch.id, buyIn: einkauf }).then(function (b) {
      if (b && b.table) { MP.tisch = { id: b.table }; MP.seit = 0; anstossen(); }
    });
  }

  function verlassen() {
    GK.sfx('click');
    tue('leave', {}).then(function () { MP.tisch = null; MP.seit = 0; anstossen(); });
  }

  function zug(action, amount) {
    GK.sfx(action === 'fold' ? 'card' : 'chip');
    tue('action', { action: action, amount: amount });
  }

  /* ── Uebersicht ───────────────────────────────────────────────────── */

  function tischKarte(t) {
    var voll = t.besetzt >= t.plaetze;
    var leute = t.spieler.map(function (s) {
      return el('span', { class: 'mp-wer' + (s.online ? '' : ' weg') }, [
        el('span', { class: 'mp-av', text: s.avatar || '👤' }),
        el('span', { text: s.name }),
        el('b', { text: GK.fmt(s.stack) })
      ]);
    });
    for (var i = t.besetzt; i < t.plaetze; i++) {
      leute.push(el('span', { class: 'mp-wer frei', text: '– frei –' }));
    }

    var knopf = el('button', {
      class: 'btn btn-gold btn-small',
      text: voll ? 'VOLL' : 'PLATZ NEHMEN'
    });
    knopf.disabled = voll;
    knopf.addEventListener('click', function () { einkaufFragen(t); });

    return el('div', { class: 'mp-tisch' + (t.laeuft ? ' laeuft' : '') }, [
      el('div', { class: 'mp-tisch-kopf' }, [
        el('span', { class: 'mp-tisch-name', text: t.name }),
        el('span', { class: 'mp-tisch-blinds', text: t.game === 'poker'
          ? 'Blinds ' + t.sb + '/' + t.bb
          : 'Einsatz ' + t.bb })
      ]),
      el('div', { class: 'mp-leute' }, leute),
      el('div', { class: 'mp-tisch-fuss' }, [
        el('span', { class: 'mp-zustand', text: t.laeuft ? '● läuft' : '○ wartet' }),
        el('span', { class: 'mp-einkauf', text: 'Einkauf ' + GK.fmt(t.minBuy) + '–' + GK.fmt(t.maxBuy) }),
        knopf
      ])
    ]);
  }

  function einkaufFragen(t) {
    GK.sfx('click');
    var p = GK.player();
    var moeglich = Math.min(t.maxBuy, p ? p.balance : 0);
    if (!p || p.balance < t.minBuy) {
      GK.toast('Für diesen Tisch brauchst du mindestens ' + GK.fmt(t.minBuy) + ' Chips', 'bad', '🪙');
      GK.sfx('error');
      return;
    }
    var feld = el('input', {
      type: 'number', class: 'mp-feld',
      value: String(Math.min(moeglich, t.minBuy * 2)),
      min: String(t.minBuy), max: String(moeglich), step: String(t.bb)
    });
    var ok = el('button', { class: 'btn btn-gold btn-full', text: '🪑 PLATZ NEHMEN' });
    ok.addEventListener('click', function () {
      GK.closeModal();
      beitreten(t, GK.clamp(parseInt(feld.value, 10) || t.minBuy, t.minBuy, moeglich));
    });
    GK.modal({
      title: t.name,
      text: 'Wieviel nimmst du mit an den Tisch? Der Stapel kommt beim Aufstehen ' +
            'komplett zurück aufs Konto — verlieren kannst du nur, was du am Tisch verspielst.',
      nodes: [
        el('label', { class: 'mp-label', text: 'Einkauf (' + GK.fmt(t.minBuy) + ' bis ' + GK.fmt(moeglich) + ')' }),
        feld, el('div', { style: 'height:10px' }), ok
      ]
    });
  }

  function neuerTisch(spiel) {
    GK.sfx('click');
    var p = GK.player();
    if (!p) return;
    var name = el('input', { type: 'text', class: 'mp-feld', value: p.name + 's Tisch', maxlength: '24' });
    var blind = el('select', { class: 'mp-feld' });
    [10, 20, 50, 100, 250].forEach(function (b) {
      blind.appendChild(el('option', { value: String(b), text: spiel === 'poker'
        ? 'Blinds ' + (b / 2) + '/' + b + '  ·  Einkauf ab ' + GK.fmt(b * 10)
        : 'Einsatz ' + b + ' pro Wurf  ·  Einkauf ab ' + GK.fmt(b * 10) }));
    });
    var ok = el('button', { class: 'btn btn-gold btn-full', text: '✨ TISCH ERÖFFNEN' });
    ok.addEventListener('click', function () {
      var bb = parseInt(blind.value, 10);
      GK.closeModal();
      tue('create', { game: spiel, name: name.value, bb: bb, buyIn: bb * 20 }).then(function (b) {
        if (b && b.table) { MP.tisch = { id: b.table }; MP.seit = 0; anstossen(); }
      });
    });
    GK.modal({
      title: 'Neuer Tisch',
      text: 'Du eröffnest den Tisch und nimmst gleich Platz. Sobald sich jemand dazusetzt, geht es los.',
      nodes: [
        el('label', { class: 'mp-label', text: 'Name' }), name,
        el('label', { class: 'mp-label', text: 'Höhe' }), blind,
        el('div', { style: 'height:10px' }), ok
      ]
    });
  }

  function zeichneLobby() {
    var l = MP.lobby;
    var wrap = el('div', { class: 'mp-lobby' });

    wrap.appendChild(el('p', { class: 'mp-intro', html:
      'Hier spielst du gegen <b>echte Leute</b> statt gegen den Automaten. ' +
      'Setz dich an einen offenen Tisch oder mach einen eigenen auf — ' +
      'sobald ein zweiter Platz belegt ist, geht es los.' }));

    var spiele = el('div', { class: 'mp-spiele' }, l.spiele.map(function (g) {
      var neu = el('button', { class: 'btn btn-gold btn-small', text: '+ TISCH' });
      neu.addEventListener('click', function () { neuerTisch(g.id); });
      return el('div', { class: 'mp-spiel' }, [
        el('div', { class: 'mp-spiel-ic', html: GK.iconHTML(g.icon) }),
        el('div', { class: 'mp-spiel-text' }, [
          el('h3', { text: g.name }),
          el('p', { text: g.kurz }),
          el('div', { class: 'mp-zahlen' }, [
            el('span', { html: '<b>' + g.tische + '</b> ' + (g.tische === 1 ? 'Tisch' : 'Tische') }),
            el('span', { html: '<b>' + g.spieler + '</b> ' + (g.spieler === 1 ? 'Spieler' : 'Spieler') }),
            el('span', { class: 'mp-namen', text: g.namen.length ? g.namen.join(', ') : 'gerade niemand' })
          ])
        ]),
        neu
      ]);
    }));
    wrap.appendChild(spiele);

    wrap.appendChild(el('h2', { class: 'section-title' }, [el('span', { text: '🪑 OFFENE TISCHE' })]));
    if (!l.tische.length) {
      wrap.appendChild(el('p', { class: 'mp-leer', text:
        'Noch kein Tisch offen. Mach den ersten auf — wer die Multiplayer-Seite ' +
        'aufruft, sieht ihn sofort.' }));
    } else {
      wrap.appendChild(el('div', { class: 'mp-tische' }, l.tische.map(tischKarte)));
    }

    var wach = l.online || [];
    wrap.appendChild(el('h2', { class: 'section-title' }, [el('span', { text: '👋 GERADE DA' })]));
    wrap.appendChild(el('div', { class: 'mp-online' }, wach.length
      ? wach.map(function (o) {
          return el('span', { class: 'mp-wer' }, [
            el('span', { class: 'mp-av', text: o.avatar || '👤' }),
            el('span', { text: o.name })
          ]);
        })
      : [el('span', { class: 'mp-leer', text: 'Gerade schaut sonst niemand her.' })]));

    return wrap;
  }

  /* ── Tisch ────────────────────────────────────────────────────────── */

  /* Dieselben Kartenbilder wie in den Einzelspielen — samt gewaehltem Deck. */
  function karte(c, klein) {
    return GK.cardEl(c || { r: 'A', s: '♠' }, !c, klein ? 'mini' : '');
  }

  function meinPlatz() {
    var me = GK.player();
    if (!me || !MP.tisch) return null;
    var gefunden = null;
    MP.tisch.seats.forEach(function (s) { if (s && s.id === me.id) gefunden = s; });
    return gefunden;
  }

  /**
   * Ein Platz. Leere Plaetze zeigen keinen leeren Kasten mehr: wer selbst am
   * Tisch sitzt, bekommt dort einen Knopf, um einen Bot dazuzusetzen — allen
   * anderen wird der Platz gar nicht erst angezeigt, sonst steht die Haelfte
   * des Tisches als Loch da.
   */
  function sitzKachel(s, t, platz) {
    if (!s) {
      if (!meinPlatz() || t.game !== 'poker') return null;
      var plus = el('button', { class: 'mp-sitz frei', title: 'Bot auf diesen Platz setzen' }, [
        el('span', { class: 'mp-plus', text: '+' }),
        el('span', { class: 'mp-frei-text', text: 'BOT DAZU' })
      ]);
      plus.addEventListener('click', function () {
        GK.sfx('click');
        tue('action', { action: 'addbot' });
      });
      return plus;
    }
    var h = t.hand;
    var dran = h && h.turn === s.platz;
    var karten = el('div', { class: 'mp-karten' });
    if (s.cards) s.cards.forEach(function (c) { karten.appendChild(karte(c, true)); });
    else if (s.verdeckt) { karten.appendChild(karte(null, true)); karten.appendChild(karte(null, true)); }

    var gewinn = h && h.ergebnis && h.ergebnis.gewinne[s.platz];
    var handName = h && h.ergebnis && h.ergebnis.haende && h.ergebnis.haende[s.platz];

    /* Einen Bot darf jeder am Tisch wieder wegschicken. */
    var weg = null;
    if (s.bot && meinPlatz()) {
      weg = el('button', { class: 'mp-kick', title: s.name + ' wegschicken', text: '✕' });
      weg.addEventListener('click', function () {
        GK.sfx('click');
        tue('action', { action: 'kickbot', seat: s.platz });
      });
    }

    return el('div', {
      class: 'mp-sitz' + (dran ? ' dran' : '') + (s.folded ? ' raus' : '') +
             (s.online ? '' : ' weg') + (gewinn ? ' sieger' : '') + (s.bot ? ' bot' : '')
    }, [
      el('div', { class: 'mp-sitz-kopf' }, [
        el('span', { class: 'mp-av', text: s.avatar || '👤' }),
        el('span', { class: 'mp-sitz-name', text: s.name }),
        s.bot ? el('span', { class: 'mp-bot-tag', text: 'BOT' }) : null,
        t.dealer === s.platz ? el('span', { class: 'mp-knopf', text: 'D' }) : null,
        weg
      ].filter(Boolean)),
      karten,
      el('div', { class: 'mp-stack', text: GK.fmt(s.stack) + ' Chips' }),
      s.bet ? el('div', { class: 'mp-bet', text: GK.fmt(s.bet) }) : null,
      s.allIn ? el('div', { class: 'mp-tag', text: 'ALL-IN' }) : null,
      s.folded ? el('div', { class: 'mp-tag raus', text: 'passt' }) : null,
      gewinn ? el('div', { class: 'mp-tag win', text: '+' + GK.fmt(gewinn) }) : null,
      handName ? el('div', { class: 'mp-handname', text: handName.name }) : null
    ].filter(Boolean));
  }

  function pokerAktionen(t) {
    var h = t.hand;
    var ich = meinPlatz();
    var box = el('div', { class: 'mp-aktionen' });
    if (!ich) return box;

    if (ich.stack <= 0 && (!h || !h.turn || h.turn !== ich.platz)) {
      var nach = el('button', { class: 'btn btn-gold btn-full', text: '🔁 NACHKAUFEN' });
      nach.addEventListener('click', function () { GK.sfx('click'); tue('action', { action: 'rebuy', buyIn: t.minBuy }); });
      box.appendChild(nach);
      return box;
    }
    if (!h || h.turn !== ich.platz) {
      box.appendChild(el('p', { class: 'mp-warte', text: h && h.turn >= 0
        ? (t.seats[h.turn] ? t.seats[h.turn].name + ' ist dran…' : 'Warte…')
        : 'Warte auf die nächste Hand…' }));
      return box;
    }

    var fehlt = h.toCall - ich.bet;
    var fold = el('button', { class: 'btn btn-danger', text: '🏳️ PASSEN' });
    fold.addEventListener('click', function () { zug('fold'); });

    var mitte = fehlt > 0
      ? el('button', { class: 'btn btn-gold', text: '✅ MITGEHEN ' + GK.fmt(Math.min(fehlt, ich.stack)) })
      : el('button', { class: 'btn btn-gold', text: '👉 SCHIEBEN' });
    mitte.addEventListener('click', function () { zug(fehlt > 0 ? 'call' : 'check'); });

    var ziel = Math.min(ich.bet + ich.stack, h.toCall + Math.max(h.minRaise, t.bb));
    var feld = el('input', {
      type: 'number', class: 'mp-feld mp-raise',
      value: String(ziel), min: String(ziel), max: String(ich.bet + ich.stack), step: String(t.bb)
    });
    var raise = el('button', { class: 'btn btn-lime', text: '⬆️ ERHÖHEN' });
    raise.addEventListener('click', function () {
      zug('raise', parseInt(feld.value, 10) || ziel);
    });
    var allin = el('button', { class: 'btn btn-ghost btn-small', text: 'ALL-IN ' + GK.fmt(ich.stack) });
    allin.addEventListener('click', function () { zug('allin'); });

    box.appendChild(el('div', { class: 'mp-knoepfe' }, [fold, mitte, raise]));
    box.appendChild(el('div', { class: 'mp-raise-zeile' }, [feld, allin]));
    return box;
  }

  function flipAktionen(t) {
    var h = t.hand;
    var ich = meinPlatz();
    var box = el('div', { class: 'mp-aktionen' });
    if (!ich) return box;
    if (ich.stack <= 0) {
      var nach = el('button', { class: 'btn btn-gold btn-full', text: '🔁 NACHKAUFEN' });
      nach.addEventListener('click', function () { GK.sfx('click'); tue('action', { action: 'rebuy', buyIn: t.minBuy }); });
      box.appendChild(nach);
      return box;
    }
    if (!h) {
      box.appendChild(el('p', { class: 'mp-warte', text: 'Warte auf einen Gegner…' }));
      return box;
    }
    if (h.ergebnis) {
      box.appendChild(el('p', { class: 'mp-warte', text: 'Die Münze zeigt ' +
        (h.seite === 'krone' ? 'Krone 👑' : 'Drache 🐉') }));
      return box;
    }
    if (h.meineWahl) {
      box.appendChild(el('p', { class: 'mp-warte', text: 'Du hast ' +
        (h.meineWahl === 'krone' ? 'Krone' : 'Drache') + ' — warte auf den Gegner…' }));
      return box;
    }
    var krone = el('button', { class: 'btn btn-gold', text: '👑 KRONE' });
    var drache = el('button', { class: 'btn btn-lime', text: '🐉 DRACHE' });
    krone.addEventListener('click', function () { zug('krone'); });
    drache.addEventListener('click', function () { zug('drache'); });
    box.appendChild(el('div', { class: 'mp-knoepfe' }, [krone, drache]));
    return box;
  }

  function zeichneTisch() {
    var t = MP.tisch;
    var h = t.hand;
    var wrap = el('div', { class: 'mp-am-tisch' });

    var auf = el('button', { class: 'btn btn-ghost btn-small', text: '🚪 AUFSTEHEN' });
    auf.addEventListener('click', verlassen);

    wrap.appendChild(el('div', { class: 'mp-kopf' }, [
      el('div', {}, [
        el('h3', { text: t.name }),
        el('span', { class: 'mp-tisch-blinds', text: t.game === 'poker'
          ? 'Blinds ' + t.sb + '/' + t.bb + (h ? '  ·  Hand ' + h.nr : '')
          : 'Einsatz ' + t.bb + (h ? '  ·  Runde ' + h.nr : '') })
      ]),
      auf
    ]));

    if (t.game === 'poker') {
      var board = el('div', { class: 'mp-board' });
      var karten = (h && h.board) || [];
      for (var i = 0; i < 5; i++) board.appendChild(karten[i] ? karte(karten[i]) : el('div', { class: 'card slot' }));
      wrap.appendChild(el('div', { class: 'mp-mitte' }, [
        board,
        el('div', { class: 'mp-pot', text: h ? 'Pot ' + GK.fmt(h.pot) : (t.wartetAb ? 'gleich geht es los…' : 'wartet auf Spieler') })
      ]));
    } else {
      wrap.appendChild(el('div', { class: 'mp-mitte' }, [
        el('div', { class: 'mp-muenze' + (h && h.seite ? ' ' + h.seite : '') },
          [el('span', { text: h && h.seite ? (h.seite === 'krone' ? '👑' : '🐉') : '🪙' })]),
        el('div', { class: 'mp-pot', text: h ? 'Einsatz ' + GK.fmt(h.einsatz) + ' pro Spieler'
                                            : 'wartet auf einen Gegner' })
      ]));
    }

    var kacheln = t.seats.map(function (s, i) { return sitzKachel(s, t, i); })
      .filter(Boolean);
    wrap.appendChild(el('div', { class: 'mp-sitze n' + t.seats.length }, kacheln));

    wrap.appendChild(t.game === 'poker' ? pokerAktionen(t) : flipAktionen(t));

    if (h && h.deadline) {
      var rest = Math.max(0, Math.round((h.deadline - Date.now()) / 1000));
      wrap.appendChild(el('div', { class: 'mp-uhr', text: rest + ' s' }));
    }

    wrap.appendChild(el('div', { class: 'mp-log' }, (t.log || []).map(function (z) {
      return el('div', { class: 'mp-log-zeile', text: z.text });
    })));

    return wrap;
  }

  /* ── Zeichnen ─────────────────────────────────────────────────────── */

  var uhrTimer = null;

  function zeichne() {
    if (!stage || !MP.an) return;
    stage.innerHTML = '';
    stage.appendChild(MP.tisch && MP.tisch.seats ? zeichneTisch() : zeichneLobby());

    var titel = document.getElementById('mp-title');
    if (titel) {
      titel.textContent = MP.tisch && MP.tisch.name ? MP.tisch.name : 'Multiplayer';
    }

    /* Die Restzeit laeuft ohne neue Serverantwort weiter. */
    if (uhrTimer) clearInterval(uhrTimer);
    uhrTimer = setInterval(function () {
      var u = stage && stage.querySelector('.mp-uhr');
      if (!u || !MP.tisch || !MP.tisch.hand || !MP.tisch.hand.deadline) return;
      var rest = Math.max(0, Math.round((MP.tisch.hand.deadline - Date.now()) / 1000));
      u.textContent = rest + ' s';
      u.classList.toggle('knapp', rest <= 8);
    }, 500);
  }

  /** Regeln fuer die Ansicht — je nachdem, wo man gerade ist. */
  MP.rules = function () {
    var poker = [
      '<b>Texas Hold\'em</b> gegen echte Leute: zwei eigene Karten, fünf offene in der Mitte.',
      'Die Blinds wechseln reihum. Der Knopf <b>D</b> zeigt, wer gerade Dealer ist.',
      'Du hast <b>30 Sekunden</b> pro Zug. Läuft die Zeit ab, wird geschoben oder gepasst.',
      'Wer mehr setzt, als ein anderer decken kann, spielt um einen <b>Seitentopf</b> — man gewinnt nie mehr, als man selbst riskiert hat.',
      'Dein Stapel gehört dir: beim <b>Aufstehen</b> kommt alles zurück aufs Konto.',
      'Gehst du mitten in einer Hand, zählt das als Passen — der schon gesetzte Teil bleibt im Pot.'
    ];
    var flip = [
      '<b>Einer gegen einen.</b> Beide setzen denselben Betrag, die Münze entscheidet.',
      'Wer zuerst wählt, bekommt seine Seite — der zweite die andere.',
      'Wählst du nicht rechtzeitig, bekommst du die freie Seite zugeteilt.'
    ];
    var t = MP.tisch;
    GK.modal({
      title: t && t.game === 'coinflip' ? 'Münzduell' : (t ? 'Königs-Poker' : 'Multiplayer'),
      nodes: [el('ul', { class: 'rules' },
        (t && t.game === 'coinflip' ? flip : t ? poker : poker.concat(flip))
          .map(function (r) { return el('li', { html: r }); }))]
    });
  };
})(window.GK);
