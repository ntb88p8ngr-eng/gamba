#!/usr/bin/env python3
"""Aus einem Foto eines deutschen Blatts die einzelnen Karten schneiden.

    python3 tools/build-watten.py assets/cards/watten/quelle.png

Erwartet ein Foto, auf dem alle 36 Karten in vier Reihen zu je neun Karten
liegen — Reihenfolge wie im Blatt ueblich:

    Reihe 1  Herz        Spalten 6 7 8 9 10 Unter Ober Koenig Ass
    Reihe 2  Eichel
    Reihe 3  Gras (Laub)
    Reihe 4  Schellen

Heraus kommen die Dateien, die GK.cardEl erwartet — 7H.webp, 10C.webp und so
weiter — plus die vier Farbzeichen fuer die Trumpfanzeige. Die Sechser
braucht Watten nicht, sie werden uebersprungen.

Drei Schritte:

  1. Begradigen. Ein Foto liegt nie ganz gerade. Der Winkel kommt aus der
     Oberkante der ersten Kartenreihe: fuer jede Bildspalte die erste helle
     Zeile suchen und durch diese Punkte eine Gerade legen. Luecken zwischen
     den Karten sind Ausreisser und fallen ueber zwei Ausgleichsrunden weg.

  2. Raster finden. Nach dem Begradigen sind Kartenreihen und -spalten
     achsenparallel. Wo Karten liegen, ist es hell; dazwischen dunkel. Aus
     dem zeilen- und spaltenweisen Anteil heller Pixel ergeben sich die
     Bloecke von selbst — feste Pixelwerte waeren beim naechsten Foto falsch.

  3. Zuschneiden. Jede Karte wird auf ihren weissen Rand getrimmt, mittig auf
     das Seitenverhaeltnis der uebrigen Decks gebracht (260 zu 364) und als
     WebP gespeichert.

Die Farbzeichen kommen aus der Zehn jeder Reihe: dort liegen die Zeichen
gross und frei, ohne Figur daneben. Genommen wird das oberste, der weisse
Grund wird durchsichtig.
"""
import os
import sys

import numpy as np
from PIL import Image

RANG = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']   # Unter = J, Ober = Q, Sau = A
OHNE = {'6'}                                            # Watten spielt ohne Sechser
# Reihenfolge der Reihen im Foto; Buchstabe = Dateiname wie in den anderen Decks
REIHEN = [('herz', 'H'), ('eichel', 'C'), ('gras', 'S'), ('schellen', 'D')]

ZIEL = (260, 364)
GRUND = (214, 210, 180)     # Tischfarbe, fuer die Ecken beim Drehen


def _otsu(hist):
    """Der Schnitt, der zwei Helligkeitsgruppen am besten trennt."""
    stufen = np.arange(len(hist), dtype=float)
    gesamt = hist.sum()
    if gesamt <= 0:
        return 0
    w0 = np.cumsum(hist)
    w1 = gesamt - w0
    s0 = np.cumsum(hist * stufen)
    s1 = s0[-1] - s0
    gut = (w0 > 0) & (w1 > 0)
    zwischen = np.zeros_like(stufen)
    zwischen[gut] = (w0[gut] * w1[gut] *
                     ((s0[gut] / w0[gut]) - (s1[gut] / w1[gut])) ** 2)
    return int(np.argmax(zwischen))


def _mitte(hist, t):
    """Mittelwerte links und rechts von t."""
    stufen = np.arange(len(hist), dtype=float)
    links, rechts = hist[:t + 1], hist[t + 1:]
    ml = (links * stufen[:t + 1]).sum() / links.sum() if links.sum() else 0.0
    mr = (rechts * stufen[t + 1:]).sum() / rechts.sum() if rechts.sum() else 255.0
    return ml, mr


def _schwelle(werte):
    """Trennwert zwischen Tisch und Karte, aus dem Bild selbst bestimmt.

    Feste Werte gehen schief: ein beiger Tisch liegt je nach Licht mal bei
    180, mal bei 210. Geteilt wird zweimal — der erste Schnitt trennt die
    dunkle Druckfarbe vom Rest, der zweite den Tisch von den Karten.

    Zurueck kommt die Mitte zwischen den beiden Gruppen, nicht der
    Otsu-Wert selbst: der kann genau auf der Kartenhelligkeit liegen, und
    dann faellt bei einem strengen Vergleich die halbe Karte weg.
    """
    hist = np.bincount(werte.ravel(), minlength=256).astype(float)
    tinte = _otsu(hist)
    oben = hist.copy()
    oben[:tinte + 1] = 0
    if oben.sum() <= 0:
        return tinte
    t = _otsu(oben)
    tisch, karte = _mitte(oben, t)
    if karte <= tisch:
        return int(t)
    return int(round(min(255.0, max(0.0, (tisch + karte) / 2))))


def hell_maske(bild):
    """Karte oder Tisch? Karten sind das hellste und farbloseste im Bild."""
    a = np.asarray(bild.convert('RGB')).astype(np.int16)
    tiefstes = a.min(axis=2).astype(np.uint8)
    grenze = max(_schwelle(tiefstes), 150)
    return (tiefstes > grenze) & (a.max(axis=2) - a.min(axis=2) < 60)


def begradigen(bild):
    maske = hell_maske(bild)
    H, W = maske.shape
    punkte = []
    for x in range(0, W, 3):
        treffer = np.flatnonzero(maske[:, x])
        if treffer.size and treffer[0] < H * 0.3:
            punkte.append((x, treffer[0]))
    if len(punkte) < 30:
        print('  Oberkante nicht sicher erkannt — Bild bleibt, wie es ist.')
        return bild, 0.0

    p = np.array(punkte, float)
    k = 0.0
    for _ in range(3):
        k, d = np.polyfit(p[:, 0], p[:, 1], 1)
        rest = p[:, 1] - (k * p[:, 0] + d)
        p = p[np.abs(rest) < max(3.0, 2.5 * np.std(rest))]
        if len(p) < 20:
            break
    winkel = float(np.degrees(np.arctan(k)))
    if abs(winkel) < 0.05:
        return bild, winkel
    gerade = bild.rotate(winkel, resample=Image.BICUBIC, expand=True, fillcolor=GRUND)
    return gerade, winkel


def bloecke(anteil, schwelle=0.25, mindest=20):
    """Zusammenhaengende Bereiche, in denen genug helle Pixel liegen."""
    drin = anteil > schwelle
    out, start = [], None
    for i, v in enumerate(drin):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= mindest:
                out.append((start, i))
            start = None
    if start is not None and len(drin) - start >= mindest:
        out.append((start, len(drin)))
    return out


def trimmen(karte):
    """Weissen Rand auf die Karte selbst zurueckschneiden."""
    maske = hell_maske(karte)
    zeilen = np.flatnonzero(maske.mean(axis=1) > 0.4)
    spalten = np.flatnonzero(maske.mean(axis=0) > 0.4)
    if zeilen.size and spalten.size:
        karte = karte.crop((int(spalten[0]), int(zeilen[0]),
                            int(spalten[-1]) + 1, int(zeilen[-1]) + 1))
    return karte


def auf_format(karte):
    """Mittig auf 260 zu 364 beschneiden, dann skalieren.

    Beschnitten statt verzerrt: eine gestauchte Karte faellt neben den
    anderen Decks sofort auf.
    """
    zw, zh = ZIEL
    b, h = karte.size
    if b / h > zw / zh:
        neu = int(round(h * zw / zh))
        links = (b - neu) // 2
        karte = karte.crop((links, 0, links + neu, h))
    else:
        neu = int(round(b * zh / zw))
        oben = (h - neu) // 2
        karte = karte.crop((0, oben, b, oben + neu))
    return karte.resize(ZIEL, Image.LANCZOS)


def farbzeichen(karte, name, ziel):
    """Ein einzelnes Farbzeichen aus der Zehn herausloesen.

    Genommen wird die obere linke Ecke der Karte: dort steht das kleine
    Zeichen neben der Zahl, frei und ohne Figur. Der weisse Grund wird
    durchsichtig, danach wird auf das Zeichen zugeschnitten.
    """
    b, h = karte.size
    ecke = karte.crop((int(b * 0.02), int(h * 0.06), int(b * 0.26), int(h * 0.22)))
    ecke = ecke.convert('RGBA')
    a = np.asarray(ecke).astype(np.int16)
    weiss = (a[:, :, 0] > 175) & (a[:, :, 1] > 175) & (a[:, :, 2] > 175)
    rgba = np.asarray(ecke).copy()
    rgba[weiss, 3] = 0

    sichtbar = np.flatnonzero(rgba[:, :, 3].max(axis=1) > 0)
    spalten = np.flatnonzero(rgba[:, :, 3].max(axis=0) > 0)
    bild = Image.fromarray(rgba, 'RGBA')
    if sichtbar.size and spalten.size:
        bild = bild.crop((int(spalten[0]), int(sichtbar[0]),
                          int(spalten[-1]) + 1, int(sichtbar[-1]) + 1))
    seite = max(bild.size)
    quadrat = Image.new('RGBA', (seite, seite), (0, 0, 0, 0))
    quadrat.paste(bild, ((seite - bild.width) // 2, (seite - bild.height) // 2))
    quadrat.resize((128, 128), Image.LANCZOS).save(
        os.path.join(ziel, 'farbe-' + name + '.webp'), 'WEBP', quality=92, method=6)


def rueckseite(ziel):
    """Eine schlichte Rueckseite im Stil des Blatts.

    Das Foto zeigt nur die Vorderseiten, deshalb wird sie gezeichnet: roter
    Grund mit hellem Rautenmuster und weissem Rand.
    """
    zw, zh = ZIEL
    bild = Image.new('RGB', (zw, zh), (176, 26, 30))
    px = bild.load()
    for y in range(zh):
        for x in range(zw):
            if (x + y) % 26 < 3 or (x - y) % 26 < 3:
                px[x, y] = (206, 74, 70)
    rand = 10
    for y in range(zh):
        for x in range(zw):
            if x < rand or y < rand or x >= zw - rand or y >= zh - rand:
                px[x, y] = (247, 244, 236)
    bild.save(os.path.join(ziel, 'back.webp'), 'WEBP', quality=92, method=6)


def main():
    quelle = sys.argv[1] if len(sys.argv) > 1 else 'assets/cards/watten/quelle.png'
    ziel = os.path.dirname(quelle) or '.'
    if not os.path.exists(quelle):
        print('Kein Foto gefunden: ' + quelle)
        print('Leg das Bild dorthin (oder gib den Pfad als Argument an) und '
              'starte noch einmal.')
        return 1
    os.makedirs(ziel, exist_ok=True)

    bild = Image.open(quelle).convert('RGB')
    print('Foto: %d x %d' % bild.size)

    bild, winkel = begradigen(bild)
    print('begradigt um %.3f Grad → %d x %d' % (winkel, bild.width, bild.height))

    maske = hell_maske(bild)
    reihen = bloecke(maske.mean(axis=1), 0.25, int(bild.height * 0.05))
    print('Reihen gefunden: %d' % len(reihen))
    if len(reihen) != 4:
        print('  Erwartet waren vier Reihen. Stimmt die Vorlage?')
        return 1

    geschrieben, uebersprungen = 0, 0
    for (r0, r1), (farbe, brief) in zip(reihen, REIHEN):
        streifen = maske[r0:r1, :]
        spalten = bloecke(streifen.mean(axis=0), 0.25, int(bild.width * 0.02))
        if len(spalten) != 9:
            print('  %s: %d Karten statt 9 — Vorlage pruefen.' % (farbe, len(spalten)))
            return 1
        zehner = None
        for (c0, c1), rang in zip(spalten, RANG):
            karte = auf_format(trimmen(bild.crop((c0, r0, c1, r1))))
            if rang == '10':
                zehner = karte
            if rang in OHNE:
                uebersprungen += 1
                continue
            karte.save(os.path.join(ziel, rang + brief + '.webp'),
                       'WEBP', quality=92, method=6)
            geschrieben += 1
        if zehner is not None:
            farbzeichen(zehner, farbe, ziel)
        print('  %-9s fertig' % farbe)

    rueckseite(ziel)
    print('\n%d Karten geschrieben, %d Sechser weggelassen, '
          '4 Farbzeichen und eine Rueckseite.' % (geschrieben, uebersprungen))
    return 0


if __name__ == '__main__':
    sys.exit(main())
