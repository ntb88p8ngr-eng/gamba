# Kulisse für Pinguin-Sprung

Hier gehört **`eis.webp`** hin — das Hintergrundbild der Szene.

Es wird von `.peng-scene::before` in `css/games.css` als `cover` eingeblendet,
füllt also die ganze Fläche und wird an den Rändern beschnitten. Gut geeignet
ist ein querformatiges Bild, etwa 1600 × 1000, mit Himmel oben und Wasser oder
Eis in der unteren Hälfte — dort laufen die Schollen.

Fehlt die Datei, bleibt der helle Eis-Verlauf aus derselben Regel stehen. Die
Szene sieht dann schlichter aus, aber nicht kaputt.

Andere Formate gehen auch (`.jpg`, `.png`); dann den Pfad in `.peng-scene::before`
mit ändern. `.webp` ist bei gleicher Qualität deutlich kleiner.
