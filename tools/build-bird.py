#!/usr/bin/env python3
"""
Zerlegt die Vorlage assets/bird/*.png in einzelne Spielbilder.

Die Vorlage ist ein Blatt mit durchsichtigem Hintergrund im oberen Teil
(Vogel, Federn, Röhren) und einer gemalten Kulisse im unteren Teil. Die
Kästen kommen nicht aus dem Bauch, sondern aus der Alpha-Maske: zusammen-
hängende Flecken werden gesucht und danach von links nach rechts, von oben
nach unten sortiert. So bleibt der Schnitt reproduzierbar, auch wenn die
Vorlage einmal neu erzeugt wird.

Aufruf:  python3 tools/build-bird.py
"""
import os
import sys
import numpy as np
from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = os.path.join(WURZEL, 'assets', 'bird')
ZIEL = os.path.join(WURZEL, 'assets', 'bird')

# Unterhalb dieser Zeile steht die Kulisse, darüber das Blatt mit den Sprites.
SCHNITT = 530
# So hoch liegt die Oberkante des grünen Bodenstreifens in der Kulisse.
BODEN_OBEN = 852


def vorlage():
    for name in sorted(os.listdir(QUELLE)):
        if name.lower().endswith('.png'):
            return os.path.join(QUELLE, name)
    sys.exit('Keine PNG-Vorlage unter assets/bird gefunden.')


def flecken(maske, mindest=400):
    """Zusammenhängende Flecken (4er-Nachbarschaft) als Kästen."""
    h, w = maske.shape
    gesehen = np.zeros((h, w), bool)
    kaesten = []
    for y0 in range(h):
        zeile = maske[y0]
        for x0 in range(w):
            if not zeile[x0] or gesehen[y0, x0]:
                continue
            stapel = [(y0, x0)]
            gesehen[y0, x0] = True
            x1 = x2 = x0
            y1 = y2 = y0
            n = 0
            while stapel:
                y, x = stapel.pop()
                n += 1
                if x < x1: x1 = x
                if x > x2: x2 = x
                if y < y1: y1 = y
                if y > y2: y2 = y
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and maske[ny, nx] and not gesehen[ny, nx]:
                        gesehen[ny, nx] = True
                        stapel.append((ny, nx))
            if n >= mindest:
                kaesten.append([x1, y1, x2, y2, n])
    return kaesten


def zeilenweise(kaesten, toleranz=40):
    """Von oben nach unten, innerhalb einer Zeile von links nach rechts."""
    return sorted(kaesten, key=lambda k: (k[1] // toleranz, k[0]))


def sichern(bild, name, breite=None):
    if breite and bild.width > breite:
        hoehe = max(1, round(bild.height * breite / bild.width))
        bild = bild.resize((breite, hoehe), Image.LANCZOS)
    pfad = os.path.join(ZIEL, name)
    bild.save(pfad, 'WEBP', quality=90, method=6)
    print('%-22s %4dx%-4d %6.1f KB' % (name, bild.width, bild.height,
                                       os.path.getsize(pfad) / 1024))


def zuschnitt(bild, kasten, rand=2):
    x1, y1, x2, y2 = kasten[:4]
    return bild.crop((max(0, x1 - rand), max(0, y1 - rand),
                      min(bild.width, x2 + 1 + rand), min(bild.height, y2 + 1 + rand)))


def main():
    quelle = vorlage()
    print('Vorlage:', os.path.basename(quelle))
    bild = Image.open(quelle).convert('RGBA')
    alpha = np.asarray(bild)[..., 3]

    blatt = alpha[:SCHNITT, :] > 100
    alle = zeilenweise(flecken(blatt))

    # Die Röhren stehen rechts (x > 900), der Vogel und die Federn links.
    links = [k for k in alle if k[0] < 900]
    rechts = [k for k in alle if k[0] >= 900]

    # ── Vogel ──────────────────────────────────────────────────────────
    # Der große Kopf oben links ist das Aushängeschild (das Symbol für die
    # Kachel), danach folgen zwei Reihen Flügelschläge und eine Reihe mit
    # den Sturzbildern.
    gross = max(links, key=lambda k: k[4])
    sichern(zuschnitt(bild, gross), 'vogel.webp', 260)

    voegel = [k for k in links if k is not gross and (k[2] - k[0]) > 80 and (k[3] - k[1]) > 60]
    voegel = zeilenweise(voegel)
    flug = voegel[:8]
    sturz = voegel[8:12]
    for i, k in enumerate(flug):
        sichern(zuschnitt(bild, k), 'flug-%d.webp' % (i + 1), 190)
    for i, k in enumerate(sturz):
        sichern(zuschnitt(bild, k), 'sturz-%d.webp' % (i + 1), 190)

    # ── Federn ─────────────────────────────────────────────────────────
    federn = [k for k in links if k not in voegel and k is not gross]
    federn = sorted(federn, key=lambda k: -k[4])[:3]
    for i, k in enumerate(zeilenweise(federn)):
        sichern(zuschnitt(bild, k), 'feder-%d.webp' % (i + 1), 90)

    # ── Röhren ─────────────────────────────────────────────────────────
    # Rechts stehen vier Einzelteile untereinander: Mündung, Mündung,
    # bemooste Mündung, Rohrstück. Die beiden großen Röhren links daneben
    # sind fertige Säulen — die brauchen wir nicht, das Spiel baut sich die
    # Röhre aus Mündung und Rohrstück in jeder gewünschten Länge zusammen.
    spalte = [k for k in rechts if k[0] > 1330]
    spalte = sorted(spalte, key=lambda k: k[1])
    if len(spalte) >= 4:
        # Das erste Teil ist Mündung samt Schaftstück. Beides wird getrennt:
        # die Mündung steht breit an der Lücke, der Schaft ist schmaler und
        # wird im Spiel auf jede Länge gezogen. Getrennt wird dort, wo das
        # Bild schmaler wird — gemessen, nicht geraten.
        kopf = zuschnitt(bild, spalte[0], 0)
        a = np.asarray(kopf)[..., 3] > 100
        breit = a.sum(axis=1)
        voll = breit.max()
        knick = next((y for y in range(len(breit)) if breit[y] < voll * 0.88), len(breit) - 1)
        sichern(kopf.crop((0, 0, kopf.width, knick + 2)), 'rohr-muendung.webp', 200)
        # Vom Schaft nur ein Stück aus der Mitte: die Enden sind gerundet und
        # würden sich beim Strecken als Wulst über die ganze Röhre ziehen.
        s1 = knick + int((kopf.height - knick) * 0.25)
        s2 = knick + int((kopf.height - knick) * 0.75)
        schaft = kopf.crop((0, s1, kopf.width, s2))
        sa = np.asarray(schaft)[..., 3] > 100
        spalten = np.where(sa.any(axis=0))[0]
        schaft = schaft.crop((int(spalten[0]), 0, int(spalten[-1]) + 1, schaft.height))
        sichern(schaft, 'rohr-schaft.webp', 160)
        sichern(zuschnitt(bild, spalte[2]), 'rohr-moos.webp', 200)

    # ── Kulisse ────────────────────────────────────────────────────────
    # Der untere Teil ist ein durchgehendes Bild: Himmel mit Wolken, Skyline
    # und Büschen, darunter der grüne Bodenstreifen mit Erde. Beides wird
    # getrennt, damit es im Spiel verschieden schnell ziehen kann.
    himmel = bild.crop((0, SCHNITT + 16, bild.width, BODEN_OBEN)).convert('RGB')
    sichern(himmel, 'himmel.webp', 1200)
    boden = bild.crop((0, BODEN_OBEN, bild.width, bild.height)).convert('RGB')
    sichern(boden, 'boden.webp', 1200)


if __name__ == '__main__':
    main()
