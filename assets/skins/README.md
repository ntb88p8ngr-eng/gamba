# Skins

Ein Skin tauscht das Aussehen der ganzen Seite aus. Ausgewählt wird er im
Konto-Fenster (👤 oben rechts) unter **ANSTRICH**; die Wahl gehört zum
Gerät, nicht zum Konto.

| Skin | Kennung | Ordner |
|---|---|---|
| GambaKing (Standard) | `default` | — |
| Old Vegas | `old-vegas` | `assets/skins/old-vegas/` |
| Vaporwave | `vaporwave` | `assets/skins/vaporwave/` (2 Bilder, 3 Filme) |
| Strand | `strand` | `assets/skins/strand/` |

Der Ordnername ist die **Kennung** des Skins, nicht sein Anzeigename —
`strand`, nicht `beach`. Wer daneben liegt, bekommt keinen Fehler,
sondern still den gemalten Hintergrund.

Jeder Skin außer dem Standard bringt eigene Bilder mit. Fehlt eine Datei,
greift der Hintergrund aus reinem CSS: Verläufe und die Ebenen, die
`index.html` ohnehin mitbringt — Sonne, Gitter, Lichtflecken, Streifen.
Beides ist gewollt, das eine ist der Ersatz für das andere.

Liegt ein Foto dahinter, steht `data-bg-bild="an"` am Wurzelelement.
Daran hängen in `css/skins.css` die Regeln, die den gemalten Hintergrund
aus dem Weg räumen — zwei Sonnen im selben Himmel sind eine zu viel — und
den Schleier verstärken, damit heller Text lesbar bleibt. Gesetzt wird
das Attribut erst, wenn das Bild wirklich geladen ist.

---

## Was ein Skin ändert

Farben und Hintergrund kommen aus **`css/skins.css`**. Dort hängt jeder
Skin an einem Block `:root[data-skin="…"]`, der die Farbvariablen aus
`css/style.css` überschreibt. Weil fast jede Regel im Haus über
`var(--pink)`, `var(--gold)` und Geschwister geht, färbt sich damit die
ganze Seite mit — Knöpfe, Ränder, Leuchten, Kacheln, Tabellen.

Wer einen weiteren Skin anlegt, trägt ihn an drei Stellen ein: die Liste
in `js/skins.js`, einen Block in `css/skins.css` samt Farbprobe
(`.skin-probe-<kennung>`), und `SKIN_IDS` in `server.js` — ohne das
Letzte lässt sich kein Radiosender auf ihn beschränken.

## Eigene Bilder

Ein Skin darf mehrere Hintergründe mitbringen. Welche das sind, steht in
`js/skins.js` in der Liste `bilder` des Skins:

```js
bilder: [
  { id: '1', datei: 'hintergrund1.webp' },
  { id: '2', datei: 'hintergrund2.webp' }
]
```

Ab zwei Bildern erscheint im Konto-Fenster unter den Skin-Kacheln eine
Reihe mit einer Vorschau je Bild, dazu **🔄 Wechsel** — dann laufen alle
der Reihe nach durch, alle 45 Sekunden eines, weich überblendet. Die Wahl
merkt sich das Gerät je Skin.

### Bewegte Hintergründe

Ein Eintrag mit `film: true` ist ein Film. Er bringt eine Liste von
Fassungen mit und ein Standbild:

```js
{ id: 'film1', film: true,
  dateien: ['film1.webm', 'film1.mp4'], standbild: 'film1.webp' }
```

Genommen wird die **erste Fassung, die der Browser abspielen kann** —
deshalb steht WebM vorn: es wiegt weniger, und MP4 fängt die Browser auf,
die kein VP9 können. Beide Fassungen sind nötig: H.264 ist nicht überall
eingebaut (in manchen Chromium-Bauten gar nicht), VP9 nicht in jedem
Safari. Fehlt die passende, bleibt das Standbild stehen — und das ist
auch die Vorschau in der Auswahl und der Ersatz für alle, die
`prefers-reduced-motion` gesetzt haben.

Für die Aufbereitung: 1280 breit, 24 Bilder, **ohne Ton** (das Element
ist stumm, der Ton wäre nur Ballast). Ein 4K-Original mit 60 Bildern wiegt
schnell siebzig Megabyte; dieselbe Aufnahme so aufbereitet ein bis drei.

```
ffmpeg -i quelle.mp4 -an -vf "scale=1280:-2,fps=24"        -c:v libvpx-vp9 -crf 44 -b:v 0 -row-mt 1 ziel.webm
ffmpeg -i quelle.mp4 -an -vf "scale=1280:-2,fps=24"        -c:v libx264 -crf 30 -preset medium -pix_fmt yuv420p        -movflags +faststart ziel.mp4
```

`-movflags +faststart` ist wichtig: ohne das steht der Inhaltsverzeichnis-
Block am Dateiende und der Browser muss erst alles laden, bevor das erste
Bild kommt.

### Zu helle Aufnahmen

Ist ein Motiv für den Schleier seines Anstrichs zu hell, bekommt der
Eintrag ein `dunkel`:

```js
{ id: 'film2', film: true, dunkel: 'stark', … }
```

`stark` oder `mittel`. Das dimmt nur die Aufnahme selbst, nicht den
Schleier und nicht den Text darüber — nützlich, wenn ein einzelner Film
aus der Reihe fällt und man deshalb nicht den ganzen Anstrich umbauen
will.

Bilder sind optional: ohne sie bleibt der Verlauf aus `css/skins.css`.
Empfohlen: 1920×1080 oder größer, `.webp`. Ein Foto als PNG wiegt
schnell drei Megabyte und lädt bei jedem Besuch mit; dieselbe Aufnahme
als WebP mit Qualität 90 wiegt ein Zehntel davon und sieht gleich aus. Wie hell das Bild ist, spielt
kaum eine Rolle — der Schleier darüber sorgt dafür, dass heller Text
lesbar bleibt.

---

## Neuen Skin anlegen

1. Kennung und Namen in `js/skins.js` in die Liste `SKINS` eintragen.
2. In `css/skins.css` einen Block `:root[data-skin="deine-kennung"]` mit
   den Farbvariablen anlegen.
3. Für die Farbprobe in der Auswahl eine Regel
   `.skin-probe-deine-kennung` dazuschreiben.
4. Bilder nach `assets/skins/deine-kennung/` legen.

## Musik nur für einen Skin

Ein Musikstück aus `assets/sfx/sounds.json` lässt sich auf Skins
beschränken:

```json
"music": [
  { "id": "vegas-lounge", "name": "Vegas Lounge", "file": "musik/lounge.mp3",
    "skins": ["old-vegas"] }
]
```

Ohne `skins` erscheint das Stück überall. Steht dort eine Liste, taucht es
nur unter diesen Skins in der Musikauswahl auf — und beim Wechsel des
Anstrichs schaltet die Musik selbstständig auf ein erlaubtes Stück um.
Einzelheiten: `assets/sfx/README.md`.
