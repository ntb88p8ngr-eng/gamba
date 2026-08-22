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
      was: 'Rot, Gold und Samt. Glühbirnen statt Neonröhren.'
    }
  ];

  function gueltig(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i].id;
    return 'default';
  }

  var jetzt = 'default';
  try { jetzt = gueltig(localStorage.getItem(SCHLUESSEL)); } catch (e) {}

  function anwenden() {
    var w = document.documentElement;
    if (jetzt === 'default') w.removeAttribute('data-skin');
    else w.setAttribute('data-skin', jetzt);
    /* Die Farbe der Browserleiste am Handy zieht mit — sonst steht über
       einem roten Casino ein lila Balken. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', jetzt === 'old-vegas' ? '#1a0407' : '#12002b');
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
