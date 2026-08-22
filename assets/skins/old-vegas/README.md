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

Empfehlung: 1920×1080 oder größer, `.webp`. Wie hell das Bild ist, spielt
kaum eine Rolle — darüber liegt ein Schleier aus `css/skins.css`, damit
heller Text lesbar bleibt.

## Ein Bild austauschen

Datei mit demselben Namen ersetzen, Seite neu laden. Fertig.

## Ein viertes Bild dazu

1. Datei als `hintergrund4.webp` ablegen.
2. In `js/skins.js` beim Skin `old-vegas` die Liste `bilder` um
   `{ id: '4', datei: 'hintergrund4.webp' }` ergänzen.

Fehlt eine Datei, bleibt die Fläche an dieser Stelle leer und es zählt
nur der dunkelrote Verlauf darunter.
