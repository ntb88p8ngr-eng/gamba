# Kulisse für Pinguin-Sprung

**`eis.webp`** ist das Hintergrundbild der Szene: eine Packeis-Aufnahme,
1536 × 1024.

Eingebunden wird es von `.peng-scene::before` in `css/games.css` als `cover` —
es füllt also die ganze Fläche und wird an den Rändern beschnitten. Ein Ersatz
sollte deshalb querformatig sein, mit Himmel oben und Wasser oder Eis in der
unteren Hälfte: dort laufen die Schollen, und darüber liegt ein dunkler
Verlauf, damit die Zahlen lesbar bleiben.

Fehlt die Datei, bleibt der helle Eis-Verlauf aus derselben Regel stehen. Die
Szene sieht dann schlichter aus, aber nicht kaputt.

Andere Formate gehen auch (`.jpg`, `.png`); dann den Pfad in
`.peng-scene::before` mit ändern. `.webp` ist bei gleicher Qualität deutlich
kleiner — aus 2,2 MB PNG wurden hier 214 KB.
