# Kartendecks

Jedes Deck ist ein Ordner mit 52 Vorderseiten und einer Rückseite:

```
assets/cards/themes/<ordner>/
  AS.webp  AH.webp  AD.webp  AC.webp
  2S.webp  …  10S.webp  JS.webp  QS.webp  KS.webp
  back.webp
```

Der Dateiname ist Wert plus Farbe: `S` Pik, `H` Herz, `D` Karo, `C` Kreuz.
Der Zehner heisst `10`, nicht `T`.

Alle Blätter liegen in **260 × 364** — das ist das Mass, mit dem `.card`
rechnet. Was in einer anderen Grösse ankommt, bringt

```
python3 tools/build-cards.py <ordner>
```

auf Format: mittig beschnitten, auf 260 × 364 skaliert, als WEBP
gespeichert. Das Skript ist idempotent und überspringt, was schon passt.
Es lohnt sich immer — eine Vorlage mit 1500 × 2100 wiegt gut sechshundert
Kilobyte je Karte, dieselbe Karte im Hausformat rund fünfzehn. Bei sieben
Karten am Tisch ist das der Unterschied zwischen vier Megabyte und einem
Zehntel davon.

## Eintragen

Ein Deck taucht erst in der Auswahl auf, wenn es in `js/core.js` unter
`GK.CARD_THEMES` steht:

```js
{ id: 'juggler', name: 'Juggler', aspect: '260/364' }
```

| Feld | Pflicht | Wofür |
|---|---|---|
| `id` | ja | Kennung — zugleich der Ordnername unter `themes/` |
| `name` | ja | Was auf der Kachel steht |
| `aspect` | ja | Seitenverhältnis, muss zum Bildmass passen |

Die Kachel in der Auswahl zeigt die Rückseite. Sie muss deshalb wirklich
`back.webp` heissen, klein geschrieben — auf einem Server ist `BACK.webp`
eine andere Datei.

Karten, die kein Spiel im Haus braucht — Joker, Regelkarten, zusätzliche
Rückseiten —, gehören nicht in den Ordner: geladen werden sie nie, im
Verzeichnis stehen sie trotzdem.
