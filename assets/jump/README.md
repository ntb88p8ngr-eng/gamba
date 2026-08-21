# Bilder für den Endlos-Sprung

Alles hier wird aus den Vorlagen (`ChatGPT Image …png`) geschnitten mit

```
python3 tools/build-jump.py
```

Zugeordnet wird nicht über die Dateinamen — die sagen nichts —, sondern über
Bauart und Farbe: hochkant oder quer, wie viele Posen nebeneinander stehen,
und welche Farbe überwiegt. Kommt ein neuer Bogen dazu, findet das Werkzeug
ihn von selbst, solange die Machart dieselbe bleibt.

| Datei | Was es ist |
|-------|------------|
| `held.webp` | Portrait des Helden — das Symbol für die Spielkachel |
| `held-1..8.webp` | Posen mit offenem Mund: Sprung, Fall, Schuss (7), K.-o. (8) |
| `held-zu-1..6.webp` | Dieselben Posen mit geschlossenem Mund — das ruhige Gesicht |
| `maus.webp`, `maus-1..8.webp` | Fledermaus: Flugbilder, Aufladen (6), Spucken (7), K.-o. (8) |
| `feuerball-1/2.webp` | Die blauen Feuerbälle des Helden, im Wechsel gezeichnet |
| `feuerball-lila.webp` | Was die Fledermäuse ab Stufe 6 spucken |
| `feder.webp` | Sprungfeder — schleudert mehr als doppelt so hoch |
| `platte-1..3.webp` | Plattform: heil, rissig (bröckelt), zerbrochen |
| `wolke-1..3.webp` | Wolken als Zwischenschicht, ziehen langsamer |
| `himmel.webp` | Der senkrechte Himmel, wird gekachelt und langsam mitgezogen |

Die Vorlagen bleiben liegen, damit sich der Schnitt jederzeit wiederholen
lässt.
