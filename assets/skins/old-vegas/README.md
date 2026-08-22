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
| `hintergrundfilm.webm` / `.mp4` | 🎬 Film |

Empfehlung: 1920×1080 oder größer, `.webp`. Wie hell das Bild ist, spielt
kaum eine Rolle — darüber liegt ein Schleier aus `css/skins.css`, damit
heller Text lesbar bleibt.

## Der Film

`🎬 Film` ist ein bewegter Hintergrund: eine halbe Minute alte
Leuchtreklame in Schleife, geschnitten aus `vegasmovie.mp4`. Er liegt in
zwei Fassungen bereit — genommen wird die erste, die der Browser abspielen
kann; WebM wiegt weniger, MP4 kann jeder. Daneben liegt
`hintergrundfilm.webp`: dasselbe Motiv als Standbild. Es dient als
Vorschau in der Auswahl, steht da, solange der Film lädt, und bleibt
stehen, wenn er nicht laufen darf.

Geladen wird der Film erst, wenn ihn jemand auswählt — sonst zöge jeder
Besuch ein paar Megabyte, die er nie zu sehen bekommt. Wer am Gerät
„weniger Bewegung" eingestellt hat, bekommt nur das Standbild; das ist
keine Kleinigkeit, sondern für manche Menschen der Unterschied zwischen
benutzbar und übel.

Solange der Film läuft, wird der Schleier über dem Hintergrund ein Stück
dünner (`css/skins.css`, `[data-bg-film="an"]`) — Bewegung, die man kaum
noch sieht, ist keine.

Einen neuen Film schneiden: siehe `tools/build-skin-film.py`.

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
