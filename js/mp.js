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
  /* Einmal gebaut und wiederverwendet: cardThemePicker haengt sich bei jedem
     Aufruf neu an das cardtheme-Ereignis, und zeichne() laeuft bei jeder
     Serverantwort — das waeren nach einer Runde hunderte Zuhoerer, die alle
     an einem laengst weggeworfenen Baum haengen. */
  var deckWahl = null;
  /* Stand, der zuletzt gezeichnet wurde — siehe die Begruendung in schleife(). */
  var gezeichnetV = '';
  /* Welche Karten schon einmal auf dem Tisch lagen. Der Tisch wird bei jeder
     Aenderung komplett neu gebaut; ohne dieses Gedaechtnis waeren alle Karten
     jedes Mal "neu" und die Einwurf-Animation liefe bei jedem Zug auf allen
     Karten gleichzeitig los. Gemerkt wird Hand, Platz und Karte — beim
     naechsten Geben sind die Schluessel andere, dann fliegt wieder alles ein. */
  var gesehen = {};
  /* Karten, die in diesem Durchlauf neu dazugekommen sind. Der Klang kommt
     erst nach dem Aufbauen und gestaffelt — sonst faellt beim Geben alles auf
     denselben Moment und man hoert einen Schlag statt vier. */
  var neueKarten = 0;
  /* Beim ersten Bild eines Tisches liegt schon alles da: wer sich mitten in
     eine Hand setzt, soll nicht ein Dutzend Karten auf einmal hoeren. */
  var ersterAufbau = true;

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
      /* Ob der Tisch noch steht, sagt allein der Server ueber 404 — siehe
         unten. Eine Antwort ohne Tisch heisst hier nur "nichts Neues"; wer
         daraus auf "aufgeloest" schliesst, wirft einen Spieler bei jeder
         ueberholten Antwort aus seiner Runde. */
      /* Nur neu zeichnen, wenn sich wirklich etwas geaendert hat. Die
         Langabfrage kommt auch nach Zeitablauf zurueck; jedes Mal den ganzen
         Baum neu zu bauen kostet nichts an Rechenzeit, wohl aber den
         Mauszeiger: eine gerade vergroesserte Karte verliert ihr :hover, wenn
         das Element unter dem Zeiger ausgetauscht wird. */
      /* Tisch und Lobby zaehlen denselben Server-Zaehler hoch. Nur die Zahl
         zu vergleichen reicht deshalb nicht: der erste Tisch-Stand traegt oft
         genau die Nummer, die zuletzt fuer die Lobby gezeichnet wurde — dann
         bliebe die Uebersicht stehen, obwohl man schon am Tisch sitzt. */
      var jetztV = MP.tisch
        ? 't' + MP.tisch.id + ':' + (MP.tisch.v || 0)
        : 'l:' + ((MP.lobby && MP.lobby.v) || 0);
      if (jetztV !== gezeichnetV || !stage.firstChild) { gezeichnetV = jetztV; zeichne(); }
      schleife();
    }).catch(function (e) {
      if (!MP.an) return;
      /* Abgebrochen heisst: gerade ist etwas passiert, das sofort neu
         abgefragt werden soll. Ohne diesen Neustart bliebe die Schleife
         stehen und die Ansicht fror nach dem ersten eigenen Zug ein. */
      if (e && e.name === 'AbortError') { schleife(); return; }
      if (e && e.status === 404 && MP.tisch) {
        MP.tisch = null; MP.seit = 0;
        GK.toast('Der Tisch wurde aufgelöst', 'bad', '🃏');
        zeichne();
        schleife();
        return;
      }
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
    gezeichnetV = '';
    gesehen = {};
    ersterAufbau = true;
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
          : t.game === 'watten' ? t.bb + ' pro Punkt'
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

  /* Wie stark soll der Gegner sein? Die Beschreibungen sagen, was der Bot
     tatsaechlich anders macht — "leicht/mittel/schwer" allein hilft nicht
     beim Aussuchen. */
  var BOT_STUFEN = [
    { id: 'leicht', name: 'Anfänger', ic: '🙂',
      was: 'Geht fast alles mit, erhöht kaum und blufft nie. Wer solide spielt, nimmt ihm die Chips ab.' },
    { id: 'mittel', name: 'Solide', ic: '😐',
      was: 'Passt bei schwachen Blättern, erhöht mit guten und blufft selten. Ein normaler Gegner.' },
    { id: 'schwer', name: 'Hai', ic: '🦈',
      was: 'Rechnet die Pot Odds mit, steigt früh aus, setzt groß und blufft regelmäßig.' }
  ];

  function botFragen(t) {
    GK.sfx('click');
    var knoepfe = BOT_STUFEN.map(function (st) {
      var b = el('button', { class: 'mp-stufe' }, [
        el('span', { class: 'mp-stufe-ic', text: st.ic }),
        el('span', {}, [
          el('b', { text: st.name }),
          el('span', { class: 'mp-stufe-was', text: st.was })
        ])
      ]);
      b.addEventListener('click', function () {
        GK.closeModal();
        GK.sfx('chip');
        tue('action', { action: 'addbot', level: st.id });
      });
      return b;
    });
    GK.modal({
      title: 'Bot dazusetzen',
      text: 'Wie stark soll der Gegner spielen? Die Chips des Bots kommen aus der ' +
            'Bank — gegen ihn spielst du gegen das Haus, nicht gegen jemanden am Tisch.',
      nodes: [el('div', { class: 'mp-stufen' }, knoepfe)]
    });
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

  /* Dieselben Kartenbilder wie in den Einzelspielen — samt gewaehltem Deck.
     schluessel sagt, ob diese Karte an dieser Stelle neu ist; nur dann
     bekommt sie die Einwurf-Animation. */
  function karte(c, klein, schluessel) {
    var neu = false;
    if (schluessel) {
      var k = schluessel + '|' + (c ? c.r + c.s : 'back');
      neu = !gesehen[k];
      gesehen[k] = true;
      if (neu) neueKarten++;
    }
    return GK.cardEl(c || { r: 'A', s: '♠' }, !c,
      (klein ? 'mini' : '') + (neu ? ' frisch' : ''));
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
      /* Beim Muenzduell spielt man gegen echte Leute — dort kein Bot. */
      if (!meinPlatz() || t.game === 'coinflip') return null;
      var plus = el('button', { class: 'mp-sitz frei', title: 'Bot auf diesen Platz setzen' }, [
        el('span', { class: 'mp-plus', text: '+' }),
        el('span', { class: 'mp-frei-text', text: 'BOT DAZU' })
      ]);
      plus.addEventListener('click', function () { botFragen(t); });
      return plus;
    }
    var h = t.hand;
    var dran = h && h.turn === s.platz;
    var karten = el('div', { class: 'mp-karten' });
    var handNr = h ? h.nr : 0;
    if (s.cards) {
      s.cards.forEach(function (c, n) {
        karten.appendChild(karte(c, true, 's' + handNr + ':' + s.platz + ':' + n));
      });
    } else if (t.game === 'watten') {
      for (var n = 0; n < (s.anzahl || 0); n++) {
        karten.appendChild(karte(null, true, 's' + handNr + ':' + s.platz + ':' + n));
      }
    } else if (s.verdeckt) {
      karten.appendChild(karte(null, true, 's' + handNr + ':' + s.platz + ':0'));
      karten.appendChild(karte(null, true, 's' + handNr + ':' + s.platz + ':1'));
    }

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
        s.bot ? el('span', { class: 'mp-bot-tag', text: s.stufe || 'BOT',
                             title: 'Bot — Spielstärke ' + (s.stufe || '?') }) : null,
        t.game === 'watten' ? el('span', { class: 'mp-team t' + s.team, text: (s.team + 1) }) : null,
        t.dealer === s.platz ? el('span', { class: 'mp-knopf', text: 'D' }) : null,
        weg
      ].filter(Boolean)),
      karten,
      el('div', { class: 'mp-stack', text: GK.fmt(s.stack) + ' Chips' }),
      /* Was steht von diesem Spieler gerade im Pot? Der grosse Wert ist der
         Einsatz dieser Setzrunde — danach richtet sich, wer wieviel
         nachlegen muss. Darunter steht, was er in der ganzen Hand schon
         drin hat. */
      s.bet ? el('div', { class: 'mp-bet' }, [
        el('span', { class: 'mp-bet-ic', html: GK.iconHTML('chip') }),
        el('b', { text: GK.fmt(s.bet) }),
        h && s.gesamt > s.bet ? el('small', { text: 'ges. ' + GK.fmt(s.gesamt) }) : null
      ].filter(Boolean)) : null,
      s.allIn ? el('div', { class: 'mp-tag', text: 'ALL-IN' }) : null,
      s.folded ? el('div', { class: 'mp-tag raus', text: 'passt' }) : null,
      (!s.folded && !s.allIn && s.tag) ? el('div', { class: 'mp-tag zug', text: s.tag }) : null,
      gewinn ? el('div', { class: 'mp-tag win', text: '+' + GK.fmt(gewinn) }) : null,
      handName ? el('div', { class: 'mp-handname', text: handName.name }) : null
    ].filter(Boolean));
  }

  /**
   * Was liegt bei mir gerade an? Vor dem Flop die beiden Karten, danach die
   * beste Fuenf aus Hand und Tisch — dieselbe Anzeige wie im
   * Einzelspieler-Poker. Gerechnet wird mit demselben Modul wie auf dem
   * Server, sonst koennte hier etwas anderes stehen als ausgezahlt wird.
   */
  function handInfo(t) {
    var h = t.hand;
    var ich = meinPlatz();
    if (!h || !ich || !ich.cards || !ich.cards.length) return null;
    var text = h.board && h.board.length
      ? GK.holdem.bestHand(ich.cards.concat(h.board)).name
      : ich.cards.map(function (c) { return c.r + c.s; }).join(' ');
    return el('div', { class: 'mp-handinfo' + (ich.folded ? ' raus' : '') },
      [el('span', { text: 'Deine Hand: ' }), el('b', { text: text }),
       ich.folded ? el('span', { text: '  (raus)' }) : null].filter(Boolean));
  }

  function pokerAktionen(t) {
    var h = t.hand;
    var ich = meinPlatz();
    var box = el('div', { class: 'mp-aktionen' });
    var info = handInfo(t);
    if (info) box.appendChild(info);
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
      : el('button', { class: 'btn btn-gold', text: '✊ KLOPFEN',
                       title: 'Nichts setzen und weitergeben — geht nur, solange kein Einsatz offensteht' });
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

  /* ── Watten ───────────────────────────────────────────────────────── */

  var W_FARBEN = [
    { s: '♣', name: 'Eichel' }, { s: '♠', name: 'Gras' },
    { s: '♥', name: 'Herz' }, { s: '♦', name: 'Schellen' }
  ];
  var W_RANG = [
    { r: '7', name: 'Sieben' }, { r: '8', name: 'Acht' }, { r: '9', name: 'Neun' },
    { r: '10', name: 'Zehn' }, { r: 'J', name: 'Unter' }, { r: 'Q', name: 'Ober' },
    { r: 'K', name: 'König' }, { r: 'A', name: 'Sau' }
  ];
  function wName(liste, wert, feld) {
    var x = liste.filter(function (e) { return e[feld] === wert; })[0];
    return x ? x.name : wert;
  }

  function wattenMitte(t) {
    var h = t.hand;
    var mitte = el('div', { class: 'mp-mitte' });
    if (!h) {
      mitte.appendChild(el('div', { class: 'mp-pot', text: 'wartet auf vier Spieler' }));
      return mitte;
    }

    /* Der laufende Stich, sonst der letzte — sonst sieht man nie, womit der
       vorige Stich geholt wurde. */
    var zeige = h.stich.length ? h.stich : (h.letzterStich ? h.letzterStich.karten : []);
    var alt = !h.stich.length && h.letzterStich;
    var reihe = el('div', { class: 'mp-board' + (alt ? ' alt' : '') });
    zeige.forEach(function (x) {
      var k = karte(x.card, false, 'w' + h.nr + ':' + h.stichNr + ':' + x.platz);
      if (alt && h.letzterStich.sieger === x.platz) k.classList.add('sticht');
      var wer = t.seats[x.platz];
      reihe.appendChild(el('div', { class: 'mp-legekarte' }, [
        k, el('span', { class: 'mp-legename', text: wer ? wer.name : '' })
      ]));
    });
    if (!zeige.length) reihe.appendChild(el('span', { class: 'mp-warte', text: 'Es wird angesagt…' }));
    mitte.appendChild(reihe);

    var ansage = h.schlag
      ? 'Schlag ' + wName(W_RANG, h.schlag, 'r') +
        (h.trumpf ? '  ·  Trumpf ' + wName(W_FARBEN, h.trumpf, 's') + ' ' + h.trumpf : '')
      : 'Schlag und Trumpf werden noch angesagt';
    mitte.appendChild(el('div', { class: 'mp-pot', text: ansage }));
    mitte.appendChild(el('div', { class: 'mp-watt-stand' }, [
      el('span', { class: 'team1', text: 'Wir ' + h.gewonnen[h.meinTeam] }),
      el('span', { text: 'Stiche' }),
      el('span', { class: 'team2', text: h.gewonnen[1 - h.meinTeam] + ' Sie' }),
      el('span', { class: 'mp-watt-punkte', text: 'Es geht um ' + h.punkte +
        '  ·  Partie ' + h.stand[h.meinTeam] + ':' + h.stand[1 - h.meinTeam] })
    ]));
    return mitte;
  }

  function wattenAktionen(t) {
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
      box.appendChild(el('p', { class: 'mp-warte', text: 'Warte auf vier Spieler…' }));
      return box;
    }
    if (h.ergebnis) {
      box.appendChild(el('p', { class: 'mp-warte', text:
        (h.ergebnis.team === h.meinTeam ? 'Gewonnen' : 'Verloren') + ' — ' +
        h.ergebnis.punkte + (h.ergebnis.punkte === 1 ? ' Punkt' : ' Punkte') +
        (h.ergebnis.aufgegeben ? ' (aufgegeben)' : '') }));
      return box;
    }

    // Erhoehung beantworten
    if (h.antwortVon !== null && h.antwortVon === ich.platz) {
      var dabei = el('button', { class: 'btn btn-lime', text: '✋ DABEI (' + h.geboten + ')' });
      var aus = el('button', { class: 'btn btn-danger', text: '🏳️ AUS (' + h.punkte + ')' });
      dabei.addEventListener('click', function () { GK.sfx('chip'); tue('action', { action: 'dabei' }); });
      aus.addEventListener('click', function () { GK.sfx('card'); tue('action', { action: 'aus' }); });
      box.appendChild(el('p', { class: 'mp-warte', text:
        'Die Gegenseite geht auf ' + h.geboten + '. Mitgehen oder aussteigen?' }));
      box.appendChild(el('div', { class: 'mp-knoepfe zwei' }, [aus, dabei]));
      return box;
    }
    if (h.antwortVon !== null) {
      box.appendChild(el('p', { class: 'mp-warte', text: 'Erhöhung auf ' + h.geboten + ' — es wird geantwortet…' }));
      return box;
    }

    var dran = h.turn === ich.platz;

    if (h.phase === 'schlag') {
      if (!dran) { box.appendChild(el('p', { class: 'mp-warte', text: t.seats[h.turn].name + ' sagt den Schlag an…' })); return box; }
      box.appendChild(el('p', { class: 'mp-warte', text: 'Welchen Schlag sagst du an?' }));
      box.appendChild(el('div', { class: 'mp-wahl' }, W_RANG.map(function (r) {
        var b = el('button', { class: 'btn btn-ghost btn-small', text: r.name });
        b.addEventListener('click', function () { GK.sfx('chip'); tue('action', { action: 'schlag', schlag: r.r }); });
        return b;
      })));
      return box;
    }

    if (h.phase === 'trumpf') {
      if (!dran) { box.appendChild(el('p', { class: 'mp-warte', text: t.seats[h.turn].name + ' sagt den Trumpf an…' })); return box; }
      box.appendChild(el('p', { class: 'mp-warte', text: 'Welche Farbe wird Trumpf?' }));
      box.appendChild(el('div', { class: 'mp-wahl' }, W_FARBEN.map(function (f) {
        var b = el('button', { class: 'btn btn-ghost btn-small' + (f.s === '♥' || f.s === '♦' ? ' rot' : ''),
                               text: f.name + ' ' + f.s });
        b.addEventListener('click', function () { GK.sfx('chip'); tue('action', { action: 'trumpf', trumpf: f.s }); });
        return b;
      })));
      return box;
    }

    // eigene Karten
    var hand = el('div', { class: 'mp-hand' + (dran ? ' dran' : '') });
    (h.meineKarten || []).forEach(function (c, k) {
      var kk = karte(c, false, 'e' + h.nr + ':' + c.r + c.s);
      kk.classList.add('mp-handkarte');
      if (dran) {
        kk.addEventListener('click', function () { GK.sfx('card'); tue('action', { action: 'karte', karte: k }); });
      }
      hand.appendChild(kk);
    });
    box.appendChild(el('p', { class: 'mp-warte', text: dran
      ? 'Du bist dran — leg eine Karte'
      : (t.seats[h.turn] ? t.seats[h.turn].name + ' ist dran…' : 'Warte…') }));
    box.appendChild(hand);

    /* Gehen darf man auch, wenn man nicht am Zug ist — solange die eigene
       Seite nicht zuletzt erhoeht hat. */
    if (h.gehenVon !== h.meinTeam) {
      var gehen = el('button', { class: 'btn btn-gold btn-small', text: '⬆️ GEHEN (auf ' + (h.punkte + 1) + ')' });
      gehen.addEventListener('click', function () { GK.sfx('chip'); tue('action', { action: 'gehen' }); });
      box.appendChild(el('div', { class: 'mp-knoepfe eins' }, [gehen]));
    }
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
          : t.game === 'watten'
          ? t.bb + ' pro Punkt' + (h ? '  ·  Hand ' + h.nr : '')
          : 'Einsatz ' + t.bb + (h ? '  ·  Runde ' + h.nr : '') })
      ]),
      auf
    ]));

    if (t.game === 'watten') {
      wrap.appendChild(wattenMitte(t));
    } else if (t.game === 'poker') {
      var board = el('div', { class: 'mp-board' });
      var karten = (h && h.board) || [];
      for (var i = 0; i < 5; i++) {
        board.appendChild(karten[i]
          ? karte(karten[i], false, 'b' + (h ? h.nr : 0) + ':' + i)
          : el('div', { class: 'card slot' }));
      }
      wrap.appendChild(el('div', { class: 'mp-mitte oval' }, [
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

    wrap.appendChild(t.game === 'poker' ? pokerAktionen(t)
                   : t.game === 'watten' ? wattenAktionen(t)
                   : flipAktionen(t));

    if (h && h.deadline) {
      var rest = Math.max(0, Math.round((h.deadline - Date.now()) / 1000));
      wrap.appendChild(el('div', { class: 'mp-uhr', text: rest + ' s' }));
    }

    /* Kartenspiele bekommen dieselbe Deck-Auswahl wie die Einzelspiele. Die
       Wahl gilt geraeteweit und nur fuer die eigene Ansicht — die anderen am
       Tisch sehen weiter ihr eigenes Deck. */
    if (t.game === 'poker' || t.game === 'watten') {
      if (!deckWahl) deckWahl = GK.cardThemePicker().el;
      wrap.appendChild(el('div', { class: 'mp-deck' }, [deckWahl]));
    }

    wrap.appendChild(el('div', { class: 'mp-log' }, (t.log || []).map(function (z) {
      return el('div', { class: 'mp-log-zeile', text: z.text });
    })));

    return wrap;
  }

  /* ── Zeichnen ─────────────────────────────────────────────────────── */

  var uhrTimer = null;

  /** Ausgeteilt und aufgedeckt klingt wie im Einzelspieler-Poker. */
  function kartenKlang(anzahl) {
    if (!anzahl) return;
    /* Bei einem Showdown werden auf einen Schlag viele Karten sichtbar —
       fuenf Klaenge reichen, danach klingt es nur noch nach Rauschen. */
    var wieviel = Math.min(anzahl, 5);
    for (var i = 0; i < wieviel; i++) {
      setTimeout(function () { GK.sfx('card'); }, i * 110);
    }
  }

  function zeichne() {
    if (!stage || !MP.an) return;
    neueKarten = 0;
    stage.innerHTML = '';
    stage.appendChild(MP.tisch && MP.tisch.seats ? zeichneTisch() : zeichneLobby());

    if (ersterAufbau) ersterAufbau = false;
    else kartenKlang(neueKarten);

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
    var watten = [
      '<b>Bayerisch Watten</b> zu viert: Platz 1 und 3 gegen Platz 2 und 4.',
      'Jeder bekommt fünf Karten. Die <b>Vorhand</b> sagt den <b>Schlag</b> (den Rang) an, der <b>Geber</b> die <b>Trumpffarbe</b>.',
      'Von oben: <b>Max</b> (Herz-König), <b>Belli</b> (Schellen-Sieben), <b>Spitz</b> (Eichel-Sieben) — dann der <b>Rechte</b> (Schlag in der Trumpffarbe), dann die übrigen <b>Schläge</b>, dann der Rest vom Trumpf.',
      'Alle anderen Schläge sind gleich stark: die <b>zuerst gelegte</b> schlägt die späteren.',
      '<b>Kein Farbzwang</b> — du darfst immer legen, was du willst.',
      'Wer <b>drei von fünf</b> Stichen holt, gewinnt die Hand.',
      'Eine Hand ist <b>2 Punkte</b> wert. Mit <b>Gehen</b> erhöhst du; die Gegenseite geht <b>mit</b> oder <b>aus</b> und zahlt dann den bisherigen Wert.',
      'Jeder Punkt kostet die Verlierer den Tischeinsatz — das Geld geht direkt an die andere Mannschaft.',
      'Die deutschen Farben liegen auf dem gewohnten Blatt: <b>Eichel ♣ · Gras ♠ · Herz ♥ · Schellen ♦</b>, und <b>Unter = Bube, Ober = Dame, Sau = Ass</b>.'
    ];
    var poker = [
      '<b>Texas Hold\'em</b> gegen echte Leute: zwei eigene Karten, fünf offene in der Mitte.',
      '<b>Klopfen</b> heißt: nichts setzen und an den Nächsten weitergeben. Das geht nur, solange kein Einsatz offensteht — sonst musst du mitgehen, erhöhen oder passen. Am echten Tisch klopft man dafür kurz auf die Platte.',
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
    var welche = !t ? poker.concat(watten, flip)
      : t.game === 'coinflip' ? flip
      : t.game === 'watten' ? watten
      : poker;
    var titel = !t ? 'Multiplayer'
      : t.game === 'coinflip' ? 'Münzduell'
      : t.game === 'watten' ? 'Watten'
      : 'Königs-Poker';
    GK.modal({
      title: titel,
      nodes: [el('ul', { class: 'rules' }, welche.map(function (r) { return el('li', { html: r }); }))]
    });
  };
})(window.GK);
