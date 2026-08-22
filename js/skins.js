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
      was: 'Neon, Lila und Chaos — wie gehabt.'
    },
    {
      id: 'old-vegas', name: 'Old Vegas', emoji: '🎲',
      was: 'Rot, Gold und Samt. Glühbirnen statt Neonröhren.',
      /* Mehrere Hintergründe zur Wahl. Benannt sind sie bewusst nur
         durchnummeriert — welches Motiv dahintersteckt, zeigt die
         Vorschau in der Auswahl besser als jeder Name, und wer eine
         Datei austauscht, muss hier nichts nachziehen. */
      bilder: [
        { id: '1', datei: 'hintergrund1.webp' },
        { id: '2', datei: 'hintergrund2.webp' },
        { id: '3', datei: 'hintergrund3.webp' },
        { id: '4', datei: 'hintergrund4.webp' },
        { id: '5', datei: 'hintergrund5.webp' }
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

  /** Pfad eines Bildes — leer, wenn der Skin keine mitbringt. */
  function bildPfad(skinId, bildId) {
    var liste = bilderVon(skinId);
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === bildId) return 'assets/skins/' + skinId + '/' + liste[i].datei;
    }
    return '';
  }
  GK.skinBildPfad = bildPfad;

  /**
   * Ein Bild einblenden.
   *
   * Zwei Ebenen liegen übereinander: die neue wird bestückt und dann
   * aufgeblendet. Ein weicher Übergang geht nur so — background-image
   * selbst lässt sich nicht überblenden.
   */
  function bildZeigen(pfad) {
    var a = document.querySelector('.bg-bild[data-bg="a"]');
    var b = document.querySelector('.bg-bild[data-bg="b"]');
    if (!a || !b) return;
    if (!pfad) { a.style.backgroundImage = ''; b.style.backgroundImage = '';
                 a.classList.remove('an'); b.classList.remove('an'); return; }
    var neu = lage === 'a' ? b : a;
    var alt = lage === 'a' ? a : b;
    if (neu.dataset.pfad === pfad && neu.classList.contains('an')) return;
    neu.style.backgroundImage = 'url("' + pfad + '")';
    neu.dataset.pfad = pfad;
    neu.classList.add('an');
    alt.classList.remove('an');
    lage = lage === 'a' ? 'b' : 'a';
  }

  function uhrAus() {
    if (wechselUhr) { clearInterval(wechselUhr); wechselUhr = null; }
  }

  /** Bild (oder Wechsel) für den laufenden Skin in Gang setzen. */
  function bildAnwenden() {
    uhrAus();
    var liste = bilderVon(jetzt);
    if (!liste.length) { bildZeigen(''); return; }
    var w = bildLaden(jetzt);
    if (w !== WECHSEL) { bildZeigen(bildPfad(jetzt, w)); return; }
    /* Wechsel: mit dem ersten anfangen und dann im Takt weiterziehen. */
    wechselPos = wechselPos % liste.length;
    bildZeigen(bildPfad(jetzt, liste[wechselPos].id));
    wechselUhr = setInterval(function () {
      var l = bilderVon(jetzt);
      if (!l.length) { uhrAus(); return; }
      wechselPos = (wechselPos + 1) % l.length;
      bildZeigen(bildPfad(jetzt, l[wechselPos].id));
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
    if (meta) meta.setAttribute('content', jetzt === 'old-vegas' ? '#1a0407' : '#12002b');
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
