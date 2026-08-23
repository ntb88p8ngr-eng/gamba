/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Partymodus

   Bis zu acht Leute spielen gleichzeitig dieselben Einzelspiele, mit
   demselben Startguthaben und derselben Uhr. Verglichen wird der Gewinn.

   Der Unterschied zu einem Pokertisch: hier haengt niemand am Zug eines
   anderen. Jeder spielt fuer sich, der Server haelt nur zusammen, was alle
   gemeinsam haben — Einstellungen, Startzeit, Rangliste. Deshalb liegt die
   Party neben den Tischen und nicht in ihnen.

   Die Chips einer Party kommen nicht vom Konto. GK.partyKasse schaltet
   wager/payout auf eine eigene Kasse um; das Konto ruht so lange. Sonst
   wuerde ein Partygewinn den echten Kontostand aufblasen, und die Runde
   waere nicht mehr fuer alle gleich.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var el = GK.el;
  var Party = GK.party = {
    an: false,        // laeuft gerade eine Party fuer mich?
    daten: null,      // letzte Ansicht vom Server
    id: null
  };

  /* So gross muss ein Gewinn sein, damit ihn alle gemeldet bekommen:
     das Zehnfache des Einsatzes oder ein Zehntel des Startguthabens. Ohne
     Schwelle stuende im Leaderboard eine Dauerschleife aus Kleingewinnen. */
  function istGross(gewinn, einsatz, start) {
    if (gewinn <= 0) return false;
    return gewinn >= Math.max(einsatz * 10, Math.floor(start / 10), 50);
  }

  /* Eine Meldung bleibt so lange stehen — deutlich laenger als ein Toast,
     damit sie auch sieht, wer gerade auf sein eigenes Spiel schaut. */
  var MELDUNG_MS = 12000;

  /* ── Server ───────────────────────────────────────────────────────── */

  function ruf(pfad, daten) {
    return GK.mp._ruf(pfad, daten);
  }

  /**
   * Eigenen Stand melden.
   *
   * Gedrosselt: bei Endlosdrehs in den Walzen kaeme sonst mehrmals je
   * Sekunde eine Anfrage, und die Rangliste braucht das nicht so genau.
   * Ein Grossgewinn geht daran vorbei und sofort raus (meldeGewinn).
   */
  var meldeTimer = null;
  function melden() {
    var k = GK.partyKasse();
    if (!Party.an || !k || !Party.id || meldeTimer) return;
    meldeTimer = setTimeout(function () {
      meldeTimer = null;
      var kk = GK.partyKasse();
      if (!Party.an || !kk) return;
      ruf('action', {
        action: 'partystand', chips: kk.chips, nachschub: kk.nachschub,
        runden: kk.runden, besterWin: kk.besterWin
      }).catch(function () {});
    }, 900);
  }

  /** Ein Grossgewinn — der geht sofort raus, damit ihn alle mitbekommen. */
  function meldeGewinn(gewinn, spiel) {
    var k = GK.partyKasse();
    if (!Party.an || !k) return;
    ruf('action', {
      action: 'partystand', chips: k.chips, nachschub: k.nachschub,
      runden: k.runden, besterWin: k.besterWin, win: gewinn, spiel: spiel || ''
    }).catch(function () {});
  }

  /* Nachschub geht sofort raus: der Stand hat sich sprunghaft geaendert,
     und der Abzug vom Gewinn soll nicht eine Runde lang fehlen. */
  GK.on('party-nachschub', function () {
    var k = GK.partyKasse();
    if (!Party.an || !k) return;
    ruf('action', {
      action: 'partystand', chips: k.chips, nachschub: k.nachschub,
      runden: k.runden, besterWin: k.besterWin
    }).catch(function () {});
  });

  GK.on('party-runde', function (r) {
    var k = GK.partyKasse();
    if (!Party.an || !k) return;
    if (istGross(r.gewinn, r.einsatz, k.start)) {
      meldeGewinn(r.gewinn, GK.currentGame || '');
    } else {
      melden();
    }
  });

  /* ── Umschalten zwischen Casino und Party ─────────────────────────── */

  /**
   * Die Party uebernimmt die gewohnte Spielhalle: dieselben Kacheln,
   * dieselben Spiele, nur mit anderer Kasse, anderer Kulisse und der
   * Rangliste oben links. Ein eigener Nachbau waere neunzehn Spiele
   * doppelt — und jede spaetere Aenderung zweimal.
   */
  /* Ein Turnierduell laeuft ueber dieselbe Mechanik wie eine Party — der
     Server schickt dieselben Felder. Die Zeremonie drumherum passt aber
     nicht: eine Runde endet hier alle paar Minuten, und dann jedes Mal
     „Party vorbei" samt Rangliste einzublenden waere falsch. Den Ausgang
     zeigt der Turnierbaum. */
  function istTurnier(d) { return !!(d && d.art === 'turnier'); }

  function starten(d) {
    if (Party.an) return;
    Party.an = true;
    GK.partyKasse(d.startChips, d.nachschub);
    document.body.classList.add('party-an');
    GK.emit('party-start', d);
    GK.sfx('jackpot');
    if (istTurnier(d)) {
      GK.toast('Duell läuft! ' + GK.fmt(d.startChips) + ' Chips — mehr als der Gegner!',
               'gold', '🏆');
    } else {
      GK.toast('Party läuft! ' + GK.fmt(d.startChips) + ' Chips für alle', 'gold', '🎉');
    }
    melden();
  }

  /**
   * Schlussstand sofort melden — ohne die übliche Drosselung.
   *
   * Bei einer Buy-in-Party hängt daran echtes Geld: der Server zahlt nach
   * dem Abpfiff das aus, was zuletzt gemeldet wurde, und wartet dafür ein
   * paar Sekunden. Diese Meldung ist die letzte Gelegenheit.
   */
  var letzteMeldung = Promise.resolve();
  function schlussMelden() {
    var k = GK.partyKasse();
    if (!Party.id || !k) return Promise.resolve();
    letzteMeldung = ruf('action', {
      action: 'partystand', chips: k.chips, nachschub: k.nachschub,
      runden: k.runden, besterWin: k.besterWin
    }).catch(function () {});
    return letzteMeldung;
  }

  /** Nach der Abrechnung steht ein neuer Kontostand auf dem Server. */
  function kontoNachziehen(nachMs) {
    setTimeout(function () {
      if (!GK.net || !GK.net.pull) return;
      GK.net.pull().then(function () { GK.updateHUD(); });
    }, nachMs);
  }

  function beenden(d) {
    if (!Party.an) return;
    Party.an = false;

    /* Zuerst das laufende Spiel schliessen — und zwar solange die Party-Kasse
       noch steht.
       Wer beim Zeitablauf mitten in einer Runde sitzt, hat einen offenen
       Einsatz aus Partychips. Wird die Kasse vorher abgeraeumt, bleibt die
       Runde offen und loest sich spaeter im normalen Casino auf: dann faellt
       ein Partygewinn aufs echte Konto. Bei der Rakete war das gut zu sehen,
       weil sie nach dem Ende einfach weiterflog. */
    GK.emit('party-schliessen');
    schlussMelden();

    var gewinn = GK.partyGewinn();
    GK.partyKasse(null);
    document.body.classList.remove('party-an');
    tafelWeg();
    GK.emit('party-ende', d);
    GK.updateHUD();
    /* Buy-in: der Server rechnet erst ein paar Sekunden nach dem Abpfiff ab —
       vorher stünden im Ergebnis noch die Zwischenstände. Also warten wir auf
       die abgerechnete Ansicht und holen dann auch den Kontostand nach. */
    if (istTurnier(d)) {
      /* Beim Turnier sagt der Baum, wie es ausging — und die naechste Runde
         kommt gleich. Ein Fenster dazwischen stuende nur im Weg. */
      GK.toast('Runde vorbei — dein Stand: ' + GK.fmt((d.startChips || 0) + gewinn),
               '', '🏁');
      return;
    }
    if (d && d.eigeneChips) {
      wartetErgebnis = { gewinn: gewinn, ersatz: d };
      kontoNachziehen(3400);
      setTimeout(ergebnisNachreichen, 7000);
    } else if (d) {
      ergebnisZeigen(d, gewinn);
    }
  }

  /* Solange die Abrechnung läuft, wartet das Ergebnisfenster hier. */
  var wartetErgebnis = null;

  /** Ergebnis zeigen, sobald abgerechnet ist — spätestens nach der Frist. */
  function ergebnisNachreichen(d) {
    if (!wartetErgebnis) return;
    var w = wartetErgebnis;
    wartetErgebnis = null;
    ergebnisZeigen(d || Party.daten || w.ersatz, w.gewinn);
  }

  /** Nach der Party: wer hat gewonnen? */
  function ergebnisZeigen(d, meinGewinn) {
    var kauf = !!d.eigeneChips;
    var start = d.startChips || 0;
    var leute = d.spieler || [];
    /* Bei Buy-in gilt die Partyregel: der Erste bekommt seinen Stand plus die
       Gewinne aller anderen, wer sonst im Plus ist, holt nur seinen Einsatz
       heraus, und ein Minus bleibt, wo es entstanden ist. Der Server rechnet
       genauso — hier wird nur dasselbe angezeigt. */
    function ausZahlung(s, platz) {
      if (!kauf) return null;
      if (s.ausgezahlt) return s.ausgezahlt;
      if (platz === 0) {
        var topf = d.topf || 0;
        leute.forEach(function (x, i) { if (i > 0) topf += Math.max(0, x.gewinn); });
        return Math.max(0, start + s.gewinn) + topf;
      }
      return Math.min(start + s.gewinn, start);
    }

    var reihen = leute.map(function (s, i) {
      var raus = ausZahlung(s, i);
      return el('div', { class: 'party-erg' + (s.ich ? ' ich' : '') }, [
        el('span', { class: 'party-erg-platz', text: (i + 1) + '.' }),
        el('span', { class: 'party-erg-av', text: s.avatar || '👤' }),
        el('span', { class: 'party-erg-name', text: s.name }),
        s.nachschub ? el('span', { class: 'party-gabe', title: 'Nachschub: ' +
                                   GK.fmt(s.nachschub) + ' Chips', text: '🎁' }) : null,
        kauf ? el('span', { class: 'party-erg-aus', title: 'Geht aufs Konto',
                            text: '→ ' + GK.fmt(raus) }) : null,
        el('span', { class: 'party-erg-gewinn' + (s.gewinn >= 0 ? ' plus' : ' minus'),
                     text: GK.fmtSigned(s.gewinn) })
      ]);
    });
    var sieger = leute[0];
    var ich = null;
    leute.forEach(function (s, i) { if (s.ich) ich = { s: s, i: i }; });
    var meins = ich ? ausZahlung(ich.s, ich.i) : 0;
    GK.modal({
      icon: 'party',
      title: 'Party vorbei',
      text: !sieger ? 'Die Party ist vorbei.'
        : sieger.name + ' macht den dicksten Gewinn: ' + GK.fmtSigned(sieger.gewinn) + ' Chips. ' +
          'Dein Ergebnis: ' + GK.fmtSigned(meinGewinn) + '. ' +
          (kauf
            ? 'Auf dein Konto gehen ' + GK.fmt(meins) + ' Chips zurück — ' +
              (ich && ich.i === 0
                ? 'als Sieger nimmst du die Gewinne aller mit.'
                : 'die Gewinne der anderen holt sich der Sieger.')
            : 'Auf dein Konto wirkt sich das nicht aus.'),
      nodes: [el('div', { class: 'party-ergebnis' }, reihen)]
    });
    GK.sfx(meinGewinn > 0 ? 'jackpot' : 'click');
  }

  /* ── Die Rangliste oben links ─────────────────────────────────────── */

  var tafel = null;
  var gezeigt = {};      // schon angezeigte Meldungen, damit keine zweimal kommt

  function tafelAufbauen() {
    if (tafel) return tafel;
    /* Aussteigen muss auch mitten aus einem Spiel heraus gehen — sonst
       müsste man erst die Multiplayer-Seite suchen. */
    var raus = el('button', { class: 'party-raus', title: 'Party verlassen', text: '✕' });
    raus.addEventListener('click', function (ev) {
      ev.stopPropagation();
      GK.sfx('click');
      var ja = el('button', { class: 'btn btn-danger btn-full', text: '🚪 JA, RAUS' });
      ja.addEventListener('click', function () { GK.closeModal(); Party.verlassen(); });
      var d = Party.daten || {};
      GK.modal({
        emoji: '🚪',
        title: 'Party verlassen?',
        text: d.eigeneChips
          ? 'Du nimmst höchstens deinen Einsatz mit. Was du darüber hinaus ' +
            'gewonnen hast, bleibt liegen und geht an den Sieger der Party.'
          : 'Deine Partychips verfallen — sie gehören zur Party, nicht zum Konto. ' +
            'Dein Kontostand bleibt so, wie er vor der Party war.',
        nodes: [ja]
      });
    });

    tafel = el('aside', { class: 'party-tafel', id: 'party-tafel' }, [
      el('div', { class: 'party-tafel-kopf' }, [
        /* Im Turnier steht dort „DUELL": es sitzen nur zwei am Brett, und
           „Party" waere das falsche Wort fuer einen K.-o.-Kampf. */
        el('span', { class: 'party-tafel-titel', id: 'party-tafel-titel',
                     html: GK.iconHTML('partychip', 'party-ic') + '<span>PARTY</span>' }),
        el('span', { class: 'party-uhr', id: 'party-uhr', text: '' }),
        raus
      ]),
      el('div', { class: 'party-rang', id: 'party-rang' }),
      el('div', { class: 'party-meldungen', id: 'party-meldungen' })
    ]);
    document.body.appendChild(tafel);

    var kopf = tafel.querySelector('.party-tafel-kopf');

    /* ── Verschieben ──
       Die Tafel liegt fest über dem Spielfeld und deckt je nach Spiel etwas
       Wichtiges zu. Am Kopf lässt sie sich deshalb an jede Stelle ziehen —
       mit der Maus wie mit dem Finger. Die Stelle merkt sich das Gerät.

       Ziehen und Zusammenklappen teilen sich denselben Griff: als Klick
       zählt nur, was sich um weniger als ein paar Pixel bewegt hat. Sonst
       klappte die Tafel bei jedem Verschieben zu. */
    var zieht = false, packte = null, bewegt = 0;

    function stelleMerken() {
      try {
        localStorage.setItem('gambaking:party-tafel',
          JSON.stringify({ x: tafel.offsetLeft, y: tafel.offsetTop }));
      } catch (e) {}
    }
    function stelleHolen() {
      try {
        var d = JSON.parse(localStorage.getItem('gambaking:party-tafel') || 'null');
        if (d && typeof d.x === 'number') setzen(d.x, d.y);
      } catch (e) {}
    }
    function setzen(x, y) {
      /* Nie ganz aus dem Bild schieben lassen — sonst ist die Tafel weg und
         kommt ohne Zurücksetzen nicht wieder. */
      var b = tafel.getBoundingClientRect();
      x = Math.max(4, Math.min(window.innerWidth - Math.min(b.width, 120) - 4, x));
      y = Math.max(4, Math.min(window.innerHeight - 44, y));
      tafel.style.left = x + 'px';
      tafel.style.top = y + 'px';
      tafel.style.right = 'auto';
    }

    kopf.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.party-raus')) return;
      zieht = true; bewegt = 0;
      var b = tafel.getBoundingClientRect();
      packte = { dx: ev.clientX - b.left, dy: ev.clientY - b.top, x0: ev.clientX, y0: ev.clientY };
      kopf.setPointerCapture && kopf.setPointerCapture(ev.pointerId);
      tafel.classList.add('zieht');
      ev.preventDefault();
    });
    kopf.addEventListener('pointermove', function (ev) {
      if (!zieht || !packte) return;
      bewegt = Math.max(bewegt, Math.abs(ev.clientX - packte.x0) + Math.abs(ev.clientY - packte.y0));
      setzen(ev.clientX - packte.dx, ev.clientY - packte.dy);
    });
    ['pointerup', 'pointercancel'].forEach(function (n) {
      kopf.addEventListener(n, function () {
        if (!zieht) return;
        zieht = false;
        tafel.classList.remove('zieht');
        if (bewegt < 6) {
          /* Kein Ziehen, sondern ein Tipp: zusammenklappen. Auf dem Handy
             nimmt die Tafel sonst das halbe Spiel weg. */
          tafel.classList.toggle('klein');
          GK.sfx('click');
        } else {
          stelleMerken();
        }
      });
    });
    window.addEventListener('resize', function () {
      if (tafel) setzen(tafel.offsetLeft, tafel.offsetTop);
    });
    stelleHolen();
    return tafel;
  }

  function tafelWeg() {
    if (tafel && tafel.parentNode) tafel.parentNode.removeChild(tafel);
    tafel = null;
    gezeigt = {};
    offene = [];
  }

  function tafelZeichnen(d) {
    tafelAufbauen();
    var titel = document.getElementById('party-tafel-titel');
    var wort = titel && titel.querySelector('span:last-child');
    if (wort) {
      var soll = istTurnier(d) ? 'DUELL' : 'PARTY';
      if (wort.textContent !== soll) wort.textContent = soll;
    }
    var rang = document.getElementById('party-rang');
    if (!rang) return;
    rang.innerHTML = '';
    (d.spieler || []).forEach(function (s, i) {
      rang.appendChild(el('div', { class: 'party-zeile' + (s.ich ? ' ich' : '') + (i === 0 ? ' erster' : '') }, [
        el('span', { class: 'party-platz', text: String(i + 1) }),
        el('span', { class: 'party-av', text: s.avatar || '👤' }),
        el('span', { class: 'party-name', text: s.name }),
        /* Ein Geschenk hinter dem Namen: sonst wundert sich, wer viele Chips
           vor sich liegen sieht und trotzdem hinten steht. */
        s.nachschub ? el('span', { class: 'party-gabe', title: 'Nachschub: ' +
                                   GK.fmt(s.nachschub) + ' Chips', text: '🎁' }) : null,
        el('span', { class: 'party-gewinn' + (s.gewinn >= 0 ? ' plus' : ' minus'),
                     text: GK.fmtSigned(s.gewinn) })
      ]));
    });
    uhrStellen(d);
    meldungenSammeln(d);
    meldungenZeichnen();
  }

  function uhrStellen(d) {
    var u = document.getElementById('party-uhr');
    if (!u) return;
    var rest = Math.max(0, Math.round((d.endeAt - Date.now()) / 1000));
    var m = Math.floor(rest / 60), s = rest % 60;
    u.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    u.classList.toggle('knapp', rest <= 30);
  }

  /**
   * Grossgewinne der anderen.
   *
   * Sie stehen laenger als ein Toast — wer gerade auf seine eigene Walze
   * schaut, soll trotzdem mitbekommen, dass nebenan jemand abgeraeumt hat.
   *
   * Gehalten werden sie in einer eigenen Liste und nicht nur im Baum: die
   * Tafel wird bei jeder Serverantwort neu gezeichnet, und eine Meldung, die
   * nur dort haengt, ist beim naechsten Durchlauf weg. Genau das ist beim
   * Pruefen passiert — nach fuenf Sekunden war nichts mehr zu sehen.
   */
  var offene = [];

  function meldungenSammeln(d) {
    (d.meldungen || []).slice().reverse().forEach(function (m) {
      var schluessel = m.id + ':' + m.at;
      if (gezeigt[schluessel]) return;
      gezeigt[schluessel] = true;
      /* Beim Betreten liegen alte Meldungen schon da — die nicht nachspielen. */
      if (Date.now() - m.at > MELDUNG_MS) return;
      m.bis = Date.now() + MELDUNG_MS;
      m.eigen = !!(GK.player() && GK.player().id === m.id);
      offene.push(m);
      if (!m.eigen) GK.sfx('coin');
    });
  }

  /**
   * Nur anbauen und abraeumen, nie neu bauen.
   *
   * Der erste Anlauf hat den Kasten bei jedem Durchlauf geleert und neu
   * gefuellt — halbsekuendlich. Damit begann die Einblend-Animation jedes Mal
   * von vorn, und die Meldung stand die meiste Zeit bei Deckkraft null: im
   * Baum war sie da, zu sehen war sie nicht.
   */
  function meldungenZeichnen() {
    var kasten = document.getElementById('party-meldungen');
    if (!kasten) return;
    var jetzt = Date.now();
    offene.forEach(function (m) {
      if (!m.el) {
        m.el = el('div', { class: 'party-meldung' + (m.eigen ? ' eigen' : '') }, [
          el('span', { class: 'party-m-av', text: m.avatar || '👤' }),
          el('span', { class: 'party-m-text' }, [
            el('b', { text: m.eigen ? 'Du' : m.name }),
            el('span', { text: ' + ' + GK.fmt(m.betrag) })
          ])
        ]);
        kasten.appendChild(m.el);
      } else if (!m.el.parentNode) {
        kasten.appendChild(m.el);          // Tafel war zwischendurch weg
      }
      if (m.bis - jetzt < 700) m.el.classList.add('weg');
    });
    offene = offene.filter(function (m) {
      if (m.bis > jetzt) return true;
      if (m.el && m.el.parentNode) m.el.parentNode.removeChild(m.el);
      return false;
    });
  }

  /* Die Uhr laeuft auch ohne neue Serverantwort weiter. */
  setInterval(function () {
    if (!Party.an || !Party.daten) return;
    uhrStellen(Party.daten);
    /* Auch ohne neue Serverantwort muessen abgelaufene Meldungen verschwinden. */
    meldungenZeichnen();
  }, 500);

  /* ── Was der Rest der Anwendung braucht ───────────────────────────── */

  /** Neue Ansicht vom Server — kommt aus der Langabfrage in js/mp.js. */
  Party.stand = function (d) {
    Party.daten = d;
    Party.id = d ? d.id : null;
    if (!d) { beenden(null); return; }
    if (d.status === 'laeuft' && !Party.an) starten(d);
    if (d.status !== 'laeuft' && Party.an) beenden(d);
    if (Party.an) tafelZeichnen(d);
    /* Die abgerechnete Ansicht ist da (jemand hat eine Auszahlung stehen) —
       jetzt kann das Ergebnis mit echten Zahlen aufgehen. */
    if (wartetErgebnis && d.status === 'ende' &&
        (d.spieler || []).some(function (s) { return s.ausgezahlt; })) {
      ergebnisNachreichen(d);
    }
  };

  /** Welche Spiele sind in dieser Party erlaubt? Leer = alle. */
  Party.spiele = function () {
    var d = Party.daten;
    return d && d.spiele && d.spiele.length ? d.spiele : null;
  };

  Party.erlaubt = function (id) {
    var s = Party.spiele();
    return !s || s.indexOf(id) >= 0;
  };

  /**
   * Gilt in dieser Party die Stufensperre?
   *
   * Standardmaessig nicht: in einer Party mit acht Leuten hat jeder einen
   * anderen Stand, und der Gastgeber kann nicht wissen, wer welches Spiel
   * schon freigespielt hat. Ohne diese Ausnahme saesse die Haelfte vor
   * verschlossenen Kacheln. Wer will, kann sie in den Einstellungen wieder
   * einschalten — dann zaehlt die eigene Stufe wie sonst auch.
   */
  Party.alleFrei = function () {
    return !!(Party.daten && Party.daten.alleFrei);
  };

  /** Party ganz verlassen (auch aus dem Spielbetrieb heraus). */
  /**
   * Die Party ist von aussen weggefallen — hier nur noch aufräumen.
   *
   * Anders als `verlassen` wird dabei nichts an den Server gemeldet: die
   * Party gibt es dort nicht mehr, und abgerechnet hat er beim Auflösen
   * selbst. Auch keine eigene Meldung — den Grund sagt schon der, der das
   * Wegfallen bemerkt hat.
   */
  Party.aufraeumen = function () {
    if (!Party.id) return;
    var kauf = !!(Party.daten && Party.daten.eigeneChips);
    beenden(null);
    Party.daten = null;
    Party.id = null;
    if (GK.mp) { GK.mp.tisch = null; GK.mp.seit = 0; }
    /* Bei Buy-in hat der Server gerade zurückgezahlt — den neuen Stand
       holen, sonst steht in der Kopfzeile weiter die alte Zahl. */
    if (kauf) kontoNachziehen(900);
  };

  Party.verlassen = function () {
    if (!Party.id) return;
    var kauf = !!(Party.daten && Party.daten.eigeneChips);
    beenden(null);
    Party.daten = null;
    Party.id = null;
    /* Auch die Mehrspieler-Ansicht muss die Party loslassen — sonst fragt die
       Langabfrage weiter nach einem Tisch, an dem man gar nicht mehr sitzt. */
    if (GK.mp) { GK.mp.tisch = null; GK.mp.seit = 0; }
    /* Erst der Schlussstand, dann das Verlassen: der Server zahlt beim
       Verlassen sofort aus und soll dabei den aktuellen Stand kennen. */
    letzteMeldung.then(function () { return ruf('leave', {}); }).catch(function () {});
    if (kauf) {
      kontoNachziehen(900);
      GK.toast('Party verlassen — dein Einsatz kommt zurück aufs Konto', '', '🚪');
    } else {
      GK.toast('Party verlassen — dein Konto ist unverändert', '', '🚪');
    }
  };

})(window.GK);
