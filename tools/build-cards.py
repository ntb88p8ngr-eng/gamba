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

CARD_W, CARD_H = 260, 358   # muss zu aspect in GK.CARD_THEMES passen
PAD = 22                    # Luft rundum, in Pixeln des Originals
QUALITY = 85


def expand(im, pad):
    """Rand anlegen, indem die Randpixel fortgesetzt werden.

    Ein einfarbiger Rand wuerde bei Decks mit getoentem Papier (Excaliber)
    als sichtbarer Balken stehen.
    """
    w, h = im.size
    out = Image.new('RGB', (w + 2 * pad, h + 2 * pad))
    out.paste(im, (pad, pad))
    out.paste(im.crop((0, 0, w, 1)).resize((w, pad)), (pad, 0))
    out.paste(im.crop((0, h - 1, w, h)).resize((w, pad)), (pad, h + pad))
    out.paste(im.crop((0, 0, 1, h)).resize((pad, h)), (0, pad))
    out.paste(im.crop((w - 1, 0, w, h)).resize((pad, h)), (w + pad, pad))
    for bx, by, src in [(0, 0, (0, 0)), (w + pad, 0, (w - 1, 0)),
                        (0, h + pad, (0, h - 1)), (w + pad, h + pad, (w - 1, h - 1))]:
        out.paste(im.getpixel(src), (bx, by, bx + pad, by + pad))
    return out


def build(theme, force=False):
    files = sorted(glob.glob(os.path.join(THEMES_DIR, theme, '*.webp')))
    if not files:
        print('  %-12s keine Dateien gefunden' % theme)
        return 0
    done = 0
    for path in files:
        is_back = os.path.basename(path).lower() == 'back.webp'
        im = Image.open(path)
        im.load()
        im = im.convert('RGB')

        if is_back:
            # Die Rueckseite behaelt ihr eigenes Seitenverhaeltnis — sie zeigt
            # ein Muster, das ein erzwungener Zuschnitt nur beschneiden wuerde.
            if im.width == CARD_W and not force:
                continue
            out = im.resize((CARD_W, round(CARD_W * im.height / im.width)), Image.LANCZOS)
        else:
            if im.size == (CARD_W, CARD_H) and not force:
                continue
            out = expand(im, PAD).resize((CARD_W, CARD_H), Image.LANCZOS)

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
    print('Kartendecks -> %dx%d, Rand %dpx, WEBP q%d' % (CARD_W, CARD_H, PAD, QUALITY))
    total = sum(build(t, force) for t in themes)
    print('Fertig, %d Karten geschrieben.' % total)


if __name__ == '__main__':
    main()
