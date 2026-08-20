# Gemalte Symbole

Die WebP-Dateien hier sind die Symbole, die `GK.iconHTML(name)` lädt — der
Name ist der Dateiname ohne Endung, die Liste steht in `js/icons.js`.
Freigestellt, transparenter Grund, längste Kante meist 100 bis 320 Pixel.

## Partymodus

Zwei Dateien aus derselben Vorlage (`party.png`, 1254 × 1254):

* **`party.webp`** — das ganze Motiv mit Konfetti und Luftschlangen, 260 px.
  Nur dort einsetzen, wo es groß dargestellt wird: im Dialog bei 112 px.
* **`partychip.webp`** — nur der Chip in der Mitte, 160 px. Überall sonst.

Der Grund für die zweite Datei ist gemessen und nicht Geschmack: unterhalb
von etwa vierzig Pixeln zerfällt das ganze Motiv zu einem bunten Fleck, weil
das Konfetti drumherum den Chip kleinrechnet. Der engere Ausschnitt bleibt
bis hinunter zu zwanzig Pixeln als runder Chip mit Pik erkennbar — und genau
so klein steht er im Kopf der Party-Rangliste.

Neu schneiden, wenn sich die Vorlage ändert:

```python
from PIL import Image
im = Image.open('assets/symbols/party.png').convert('RGBA')
im = im.crop(im.getbbox())                       # transparenten Rand weg
f = 260 / max(im.size)
im.resize((round(im.width*f), round(im.height*f)), Image.LANCZOS) \
  .save('assets/symbols/party.webp', 'WEBP', quality=90, method=6)
im.crop((232, 197, 1052, 1017)).resize((160, 160), Image.LANCZOS) \
  .save('assets/symbols/partychip.webp', 'WEBP', quality=90, method=6)
```

Fehlt eine Symboldatei, blendet sich das Bild aus, statt als kaputtes Symbol
stehenzubleiben — siehe `GK.iconHTML` in `js/icons.js`.
