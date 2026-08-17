# Deutsches Blatt für Watten

Watten wird mit deutschen Farben gespielt — Herz, Schellen, Eichel, Gras.
Dieser Ordner liegt bewusst **außerhalb** von `themes/`: das Blatt gehört fest
zum Spiel und taucht in der Deck-Auswahl der anderen Kartenspiele nicht auf.

## Woher die Dateien kommen

Die Vorlage liegt als **`quelle.png`** hier: alle 36 Karten in vier Reihen zu
je neun, auf einfarbigem Grund und mit Luft dazwischen, in dieser Reihenfolge:

```
Reihe 1  Herz         Spalten:  6  7  8  9  10  Unter  Ober  König  Ass
Reihe 2  Eichel
Reihe 3  Gras (Laub)
Reihe 4  Schellen
```

Neu schneiden geht mit:

```
python3 tools/build-watten.py assets/cards/watten/quelle.png
```

Das Werkzeug gleicht eine Schieflage aus, falls die Vorlage schief liegt, und
sucht sich das Raster selbst: Die Grundfarbe kommt aus dem äußersten Rand des
Bildes, alles was sich davon absetzt ist bedruckt — also Karte. Aus dem
zeilen- und spaltenweisen Anteil bedruckter Pixel ergeben sich vier Bänder und
darin je neun. Die Spalten werden pro Reihe einzeln gesucht, damit eine leicht
verrutschte Reihe nicht die anderen mitzieht.

Das Ausgabeformat kommt aus der Vorlage selbst: 260 Pixel breit wie die übrigen
Decks, die Höhe aus dem gemessenen Seitenverhältnis aller 36 Karten. Für dieses
Blatt sind das **260 zu 478** (0,544) — ein deutsches Blatt ist deutlich
schmaler als ein französisches (0,714). Steckte es in einer französischen
Kachel, hätte es links und rechts weiße Streifen und sähe schlicht falsch aus.
Quer über die Vorlage sind die Karten ein paar Prozent unterschiedlich groß;
der Rest wird deshalb aufgefüllt statt beschnitten, sonst fielen bei den
knappsten Karten die Randzeichen weg. Heraus kommen:

* `7H.webp` … `AD.webp` — 32 Karten. Die Sechser braucht Watten nicht.
* `farbe-herz.webp`, `farbe-schellen.webp`, `farbe-eichel.webp`,
  `farbe-gras.webp` — die vier Farbzeichen mit durchsichtigem Grund, für die
  Trumpfanzeige neben dem Feld. Sie kommen aus der Ecke des Königs: dort steht
  ein einzelnes, großes Zeichen ganz frei. Auf den Zahlenkarten hängen die
  Zeichen an einer gemalten Ranke oder berühren sich — von dort geschnitten
  käme ein Büschel statt eines Zeichens heraus.
* `back.webp` — die Rückseite. Die Vorlage zeigt nur die Vorderseiten, deshalb
  wird sie gezeichnet.

Die Vorlage sollte sauber und gerade sein und die Karten mit etwas Abstand
zeigen. Liegen sie dicht an dicht, findet die Projektion keine Fugen und das
Werkzeug meldet das, statt schief zu schneiden.

Die Buchstaben in den Dateinamen sind die des französischen Blatts, weil
`GK.cardEl` danach sucht: **H = Herz, D = Schellen, C = Eichel, S = Gras**,
und **J = Unter, Q = Ober, A = Sau**.

Ändert sich beim Neuschneiden das Format, gibt das Werkzeug es aus — dann
gehört derselbe Wert nach `GK.CARD_DECKS` in `js/core.js`, sonst rechnet die
Oberfläche weiter mit dem alten.

Solange die Dateien fehlen, zeigt Watten weiter das gewohnte Deck und die
Trumpfanzeige das Zeichen aus dem Kartensatz — kaputt ist nichts.
