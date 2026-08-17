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
verrutschte Reihe nicht die anderen mitzieht. Zum Schluss kommt jede Karte auf
dasselbe Seitenverhältnis wie die übrigen Decks (260 zu 364) — durch Auffüllen,
nicht durch Beschneiden, weil ein deutsches Blatt schmaler ist und sonst die
Randzeichen wegfielen. Heraus kommen:

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

Solange die Dateien fehlen, zeigt Watten weiter das gewohnte Deck und die
Trumpfanzeige das Zeichen aus dem Kartensatz — kaputt ist nichts.
