#!/usr/bin/env python3
"""Hintergrundbild für den Skin „Old Vegas".

Zwei Wege:

    python3 tools/build-skin-oldvegas.py foto.png
        Nimmt ein eigenes Bild, skaliert es auf Bildschirmgröße und
        speichert es als .webp — ein PNG von zwei Megabyte lädt am Handy
        spürbar langsam, dasselbe Bild als webp wiegt einen Bruchteil.

    python3 tools/build-skin-oldvegas.py
        Ohne Vorlage wird ein Ersatz gemalt: dunkelroter Samt mit
        Damast-Muster, Lichtkegel und Vignette.

Abgedunkelt wird nicht hier, sondern in css/skins.css: dort liegt ein
Schleier über dem Bild. So bleibt die Datei das Original, und wie dunkel
es am Ende wirkt, lässt sich ohne neues Bild nachregeln.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

BREIT, HOCH = 1920, 1080
ZIEL = os.path.join(os.path.dirname(__file__), '..', 'assets', 'skins',
                    'old-vegas', 'hintergrund.webp')


def damast(breit, hoch, teilung=120):
    """Ein weiches Rautenmuster — angedeuteter Samt, kein Fototapete-Kitsch."""
    y, x = np.mgrid[0:hoch, 0:breit].astype(np.float32)
    # Zwei gegenläufige Wellen ergeben Rauten; die dritte bricht die Regelmäßigkeit
    a = np.sin((x + y) * math.pi / teilung)
    b = np.sin((x - y) * math.pi / teilung)
    c = np.sin(x * math.pi / (teilung * 3.0)) * np.sin(y * math.pi / (teilung * 2.0))
    m = (a * b) * 0.5 + c * 0.25
    return np.clip(m * 0.5 + 0.5, 0, 1)


def radial(breit, hoch, cx, cy, radius):
    """Weicher runder Verlauf, 1 in der Mitte, 0 am Rand."""
    y, x = np.mgrid[0:hoch, 0:breit].astype(np.float32)
    d = np.sqrt(((x - cx) / radius) ** 2 + ((y - cy) / radius) ** 2)
    return np.clip(1.0 - d, 0, 1) ** 1.6


def gemalt():
    """Der Ersatz, falls kein eigenes Bild vorliegt."""
    muster = damast(BREIT, HOCH)

    # Grundton: tiefes Weinrot, oben eine Spur heller als unten
    y = np.linspace(0, 1, HOCH, dtype=np.float32)[:, None]
    r = (0.115 - 0.045 * y) + muster * 0.075
    g = (0.018 - 0.008 * y) + muster * 0.014
    b = (0.030 - 0.012 * y) + muster * 0.020

    # Ein warmer Kegel von oben Mitte, wie ein Scheinwerfer über dem Tisch
    kegel = radial(BREIT, HOCH, BREIT * 0.5, HOCH * -0.15, HOCH * 1.35)
    r += kegel * 0.20
    g += kegel * 0.085
    b += kegel * 0.020

    # Zwei kleine Lichter an den Seiten, damit die Ecken nicht tot wirken
    for cx, cy, rad, kraft in ((BREIT * 0.08, HOCH * 0.72, HOCH * 0.85, 0.10),
                               (BREIT * 0.94, HOCH * 0.30, HOCH * 0.75, 0.08)):
        f = radial(BREIT, HOCH, cx, cy, rad)
        r += f * kraft
        g += f * kraft * 0.42
        b += f * kraft * 0.10

    # Vignette: zum Rand hin fällt alles ab
    vig = 0.35 + 0.65 * radial(BREIT, HOCH, BREIT * 0.5, HOCH * 0.45, HOCH * 1.25)
    r *= vig
    g *= vig
    b *= vig

    bild = np.clip(np.dstack([r, g, b]) * 255, 0, 255).astype(np.uint8)
    im = Image.fromarray(bild, 'RGB').filter(ImageFilter.GaussianBlur(0.6))

    # Feines Korn, sonst sieht der Verlauf am Bildschirm streifig aus
    rng = np.random.default_rng(7)
    korn = rng.normal(0, 3.2, (HOCH, BREIT, 1)).astype(np.float32)
    return Image.fromarray(
        np.clip(np.asarray(im, dtype=np.float32) + korn, 0, 255).astype(np.uint8), 'RGB')


def aus_datei(pfad):
    """Eigenes Bild einlesen und auf Bildschirmgröße bringen."""
    im = Image.open(pfad).convert('RGB')
    # Auf die Zielhöhe skalieren und mittig beschneiden — die Seite zeigt das
    # Bild mit background-size: cover, also genau so.
    faktor = max(BREIT / im.width, HOCH / im.height)
    neu = (max(BREIT, int(round(im.width * faktor))), max(HOCH, int(round(im.height * faktor))))
    im = im.resize(neu, Image.LANCZOS)
    links = (im.width - BREIT) // 2
    oben = (im.height - HOCH) // 2
    return im.crop((links, oben, links + BREIT, oben + HOCH))


def main():
    quelle = sys.argv[1] if len(sys.argv) > 1 else None
    im = aus_datei(quelle) if quelle else gemalt()
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    im.save(ZIEL, 'WEBP', quality=80, method=6)
    print('geschrieben:', os.path.relpath(ZIEL), im.size,
          '%.0f KB' % (os.path.getsize(ZIEL) / 1024),
          '(aus %s)' % quelle if quelle else '(gemalt)')


if __name__ == '__main__':
    main()
