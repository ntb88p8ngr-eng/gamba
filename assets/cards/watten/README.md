# Deutsches Blatt für Watten

Watten wird mit deutschen Farben gespielt — Herz, Schellen, Eichel, Gras.
Dieser Ordner liegt bewusst **außerhalb** von `themes/`: das Blatt gehört fest
zum Spiel und taucht in der Deck-Auswahl der anderen Kartenspiele nicht auf.

## Woher die Dateien kommen

Leg ein Foto des Blatts als **`quelle.png`** hier ab — alle 36 Karten in vier
Reihen zu je neun, in dieser Reihenfolge:

```
Reihe 1  Herz         Spalten:  6  7  8  9  10  Unter  Ober  König  Ass
Reihe 2  Eichel
Reihe 3  Gras (Laub)
Reihe 4  Schellen
```

Dann einmal:

```
python3 tools/build-watten.py assets/cards/watten/quelle.png
```

Das Werkzeug begradigt das Foto (ein Foto liegt nie ganz gerade), findet das
Raster selbst, schneidet jede Karte auf ihren Rand zu und bringt sie auf
dasselbe Seitenverhältnis wie die übrigen Decks (260 zu 364). Heraus kommen:

* `7H.webp` … `AD.webp` — 32 Karten. Die Sechser braucht Watten nicht.
* `farbe-herz.webp`, `farbe-schellen.webp`, `farbe-eichel.webp`,
  `farbe-gras.webp` — die vier Farbzeichen mit durchsichtigem Grund, für die
  Trumpfanzeige neben dem Feld.
* `back.webp` — die Rückseite. Auf einem Foto der Vorderseiten ist sie nicht
  drauf, deshalb wird sie gezeichnet.

Die Buchstaben in den Dateinamen sind die des französischen Blatts, weil
`GK.cardEl` danach sucht: **H = Herz, D = Schellen, C = Eichel, S = Gras**,
und **J = Unter, Q = Ober, A = Sau**.

Solange die Dateien fehlen, zeigt Watten weiter das gewohnte Deck und die
Trumpfanzeige das Zeichen aus dem Kartensatz — kaputt ist nichts.
