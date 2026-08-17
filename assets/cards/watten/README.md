# Deutsches Blatt für Watten

Watten wird mit deutschen Farben gespielt — Herz, Schellen, Eichel, Gras.
Dieser Ordner liegt bewusst **außerhalb** von `themes/`: das Blatt gehört fest
zum Spiel und taucht in der Deck-Auswahl der anderen Kartenspiele nicht auf.

## Woher die Dateien kommen

Die Vorlage liegt als **`quelle.webp`** hier: ein Foto des Blatts, alle 36
Karten in vier Reihen zu je neun, in dieser Reihenfolge:

```
Reihe 1  Herz         Spalten:  6  7  8  9  10  Unter  Ober  König  Ass
Reihe 2  Eichel
Reihe 3  Gras (Laub)
Reihe 4  Schellen
```

Neu schneiden geht mit:

```
python3 tools/build-watten.py assets/cards/watten/quelle.webp
```

Das Werkzeug begradigt das Foto (ein Foto liegt nie ganz gerade) und sucht
sich das Raster selbst. Nach Helligkeit zu suchen bringt dabei nichts — das
Papier ist genauso hell wie der Untergrund, und die Karten liegen dicht an
dicht. Verlässlich sind stattdessen die langen dunklen Striche: Kartenkante
und aufgedruckter Rahmen. Daraus kommen die Reihengrenzen (für jede Spalte
einzeln, denn das Foto ist leicht perspektivisch verzogen), und aus dem
weißen Rand unter jeder Oberkante die Spaltengrenzen. Zum Schluss kommt jede
Karte auf dasselbe Seitenverhältnis wie die übrigen Decks (260 zu 364) —
durch Auffüllen, nicht durch Beschneiden, weil ein deutsches Blatt schmaler
ist und sonst die Randzeichen wegfielen. Heraus kommen:

* `7H.webp` … `AD.webp` — 32 Karten. Die Sechser braucht Watten nicht.
* `farbe-herz.webp`, `farbe-schellen.webp`, `farbe-eichel.webp`,
  `farbe-gras.webp` — die vier Farbzeichen mit durchsichtigem Grund, für die
  Trumpfanzeige neben dem Feld. Sie kommen aus der Ecke des Königs: dort steht
  ein einzelnes, großes Zeichen ganz frei. Auf den Zahlenkarten hängen die
  Zeichen an einer gemalten Ranke oder berühren sich — von dort geschnitten
  käme ein Büschel statt eines Zeichens heraus.
* `back.webp` — die Rückseite. Auf einem Foto der Vorderseiten ist sie nicht
  drauf, deshalb wird sie gezeichnet.

Die Buchstaben in den Dateinamen sind die des französischen Blatts, weil
`GK.cardEl` danach sucht: **H = Herz, D = Schellen, C = Eichel, S = Gras**,
und **J = Unter, Q = Ober, A = Sau**.

Solange die Dateien fehlen, zeigt Watten weiter das gewohnte Deck und die
Trumpfanzeige das Zeichen aus dem Kartensatz — kaputt ist nichts.
