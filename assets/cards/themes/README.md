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
| `id` | ja | Kennung, unter der sich die Auswahl das Deck merkt |
| `name` | ja | Was auf der Kachel steht |
| `aspect` | ja | Seitenverhältnis, muss zum Bildmass passen |
| `ordner` | — | Wo die Blätter liegen, falls nicht gleich der Kennung |
| `rueck` | — | Name der Rückseite ohne Endung, falls nicht `back` |

## Mehrere Rückseiten zu einem Blatt

`ordner` und `rueck` gibt es wegen **New Vegas**: dort liegt ein einziger
Satz Vorderseiten, daneben aber acht Rückseiten — eine je Spielhalle. Statt
acht Ordner mit denselben 52 Bildern anzulegen, teilen sich acht Einträge
die Vorderseiten und unterscheiden sich nur in dem einen Bild, das man beim
Spielen ohnehin am längsten ansieht:

```js
{ id: 'newVegas',       name: 'Lucky 38',    ordner: 'newVegas', rueck: 'BACK',   aspect: '260/364' },
{ id: 'nv-ultra-luxe',  name: 'Ultra-Luxe',  ordner: 'newVegas', rueck: 'EXTRA1', aspect: '260/364' }
```

Im Ordner `newVegas` liegen ausserdem `JOKER1`/`JOKER2` und zwei Karten mit
den Caravan-Regeln. Keines der Spiele im Haus braucht Joker, deshalb stehen
sie in keinem Eintrag — sie liegen nur dabei.
