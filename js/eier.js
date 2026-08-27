/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Ostereier

   Was ein Aktionscode freischalten kann, ohne dass es Chips oder XP
   sind: ein versteckter Sender, eine Animation, eine Kleinigkeit, die
   sonst niemand sieht.

   Freigeschaltet wird auf dem Server (siehe die Operation `code` in
   server.js) — dort haengt die Kennung am Konto und ueberlebt jeden
   Neustart. Hier steht nur, was sie bewirkt.

   Neues Osterei anlegen: Kennung in OSTEREIER in server.js eintragen
   (sonst laesst sich kein Code dafuer bauen) und hier einen Eintrag in
   EIER dazu. Mehr braucht es nicht.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  /* Ob der Rauch gerade zieht, gehoert zum Geraet: wer ihn stoerend
     findet, schaltet ihn aus, ohne das Osterei zu verlieren. */
  var RAUCH_KEY = 'gambaking:rauch';

  var EIER = {
    '420': {
      name: 'Reggae & Rauch',
      emoji: '🌿',
      was: 'Ein versteckter Sender und Rauch über dem Bildschirm.',
      /* Der Sender taucht in der Musikauswahl auf, sobald das Ei da ist.
         Er sieht aus wie ein Webradio aus dem Panel und wird auch genauso
         behandelt — nur dass ihn nicht der Admin angelegt hat. */
      sender: {
        id: 'ei-reggae',
        name: 'Ganja FM',
        was: 'Heavyweight Reggae, rund um die Uhr',
        icon: '🌿',
        url: 'https://ice6.somafm.com/reggae-128-mp3',
        volume: 1
      }
    }
  };

  /** Hat dieser Spieler das Ei? */
  function hat(id) {
    var p = GK.player && GK.player();
    var liste = (p && p.eier) || [];
    return liste.indexOf(id) >= 0;
  }
  GK.hatOsterei = hat;

  /** Alle freigeschalteten Eier, als Einträge. */
  GK.eierListe = function () {
    var p = GK.player && GK.player();
    return ((p && p.eier) || []).map(function (k) {
      var e = EIER[k];
      return e ? { id: k, name: e.name, emoji: e.emoji, was: e.was } : null;
    }).filter(Boolean);
  };

  /**
   * Versteckte Sender, die ein Osterei mitbringt.
   *
   * js/music.js haengt sie an die Senderliste an. Wer das Ei nicht hat,
   * bekommt eine leere Liste und merkt von dem Sender nichts — auch nicht
   * in der Auswahl.
   */
  GK.eierSender = function () {
    var raus = [];
    Object.keys(EIER).forEach(function (k) {
      if (EIER[k].sender && hat(k)) {
        raus.push(Object.assign({ web: true, ei: k }, EIER[k].sender));
      }
    });
    return raus;
  };

  /* ── Rauch ────────────────────────────────────────────────────────
     Drei Schwaden, die langsam durchs Bild ziehen, jede mit eigenem
     Takt. Sie liegen ueber dem Hintergrund und unter allem Inhalt und
     nehmen keine Klicks an — man soll sie sehen und sonst nichts von
     ihnen merken. */
  function rauchAn() {
    try { return localStorage.getItem(RAUCH_KEY) !== 'aus'; } catch (e) { return true; }
  }

  function rauchBauen() {
    var da = document.getElementById('rauch');
    if (da) return da;
    var box = document.createElement('div');
    box.id = 'rauch';
    box.className = 'rauch';
    box.setAttribute('aria-hidden', 'true');
    for (var i = 1; i <= 3; i++) {
      var s = document.createElement('i');
      s.className = 'rauch-schwade r' + i;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    return box;
  }

  function rauchZeigen(an) {
    var box = an ? rauchBauen() : document.getElementById('rauch');
    if (!box) return;
    box.classList.toggle('an', !!an);
    /* Wer keine Bewegung will, bekommt keine — dann bleibt es beim
       stillen Schleier. Das entscheidet die CSS, hier nur die Flagge. */
    document.documentElement.classList.toggle('raucht', !!an);
  }

  /** An/aus schalten. Gilt fuer dieses Geraet und bleibt gespeichert. */
  GK.rauchSchalten = function (an) {
    try { localStorage.setItem(RAUCH_KEY, an ? 'an' : 'aus'); } catch (e) {}
    rauchZeigen(!!an && hat('420'));
    return !!an;
  };
  GK.rauchLaeuft = function () { return rauchAn(); };

  /**
   * Ein Osterei anwenden.
   *
   * `frisch` heisst: gerade eingeloest — dann gibt es einmal die grosse
   * Geste. Beim normalen Anwenden (Seitenaufbau, Kontowechsel) passiert
   * nur das Noetige.
   */
  GK.osterei = function (id, frisch) {
    var e = EIER[id];
    if (!e) return;
    if (id === '420') {
      rauchZeigen(rauchAn());
      /* Die Senderliste hat sich geaendert — das Musikfenster soll es
         mitbekommen, auch wenn es gerade offen steht. */
      if (GK.emit) GK.emit('musik-liste');
      if (frisch) {
        GK.toast('🌿 Ganja FM ist jetzt in der Senderauswahl', 'gold', '🌿');
        if (GK.emojiRain) GK.emojiRain(['🌿', '💨', '🍃'], 30);
      }
    }
  };

  /** Alles anwenden, was dieses Konto hat. */
  GK.eierAnwenden = function () {
    var p = GK.player && GK.player();
    var liste = (p && p.eier) || [];
    /* Erst abraeumen: wer das Konto wechselt, soll den Rauch des anderen
       nicht behalten. */
    if (liste.indexOf('420') < 0) rauchZeigen(false);
    liste.forEach(function (k) { GK.osterei(k, false); });
  };

  /* Beim Anmelden, beim Kontowechsel und nach jedem Serverstand. */
  if (GK.on) {
    GK.on('player-changed', GK.eierAnwenden);
    GK.on('logged-out', function () { rauchZeigen(false); });
  }

})(window.GK);
