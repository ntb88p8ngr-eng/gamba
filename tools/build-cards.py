#!/usr/bin/env python3
"""Kartendecks auf ein einheitliches Format bringen.

Jedes Deck kommt in einer anderen Groesse an (550x800, 550x784, 260x366 ...).
Dieses Skript legt einen Rand um jede Karte und skaliert sie auf ein
gemeinsames Mass. Der Rand ist noetig, weil .card die Ecken abrundet und ohne
Luft die Eckzahlen angeschnitten werden.

  python3 tools/build-cards.py              # alle Decks
  python3 tools/build-cards.py eerie        # nur bestimmte Decks
  python3 tools/build-cards.py --force      # auch schon passende neu rendern

Das Skript ist idempotent: Karten, die bereits die Zielgroesse haben, werden
uebersprungen. Zweimal laufen lassen schadet also nicht.
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
THEMES_DIR = os.path.join(ROOT, 'assets', 'cards', 'themes')

CARD_W, CARD_H = 260, 364   # muss zu aspect in GK.CARD_THEMES passen
QUALITY = 85


def fit(im):
    """Mittig auf das Zielverhaeltnis beschneiden.

    Beschneiden statt Rand anlegen: eine fortgesetzte Randreihe schleppt
    jeden Rest mit, der im Original am aeussersten Pixel klebt. Bei Eerie und
    Prismnight sass dort ein heller Sprenkel vom Scan, aus dem prompt ein
    weisser Eckklotz wurde. Was hier wegfaellt, ist der dunkle Ueberstand
    ausserhalb der abgerundeten Blattecke — kein Motiv.

    Hart auf CARD_W x CARD_H zu skalieren geht nicht: Decks mit abweichendem
    Verhaeltnis zoegen sich in die Breite.
    """
    w, h = im.size
    target = CARD_W / CARD_H
    if w / h > target:              # zu breit -> seitlich beschneiden
        nw = round(h * target)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w / target)          # zu hoch -> oben und unten beschneiden
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def build(theme, force=False):
    files = sorted(glob.glob(os.path.join(THEMES_DIR, theme, '*.webp')))
    if not files:
        print('  %-12s keine Dateien gefunden' % theme)
        return 0
    done = 0
    for path in files:
        im = Image.open(path)
        im.load()
        im = im.convert('RGB')

        if im.size == (CARD_W, CARD_H) and not force:
            continue
        # Die Rueckseite laeuft durch dieselbe Muehle: sie steckt im selben
        # .card-Kasten, also braucht sie dasselbe Verhaeltnis.
        out = fit(im).resize((CARD_W, CARD_H), Image.LANCZOS)

        out.save(path, 'WEBP', quality=QUALITY)
        done += 1
    print('  %-12s %2d von %d Karten neu gerendert' % (theme, done, len(files)))
    return done


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    force = '--force' in sys.argv[1:]
    themes = args or sorted(
        d for d in os.listdir(THEMES_DIR)
        if os.path.isdir(os.path.join(THEMES_DIR, d))
    )
    print('Kartendecks -> %dx%d, mittig beschnitten, WEBP q%d' % (CARD_W, CARD_H, QUALITY))
    total = sum(build(t, force) for t in themes)
    print('Fertig, %d Karten geschrieben.' % total)


if __name__ == '__main__':
    main()
