# Skins

Ein Skin tauscht das Aussehen der ganzen Seite aus. Ausgewählt wird er im
Konto-Fenster (👤 oben rechts) unter **ANSTRICH**; die Wahl gehört zum
Gerät, nicht zum Konto.

| Skin | Kennung | Ordner |
|---|---|---|
| GambaKing (Standard) | `default` | — |
| Old Vegas | `old-vegas` | `assets/skins/old-vegas/` |

---

## Was ein Skin ändert

Farben und Hintergrund kommen aus **`css/skins.css`**. Dort hängt jeder
Skin an einem Block `:root[data-skin="…"]`, der die Farbvariablen aus
`css/style.css` überschreibt. Weil fast jede Regel im Haus über
`var(--pink)`, `var(--gold)` und Geschwister geht, färbt sich damit die
ganze Seite mit — Knöpfe, Ränder, Leuchten, Kacheln, Tabellen.

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

Bilder sind optional: ohne sie bleibt der Verlauf aus `css/skins.css`.
Empfohlen: 1920×1080 oder größer, `.webp`. Wie hell das Bild ist, spielt
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
