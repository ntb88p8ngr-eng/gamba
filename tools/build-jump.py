#!/usr/bin/env python3
"""
Zerlegt die Vorlagen unter assets/jump in einzelne Spielbilder.

Dort liegen: zwei Einzelportraits (Held, Fledermaus), drei Feuerbälle (zwei
blaue, ein lila), die Sprungfeder, ein Streifen mit drei Plattformen, einer
mit drei Wolken, der senkrechte Himmel und drei Bögen mit Posen — Held mit
offenem Mund (4x2), Held mit geschlossenem Mund (3x2) und Fledermaus (4x2).

Zugeordnet wird nicht über Dateinamen — die heißen alle "ChatGPT Image …" —,
sondern über Form und Inhalt: Seitenverhältnis, Zahl der freistehenden
Flecken und die vorherrschende Farbe. So bleibt der Schnitt auch dann
richtig, wenn die Dateien anders heißen oder in anderer Reihenfolge kommen.

Aufruf:  python3 tools/build-jump.py
"""
import os
import sys
import numpy as np
from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDNER = os.path.join(WURZEL, 'assets', 'jump')


def sichern(bild, name, breite=None):
    if breite and bild.width > breite:
        hoehe = max(1, round(bild.height * breite / bild.width))
        bild = bild.resize((breite, hoehe), Image.LANCZOS)
    pfad = os.path.join(ORDNER, name)
    if bild.mode == 'RGBA':
        bild.save(pfad, 'WEBP', quality=90, method=6)
    else:
        bild.save(pfad, 'WEBP', quality=88, method=6)
    print('%-20s %4dx%-4d %6.1f KB' % (name, bild.width, bild.height,
                                       os.path.getsize(pfad) / 1024))


def zuschnitt_alpha(bild, rand=4):
    """Auf die sichtbaren Bildpunkte zurechtstutzen."""
    a = np.asarray(bild)[..., 3] > 90
    if not a.any():
        return bild
    ys, xs = np.where(a)
    return bild.crop((max(0, int(xs.min()) - rand), max(0, int(ys.min()) - rand),
                      min(bild.width, int(xs.max()) + 1 + rand),
                      min(bild.height, int(ys.max()) + 1 + rand)))


def raster(bild, spalten, zeilen):
    """Ein gleichmäßiges Blatt in seine Zellen zerlegen und jede zurechtstutzen."""
    bw, bh = bild.width // spalten, bild.height // zeilen
    raus = []
    for z in range(zeilen):
        for sp in range(spalten):
            zelle = bild.crop((sp * bw, z * bh, (sp + 1) * bw, (z + 1) * bh))
            raus.append(zuschnitt_alpha(zelle))
    return raus


def mittelfarbe(bild):
    """Mittlere Farbe der sichtbaren Bildpunkte."""
    a = np.asarray(bild.convert('RGBA')).astype(np.float32)
    m = a[..., 3] > 100
    if not m.any():
        return (0.0, 0.0, 0.0)
    return tuple(float(a[..., i][m].mean()) for i in range(3))


def einlesen():
    dateien = [f for f in sorted(os.listdir(ORDNER))
               if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not dateien:
        sys.exit('Keine Vorlagen unter assets/jump gefunden.')
    raus = []
    for name in dateien:
        bild = Image.open(os.path.join(ORDNER, name))
        raus.append({'name': name, 'alpha': bild.mode in ('RGBA', 'LA'),
                     'bild': bild.convert('RGBA'),
                     'seite': bild.width / bild.height})
    return raus


def spaltenzahl(bild, moeglich=(3, 4, 5)):
    """
    Wie viele Posen stehen nebeneinander?

    Probiert die möglichen Aufteilungen durch und nimmt die, deren Schnitte
    durch leere Stellen laufen. Lücken zu zählen reicht nicht: manche Posen
    haben abstehende Zipfel, die die Nachbarzelle berühren, und dann kommt
    eine Spalte zu viel heraus.
    """
    a = np.asarray(bild)[..., 3] > 90
    best, bester_wert = moeglich[0], 1.0
    for n in moeglich:
        breite = bild.width / n
        werte = []
        for i in range(1, n):
            x = int(round(i * breite))
            band = a[:, max(0, x - 4):x + 4]
            werte.append(float(band.mean()) if band.size else 1.0)
        wert = max(werte) if werte else 1.0
        if wert < bester_wert - 0.002:
            best, bester_wert = n, wert
    return best


def main():
    schub = einlesen()
    for s in schub:
        print('%-46s %4dx%-4d %s' % (s['name'][:46], s['bild'].width, s['bild'].height,
                                     'mit Alpha' if s['alpha'] else 'ohne Alpha'))

    # Einsortiert wird nach Bauart, nicht nach Dateiname: die Vorlagen heißen
    # alle "ChatGPT Image …".
    himmel = [s for s in schub if not s['alpha']]
    einzeln = [s for s in schub if s['alpha'] and 0.9 < s['seite'] < 1.1]
    streifen = [s for s in schub if s['alpha'] and s['seite'] > 2.4]
    boegen = [s for s in schub if s['alpha'] and 1.1 <= s['seite'] <= 2.4]

    # ── Himmel ──────────────────────────────────────────────────────────
    for s in himmel:
        sichern(s['bild'].convert('RGB'), 'himmel.webp', 480)

    # ── Einzelbilder: Held, Fledermaus, Feuerbälle, Sprungfeder ─────────
    # Erkannt an zwei Merkmalen des freigestellten Inhalts: hochkant oder
    # quer, und die vorherrschende Farbe. Ein Feuerball ist quer und leuchtet
    # (heller Kern), die Fledermaus ist quer und stumpf lila, Held und
    # Sprungfeder stehen hochkant.
    blaue = []
    for s in sorted(einzeln, key=lambda s: s['name']):
        bild = zuschnitt_alpha(s['bild'])
        quer = bild.width / bild.height
        r, g, b = mittelfarbe(bild)
        if quer < 1.2:
            sichern(bild, 'held.webp' if g > r and g > b else 'feder.webp', 260)
        elif g > 120 and b > 150:
            blaue.append(bild)
        elif r > 150:
            sichern(bild, 'feuerball-lila.webp', 260)
        else:
            sichern(bild, 'maus.webp', 260)
    for i, bild in enumerate(blaue):
        sichern(bild, 'feuerball-%d.webp' % (i + 1), 260)

    # ── Streifen mit je drei Teilen: Plattformen und Wolken ─────────────
    if streifen:
        hell = max(streifen, key=lambda s: mittelfarbe(s['bild'])[2])
        for s in streifen:
            vorsatz = 'wolke' if s is hell else 'platte'
            for i, teil in enumerate(raster(s['bild'], 3, 1)):
                sichern(teil, '%s-%d.webp' % (vorsatz, i + 1), 300)

    # ── Bögen mit Posen: Held (offen), Held (Mund zu), Fledermaus ───────
    for s in boegen:
        sp = spaltenzahl(s['bild'])
        r, g, b = mittelfarbe(s['bild'])
        if g > b:
            vorsatz = 'held' if sp >= 4 else 'held-zu'
        else:
            vorsatz = 'maus'
        for i, teil in enumerate(raster(s['bild'], sp, 2)):
            sichern(teil, '%s-%d.webp' % (vorsatz, i + 1), 200)


if __name__ == '__main__':
    main()
