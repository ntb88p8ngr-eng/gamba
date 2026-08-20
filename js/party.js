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
        action: 'partystand', chips: kk.chips,
        runden: kk.runden, besterWin: kk.besterWin
      }).catch(function () {});
    }, 900);
  }

  /** Ein Grossgewinn — der geht sofort raus, damit ihn alle mitbekommen. */
  function meldeGewinn(gewinn, spiel) {
    var k = GK.partyKasse();
    if (!Party.an || !k) return;
    ruf('action', {
      action: 'partystand', chips: k.chips, runden: k.runden,
      besterWin: k.besterWin, win: gewinn, spiel: spiel || ''
    }).catch(function () {});
  }

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
  function starten(d) {
    if (Party.an) return;
    Party.an = true;
    GK.partyKasse(d.startChips);
    document.body.classList.add('party-an');
    GK.emit('party-start', d);
    GK.sfx('jackpot');
    GK.toast('Party läuft! ' + GK.fmt(d.startChips) + ' Chips für alle', 'gold', '🎉');
    melden();
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

    var k = GK.partyKasse();
    var gewinn = k ? k.chips - k.start : 0;
    GK.partyKasse(null);
    document.body.classList.remove('party-an');
    tafelWeg();
    GK.emit('party-ende', d);
    GK.updateHUD();
    if (d) ergebnisZeigen(d, gewinn);
  }

  /** Nach der Party: wer hat gewonnen? */
  function ergebnisZeigen(d, meinGewinn) {
    var reihen = (d.spieler || []).map(function (s, i) {
      return el('div', { class: 'party-erg' + (s.ich ? ' ich' : '') }, [
        el('span', { class: 'party-erg-platz', text: (i + 1) + '.' }),
        el('span', { class: 'party-erg-av', text: s.avatar || '👤' }),
        el('span', { class: 'party-erg-name', text: s.name }),
        el('span', { class: 'party-erg-gewinn' + (s.gewinn >= 0 ? ' plus' : ' minus'),
                     text: GK.fmtSigned(s.gewinn) })
      ]);
    });
    var sieger = (d.spieler || [])[0];
    GK.modal({
      icon: 'party',
      title: 'Party vorbei',
      text: sieger
        ? sieger.name + ' macht den dicksten Gewinn: ' + GK.fmtSigned(sieger.gewinn) + ' Chips. ' +
          'Dein Ergebnis: ' + GK.fmtSigned(meinGewinn) + '. Auf dein Konto wirkt sich das nicht aus.'
        : 'Die Party ist vorbei.',
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
      GK.modal({
        emoji: '🚪',
        title: 'Party verlassen?',
        text: 'Deine Partychips verfallen — sie gehören zur Party, nicht zum Konto. ' +
              'Dein Kontostand bleibt so, wie er vor der Party war.',
        nodes: [ja]
      });
    });

    tafel = el('aside', { class: 'party-tafel', id: 'party-tafel' }, [
      el('div', { class: 'party-tafel-kopf' }, [
        el('span', { class: 'party-tafel-titel',
                     html: GK.iconHTML('partychip', 'party-ic') + '<span>PARTY</span>' }),
        el('span', { class: 'party-uhr', id: 'party-uhr', text: '' }),
        raus
      ]),
      el('div', { class: 'party-rang', id: 'party-rang' }),
      el('div', { class: 'party-meldungen', id: 'party-meldungen' })
    ]);
    document.body.appendChild(tafel);
    /* Auf dem Handy nimmt die Tafel sonst das halbe Spiel weg — dort laesst
       sie sich mit einem Tippen auf den Kopf zusammenklappen. */
    tafel.querySelector('.party-tafel-kopf').addEventListener('click', function () {
      tafel.classList.toggle('klein');
      GK.sfx('click');
    });
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
    var rang = document.getElementById('party-rang');
    if (!rang) return;
    rang.innerHTML = '';
    (d.spieler || []).forEach(function (s, i) {
      rang.appendChild(el('div', { class: 'party-zeile' + (s.ich ? ' ich' : '') + (i === 0 ? ' erster' : '') }, [
        el('span', { class: 'party-platz', text: String(i + 1) }),
        el('span', { class: 'party-av', text: s.avatar || '👤' }),
        el('span', { class: 'party-name', text: s.name }),
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
  Party.verlassen = function () {
    if (!Party.id) return;
    beenden(null);
    Party.daten = null;
    Party.id = null;
    /* Auch die Mehrspieler-Ansicht muss die Party loslassen — sonst fragt die
       Langabfrage weiter nach einem Tisch, an dem man gar nicht mehr sitzt. */
    if (GK.mp) { GK.mp.tisch = null; GK.mp.seit = 0; }
    ruf('leave', {}).catch(function () {});
    GK.toast('Party verlassen — dein Konto ist unverändert', '', '🚪');
  };

})(window.GK);
