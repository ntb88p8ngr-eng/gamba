# Old Vegas — Bilder

Hier liegen die Hintergründe dieses Skins. Ausgewählt werden sie im
Konto-Fenster (👤) unter **ANSTRICH**: unter den Skin-Kacheln steht eine
Reihe mit einer Vorschau je Bild, dazu **🔄 Wechsel** — dann laufen alle
der Reihe nach durch, alle 45 Sekunden eines, weich überblendet.

| Datei | Erscheint als |
|---|---|
| `hintergrund1.webp` | 1 |
| `hintergrund2.webp` | 2 |
| `hintergrund3.webp` | 3 |
| `hintergrund4.webp` | 4 |
| `hintergrund5.webp` | 5 |

Empfehlung: 1920×1080 oder größer, `.webp`. Wie hell das Bild ist, spielt
kaum eine Rolle — darüber liegt ein Schleier aus `css/skins.css`, damit
heller Text lesbar bleibt.

## Ein Bild austauschen

Datei mit demselben Namen ersetzen, Seite neu laden. Fertig.

## Noch ein Bild dazu

1. Datei als `hintergrund6.webp` ablegen — durchnummeriert weiter, ohne
   „bild" im Namen.
2. In `js/skins.js` beim Skin `old-vegas` die Liste `bilder` um
   `{ id: '6', datei: 'hintergrund6.webp' }` ergänzen.

Ohne den zweiten Schritt passiert nichts: die Datei liegt dann zwar da,
steht aber in keiner Auswahl.

Fehlt eine Datei, bleibt die Fläche an dieser Stelle leer und es zählt
nur der dunkelrote Verlauf darunter.
