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
PAD = 22                    # Mindest-Luft rundum, in Pixeln des Originals
QUALITY = 85


def expand(im, left, top, right, bottom):
    """Rand anlegen, indem die Randpixel fortgesetzt werden.

    Ein einfarbiger Rand wuerde bei Decks mit getoentem Papier (Excaliber)
    als sichtbarer Balken stehen.
    """
    w, h = im.size
    out = Image.new('RGB', (w + left + right, h + top + bottom))
    out.paste(im, (left, top))
    if top:
        out.paste(im.crop((0, 0, w, 1)).resize((w, top)), (left, 0))
    if bottom:
        out.paste(im.crop((0, h - 1, w, h)).resize((w, bottom)), (left, h + top))
    if left:
        out.paste(im.crop((0, 0, 1, h)).resize((left, h)), (0, top))
    if right:
        out.paste(im.crop((w - 1, 0, w, h)).resize((right, h)), (w + left, top))
    for bx, by, bw, bh, src in [(0, 0, left, top, (0, 0)),
                                (w + left, 0, right, top, (w - 1, 0)),
                                (0, h + top, left, bottom, (0, h - 1)),
                                (w + left, h + top, right, bottom, (w - 1, h - 1))]:
        if bw and bh:
            out.paste(im.getpixel(src), (bx, by, bx + bw, by + bh))
    return out


def fit(im, pad):
    """Auf das Zielverhaeltnis bringen, ohne die Grafik zu verzerren.

    Erst die Mindest-Luft rundum, dann auf der Achse nachlegen, die noch zu
    knapp ist. Wuerde man stattdessen hart auf CARD_W x CARD_H skalieren,
    zieht sich jedes Deck mit abweichendem Verhaeltnis in die Breite — und
    genau das macht object-fit:contain danach als helle Balken sichtbar.
    """
    w, h = im.size
    bw, bh = w + 2 * pad, h + 2 * pad
    target = CARD_W / CARD_H
    if bw / bh > target:            # zu breit -> oben und unten auffuellen
        bh = round(bw / target)
    else:                           # zu schmal -> links und rechts auffuellen
        bw = round(bh * target)
    ex, ey = bw - w, bh - h
    return expand(im, ex // 2, ey // 2, ex - ex // 2, ey - ey // 2)


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

        if im.size == (CARD_W, CARD_H) and not force:
            continue
        # Die Rueckseite laeuft durch dieselbe Muehle: sie steckt im selben
        # .card-Kasten, also muss sie dasselbe Verhaeltnis haben. Weil fit()
        # nur auffuellt und nie beschneidet, bleibt das Muster vollstaendig.
        out = fit(im, 0 if is_back else PAD).resize((CARD_W, CARD_H), Image.LANCZOS)

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
