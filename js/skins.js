/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Skins

   Ein Skin tauscht das Aussehen der ganzen Seite aus: Farben, Hintergrund,
   später auch mehr. Technisch ist er nichts weiter als ein Attribut am
   Wurzelelement — `data-skin="old-vegas"` —, an dem die CSS-Regeln in
   css/skins.css hängen. Kein Nachladen, kein zweites Stylesheet.

   Der Standard heißt „default" und ist genau das, was die Seite schon
   immer war: Neon, Lila, Chaos. Wer nichts auswählt, sieht ihn.

   Die Wahl gehört zum Gerät, nicht zum Konto — wie Sprache und Lautstärke.
   Deshalb liegt sie im localStorage und nicht auf dem Server.

   Gesetzt wird das Attribut schon im <head> (kleines Skript dort), damit
   die Seite nicht erst kurz im falschen Anstrich aufblitzt. Dieses Modul
   liefert dazu die Liste, die Umschaltung und das Ereignis.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var SCHLUESSEL = 'gambaking:skin';

  /* Ein Skin bringt seine eigenen Assets unter assets/skins/<id>/ mit.
     Was dort liegen darf, steht in assets/skins/README.md — fehlt eine
     Datei, greift der Anstrich aus reinem CSS. */
  var SKINS = [
    {
      id: 'default', name: 'GambaKing', emoji: '👑',
      was: 'Neon, Lila und Chaos — wie gehabt.',
      farbe: '#12002b'
    },
    {
      id: 'old-vegas', name: 'Old Vegas', emoji: '🎲',
      was: 'Rot, Gold und Samt. Glühbirnen statt Neonröhren.',
      /* Mehrere Hintergründe zur Wahl. Benannt sind sie bewusst nur
         durchnummeriert — welches Motiv dahintersteckt, zeigt die
         Vorschau in der Auswahl besser als jeder Name, und wer eine
         Datei austauscht, muss hier nichts nachziehen. */
      farbe: '#1a0407',
      bilder: [
        { id: '1', datei: 'hintergrund1.webp' },
        { id: '2', datei: 'hintergrund2.webp' },
        { id: '3', datei: 'hintergrund3.webp' },
        { id: '4', datei: 'hintergrund4.webp' },
        { id: '5', datei: 'hintergrund5.webp' },
        /* Ein bewegter Hintergrund: alte Leuchtreklame, in Schleife.
           Zwei Fassungen — genommen wird die erste, die der Browser
           abspielen kann. WebM wiegt weniger, MP4 kann jeder.
           `standbild` ist beides zugleich: die Vorschau in der Auswahl
           und der Ersatz für alle, die keine Bewegung wollen. */
        { id: 'film', film: true,
          dateien: ['hintergrundfilm.webm', 'hintergrundfilm.mp4'],
          standbild: 'hintergrundfilm.webp' }
      ]
    },
    {
      id: 'vaporwave', name: 'Vaporwave', emoji: '🌴',
      was: 'Rosa Sonne, Chromgitter, 1984 im Einkaufszentrum.',
      farbe: '#1b0736',
      /* Liegt die Datei nicht da, bleibt es beim gemalten Sonnenuntergang
         aus css/skins.css — die Bildebene bleibt dann einfach leer.

         Die Fotos stehen vorn und eines davon ist die Voreinstellung: ein
         Film wiegt ein Vielfaches, und den soll bekommen, wer ihn auch
         ausgesucht hat. Wer einmal wählt, behält seine Wahl. */
      bilder: [
        { id: '1', datei: 'hintergrund1.webp' },
        { id: '2', datei: 'hintergrund2.webp' },
        /* Wie bei Old Vegas zwei Fassungen, WebM zuerst: es wiegt weniger,
           und MP4 faengt die Browser auf, die kein VP9 koennen. Umgekehrt
           ginge es nicht — H.264 ist nicht ueberall eingebaut, das eigene
           Chromium der Tests etwa kann es gar nicht. Ohne die WebM-Fassung
           liefe dort nur das Standbild.
           Das Standbild ist zugleich die Vorschau in der Auswahl und der
           Ersatz fuer alle, die keine Bewegung wollen. */
        { id: 'film1', film: true,
          dateien: ['film1.webm', 'film1.mp4'], standbild: 'film1.webp' },
        /* Die Neonstadt ist die hellste der drei — ungedimmt verschwinden
           die Zeilen darüber im Leuchten. */
        { id: 'film2', film: true, dunkel: 'stark',
          dateien: ['film2.webm', 'film2.mp4'], standbild: 'film2.webp' },
        { id: 'film3', film: true,
          dateien: ['film3.webm', 'film3.mp4'], standbild: 'film3.webp' }
      ]
    },
    {
      id: 'strand', name: 'Strand', emoji: '🏖',
      was: 'Türkises Wasser, warmer Sand, Sonne kurz vorm Untergehen.',
      farbe: '#07304a',
      bilder: [
        { id: '1', datei: 'hintergrund1.webp' }
      ]
    }
  ];

  /* Wie lange ein Bild steht, bevor im Wechsel-Betrieb das nächste kommt. */
  var WECHSEL_MS = 45000;
  var WECHSEL = 'wechsel';

  function gueltig(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i].id;
    return 'default';
  }

  var jetzt = 'default';
  try { jetzt = gueltig(localStorage.getItem(SCHLUESSEL)); } catch (e) {}

  /* Gewähltes Bild je Skin — „wechsel" heißt: alle der Reihe nach. */
  var bildWahl = {};
  var wechselUhr = null;
  var wechselPos = 0;
  var lage = 'a';                 // welche der beiden Bildebenen gerade oben liegt

  function bilderVon(id) {
    var sk = null;
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) sk = SKINS[i];
    return (sk && sk.bilder) || [];
  }

  function bildSchluessel(id) { return SCHLUESSEL + ':bild:' + id; }

  function bildLaden(id) {
    if (bildWahl[id] !== undefined) return bildWahl[id];
    var w = '';
    try { w = localStorage.getItem(bildSchluessel(id)) || ''; } catch (e) {}
    var liste = bilderVon(id);
    if (w !== WECHSEL) {
      var gibt = false;
      liste.forEach(function (b) { if (b.id === w) gibt = true; });
      if (!gibt) w = liste.length ? liste[0].id : '';
    }
    bildWahl[id] = w;
    return w;
  }

  function eintragVon(skinId, bildId) {
    var liste = bilderVon(skinId);
    for (var i = 0; i < liste.length; i++) if (liste[i].id === bildId) return liste[i];
    return null;
  }

  /** Pfad eines Hintergrunds — leer, wenn der Skin keinen mitbringt. */
  function bildPfad(skinId, bildId) {
    var e = eintragVon(skinId, bildId);
    return e ? 'assets/skins/' + skinId + '/' + e.datei : '';
  }
  GK.skinBildPfad = bildPfad;

  /**
   * Was die Auswahl als Vorschau zeigt.
   *
   * Ein Film taugt nicht als Kachelbild — dafür bringt er ein Standbild
   * mit. Alles andere zeigt sich selbst.
   */
  GK.skinBildVorschau = function (skinId, bildId) {
    var e = eintragVon(skinId || jetzt, bildId);
    if (!e) return '';
    /* Ein Film ohne Standbild hat kein Kachelbild — die Filmdatei selbst
       taugt nicht als background-image. Dann bleibt die Kachel leer und
       das Filmzeichen darauf sagt, worum es geht. */
    if (e.film && !e.standbild) return '';
    return 'assets/skins/' + (skinId || jetzt) + '/' + (e.standbild || e.datei);
  };

  /**
   * Wer keine Bewegung will, bekommt keine.
   *
   * Das ist eine Einstellung des Geräts, keine Kleinigkeit: für manche
   * Menschen lösen bewegte Flächen Übelkeit aus. Statt des Films läuft
   * dann sein Standbild — dasselbe Motiv, nur still.
   */
  function ruhigGewuenscht() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /**
   * Ein Bild einblenden.
   *
   * Zwei Ebenen liegen übereinander: die neue wird bestückt und dann
   * aufgeblendet. Ein weicher Übergang geht nur so — background-image
   * selbst lässt sich nicht überblenden.
   */
  /* Liegt ein Foto im Hintergrund, merkt das Wurzelelement es sich.
     Manche Anstriche malen ihren Hintergrund selbst — eine Sonne, ein
     Gitter, einen Horizont —, und das alles muss aus dem Weg, sobald ein
     Foto dahinterliegt. Ohne die Flagge wüsste das Stylesheet nichts
     davon; die Bildebenen sind ihm gleichgültig. */
  function bildFlagge(an) {
    var w = document.documentElement;
    if (an) w.setAttribute('data-bg-bild', 'an');
    else w.removeAttribute('data-bg-bild');
  }

  /**
   * Wie stark eine Aufnahme heruntergedimmt wird.
   *
   * Der Schleier eines Anstrichs ist auf sein Motiv abgestimmt — eine
   * Nachtaufnahme braucht wenig, eine Neonstadt bei voller Helligkeit
   * viel. Statt den Schleier je Datei umzuschreiben, trägt der Eintrag
   * selbst ein `dunkel` und die Aufnahme bekommt einen Filter. Das kommt
   * zum Schleier hinzu, statt ihn zu ersetzen, und gilt nur für die
   * Bild- und Filmebene — Text und Kacheln bleiben unberührt.
   */
  function dunkelFlagge(e) {
    var w = document.documentElement;
    if (e && e.dunkel) w.setAttribute('data-bg-dunkel', e.dunkel);
    else w.removeAttribute('data-bg-dunkel');
  }

  /* Welches Bild zuletzt gewünscht wurde. Wer schnell durchklickt, löst
     mehrere Ladevorgänge aus, und die kommen nicht in der Reihenfolge
     zurück, in der sie losgeschickt wurden — angezeigt wird nur, was auch
     noch gewollt ist. */
  var bildWunsch = '';

  function bildLeeren(a, b) {
    a.style.backgroundImage = ''; b.style.backgroundImage = '';
    a.classList.remove('an'); b.classList.remove('an');
    delete a.dataset.pfad; delete b.dataset.pfad;
    bildFlagge(false);
  }

  function bildZeigen(pfad) {
    var a = document.querySelector('.bg-bild[data-bg="a"]');
    var b = document.querySelector('.bg-bild[data-bg="b"]');
    if (!a || !b) return;
    bildWunsch = pfad || '';
    if (!pfad) { bildLeeren(a, b); return; }

    var neu = lage === 'a' ? b : a;
    if (neu.dataset.pfad === pfad && neu.classList.contains('an')) return;

    /* Erst laden, dann zeigen. Fehlt die Datei, bliebe sonst eine leere
       Ebene über dem gemalten Hintergrund liegen — und bei einem Anstrich,
       der seine Sonne selbst malt, stünde man vor einer dunklen Fläche.
       So fällt es sauber auf das zurück, was das Stylesheet kann.
       Aus dem Zwischenspeicher kommt das Bild sofort zurück; der Umweg
       kostet also nur beim allerersten Mal etwas. */
    var probe = new Image();
    probe.onload = function () {
      if (bildWunsch !== pfad) return;         // inzwischen weitergeklickt
      var oben = lage === 'a' ? b : a;
      var unten = lage === 'a' ? a : b;
      oben.style.backgroundImage = 'url("' + pfad + '")';
      oben.dataset.pfad = pfad;
      oben.classList.add('an');
      unten.classList.remove('an');
      lage = lage === 'a' ? 'b' : 'a';
      bildFlagge(true);
    };
    probe.onerror = function () {
      if (bildWunsch !== pfad) return;
      bildLeeren(a, b);
    };
    probe.src = pfad;
  }

  /* Welche Fassung eines Films kann dieser Browser? Gefragt wird der
     Browser selbst — raten hilft hier nicht weiter, und die Antwort
     „maybe" ist eine Zusage genug. */
  var FILM_TYPEN = {
    '.webm': 'video/webm; codecs="vp9"',
    '.mp4': 'video/mp4; codecs="avc1.4d401e"'
  };

  function filmDatei(video, eintrag) {
    var liste = eintrag.dateien || (eintrag.datei ? [eintrag.datei] : []);
    var ersatz = '';
    for (var i = 0; i < liste.length; i++) {
      var punkt = liste[i].lastIndexOf('.');
      var typ = FILM_TYPEN[liste[i].slice(punkt).toLowerCase()];
      if (!typ) continue;
      if (video.canPlayType(typ)) return liste[i];
      if (!ersatz) ersatz = liste[i];
    }
    /* Sagt der Browser zu keiner Fassung ja, wird die erste trotzdem
       versucht — canPlayType ist notorisch vorsichtig. Geht sie nicht,
       fängt das Standbild den Fall ohnehin auf. */
    return ersatz || liste[0] || '';
  }

  /* Über einem Film darf der Schleier etwas dünner sein als über einem
     Foto: Bewegung, die man kaum noch sieht, ist keine. Das Attribut
     sagt dem Stylesheet Bescheid — es gehört ans Wurzelelement, weil der
     Schleier dort hängt und nicht am Film selbst. */
  function filmFlagge(an) {
    var w = document.documentElement;
    if (an) w.setAttribute('data-bg-film', 'an');
    else w.removeAttribute('data-bg-film');
  }

  /** Den Film anhalten und aus dem Weg räumen. */
  function filmAus() {
    filmFlagge(false);
    var v = document.querySelector('.bg-film');
    if (!v) return;
    v.classList.remove('an');
    if (!v.paused) { try { v.pause(); } catch (e) {} }
  }

  /**
   * Einen Film als Hintergrund laufen lassen.
   *
   * Die Quelle wird erst hier gesetzt: ein Film, den niemand ausgewählt
   * hat, soll auch nicht geladen werden. Läuft er nicht an — manche
   * Browser verweigern das ohne Zutun, und im Sparmodus geht gar nichts —,
   * bleibt das Standbild stehen, das ohnehin darunter liegt.
   */
  function filmZeigen(eintrag, skinId) {
    /* Das Standbild kommt auf die gewohnte Bildebene. Es steht dort,
       während der Film lädt, und es bleibt, wenn er nicht darf. */
    if (eintrag.standbild) {
      bildZeigen('assets/skins/' + skinId + '/' + eintrag.standbild);
    } else {
      /* Ohne Standbild muss die Bildebene leer werden. Sonst bliebe das
         Foto liegen, das vorher gewählt war, und läge unter dem Film —
         sichtbar in jeder Sekunde, in der er noch lädt, und dauerhaft für
         alle, die keine Bewegung wollen. */
      bildZeigen('');
    }
    var v = document.querySelector('.bg-film');
    if (!v || ruhigGewuenscht()) return;    // dann bleibt es beim Standbild
    var datei = filmDatei(v, eintrag);
    if (!datei) return;                     // kein Format, das hier läuft
    var pfad = 'assets/skins/' + skinId + '/' + datei;
    if (v.dataset.pfad !== pfad) {
      v.dataset.pfad = pfad;
      v.src = pfad;
      v.load();
    }
    v.classList.add('an');
    filmFlagge(true);
    var p = v.play();
    if (p && p['catch']) p['catch'](function () {
      v.classList.remove('an');
      filmFlagge(false);
    });
  }

  function uhrAus() {
    if (wechselUhr) { clearInterval(wechselUhr); wechselUhr = null; }
  }

  /**
   * Einen Eintrag anzeigen — Bild oder Film, je nachdem, was er ist.
   *
   * Der Film läuft auf einer eigenen Ebene über den Bildebenen. Wer von
   * ihm wegschaltet, muss ihn deshalb auch anhalten; ein Film, der
   * unsichtbar weiterspielt, kostet nur Strom.
   */
  function eintragZeigen(e) {
    dunkelFlagge(e);
    if (!e) { filmAus(); bildZeigen(''); return; }
    if (e.film) { filmZeigen(e, jetzt); return; }
    filmAus();
    bildZeigen('assets/skins/' + jetzt + '/' + e.datei);
  }

  /** Bild (oder Wechsel) für den laufenden Skin in Gang setzen. */
  function bildAnwenden() {
    uhrAus();
    var liste = bilderVon(jetzt);
    if (!liste.length) { eintragZeigen(null); return; }
    var w = bildLaden(jetzt);
    if (w !== WECHSEL) { eintragZeigen(eintragVon(jetzt, w)); return; }
    /* Wechsel: mit dem ersten anfangen und dann im Takt weiterziehen. */
    wechselPos = wechselPos % liste.length;
    eintragZeigen(liste[wechselPos]);
    wechselUhr = setInterval(function () {
      var l = bilderVon(jetzt);
      if (!l.length) { uhrAus(); return; }
      wechselPos = (wechselPos + 1) % l.length;
      eintragZeigen(l[wechselPos]);
    }, WECHSEL_MS);
  }

  /** Welche Hintergründe bringt ein Skin mit? */
  GK.skinBilder = function (id) { return bilderVon(id || jetzt); };

  /** Gewählter Hintergrund — Kennung oder „wechsel". */
  GK.skinBild = function (id) { return bildLaden(id || jetzt); };

  GK.setSkinBild = function (bildId) {
    var liste = bilderVon(jetzt);
    if (!liste.length) return '';
    var gibt = bildId === WECHSEL;
    liste.forEach(function (b) { if (b.id === bildId) gibt = true; });
    if (!gibt) return bildLaden(jetzt);
    bildWahl[jetzt] = bildId;
    try { localStorage.setItem(bildSchluessel(jetzt), bildId); } catch (e) {}
    bildAnwenden();
    if (GK.emit) GK.emit('skin-bild', bildId);
    return bildId;
  };

  function anwenden() {
    var w = document.documentElement;
    if (jetzt === 'default') w.removeAttribute('data-skin');
    else w.setAttribute('data-skin', jetzt);
    /* Die Farbe der Browserleiste am Handy zieht mit — sonst steht über
       einem roten Casino ein lila Balken. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var sk = null;
      for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === jetzt) sk = SKINS[i];
      meta.setAttribute('content', (sk && sk.farbe) || '#12002b');
    }
    bildAnwenden();
  }

  GK.skins = SKINS;

  /** Welcher Skin läuft gerade? */
  GK.skin = function () { return jetzt; };

  /** Skin-Beschreibung zu einer Kennung. */
  GK.skinInfo = function (id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === (id || jetzt)) return SKINS[i];
    return SKINS[0];
  };

  /**
   * Umschalten. Wer denselben Skin noch einmal wählt, löst nichts aus.
   *
   * Das Ereignis „skin" ist für alles, was sich nicht allein über CSS
   * regeln lässt — die Musikliste zum Beispiel: manche Stücke gehören nur
   * zu einem bestimmten Anstrich.
   */
  GK.setSkin = function (id) {
    var neu = gueltig(id);
    if (neu === jetzt) return jetzt;
    jetzt = neu;
    try { localStorage.setItem(SCHLUESSEL, jetzt); } catch (e) {}
    anwenden();
    if (GK.emit) GK.emit('skin', jetzt);
    return jetzt;
  };

  anwenden();
})(window.GK);
