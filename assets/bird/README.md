# Bilder für den Flatterflug

Alles hier kommt aus der Vorlage `ChatGPT Image 20. Aug. 2026, 23_39_54.png`
(1536 × 1024). Geschnitten wird nicht von Hand, sondern mit

```
python3 tools/build-bird.py
```

Das Werkzeug sucht die Teile über die Alpha-Maske der Vorlage — der obere Teil
des Blattes ist freigestellt, der untere ist die gemalte Kulisse. Wird die
Vorlage neu erzeugt, findet der Schnitt die Teile wieder von selbst, solange
die Anordnung dieselbe bleibt.

| Datei | Was es ist |
|-------|------------|
| `vogel.webp` | Der große Vogel oben links — das Symbol für die Spielkachel (`GK.iconHTML('vogel')`) |
| `flug-1..8.webp` | Flügelschläge; das Spiel spielt sechs davon im Wechsel ab |
| `sturz-1..4.webp` | Sturzbilder mit Kreuzaugen; `sturz-2` zeigt der Absturz |
| `feder-1..3.webp` | Einzelne Federn für den Staub beim Flattern und den Ausbruch beim Absturz |
| `rohr-muendung.webp` | Die breite Mündung; oben gespiegelt, damit sie nach unten zeigt |
| `rohr-schaft.webp` | Ein kurzes Stück Rohr aus der Bildmitte, im Spiel auf jede Länge gezogen |
| `rohr-moos.webp` | Die bemooste Mündung für die untere Röhre |
| `himmel.webp` | Kulisse mit Wolken, Skyline und Büschen — zieht langsam |
| `boden.webp` | Grüner Streifen samt Erde — zieht im Tempo der Röhren |

Warum Mündung und Schaft getrennt sind: gekachelt sah die Röhre aus wie ein
Stapel Ringe, weil jedes Rohrstück oben und unten seinen eigenen Rand
mitbringt. Ein Streifen aus der Mitte hat den nicht und lässt sich beliebig
strecken; die Mündung sitzt breit davor und macht daraus wieder eine Röhre.

Die Vorlage bleibt liegen, damit sich der Schnitt jederzeit wiederholen lässt.
