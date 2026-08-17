#!/usr/bin/env python3
"""Aus einer Vorlage eines deutschen Blatts die einzelnen Karten schneiden.

    python3 tools/build-watten.py assets/cards/watten/quelle.png

Erwartet ein Bild, auf dem alle 36 Karten in vier Reihen zu je neun Karten
liegen — Reihenfolge wie im Blatt ueblich:

    Reihe 1  Herz        Spalten 6 7 8 9 10 Unter Ober Koenig Ass
    Reihe 2  Eichel
    Reihe 3  Gras (Laub)
    Reihe 4  Schellen

Heraus kommen die Dateien, die GK.cardEl erwartet — 7H.webp, 10C.webp und so
weiter — plus die vier Farbzeichen fuer die Trumpfanzeige. Die Sechser
braucht Watten nicht, sie werden uebersprungen.

Drei Schritte:

  1. Begradigen. Falls die Vorlage schief liegt. Der Winkel kommt aus der
     Oberkante der ersten Kartenreihe: fuer jede Bildspalte die erste bedruckte
     Zeile suchen und durch diese Punkte eine Gerade legen. Die Luecken
     zwischen den Karten sind Ausreisser und fallen ueber drei Ausgleichsrunden
     weg. Liegt die Vorlage schon gerade, passiert hier nichts.

  2. Raster finden. Der Grund ist einfarbig und zwischen den Karten frei — wo
     etwas gedruckt ist, liegt eine Karte. Aus dem zeilen- und spaltenweisen
     Anteil bedruckter Pixel ergeben sich vier Baender und darin je neun; feste
     Pixelwerte waeren bei der naechsten Vorlage falsch. Die Spalten werden je
     Reihe einzeln gesucht, damit eine leicht verrutschte Reihe nicht die
     anderen mitzieht.

  3. Zuschneiden. Jede Karte kommt mittig auf das Seitenverhaeltnis der
     uebrigen Decks (260 zu 364) — durch Auffuellen, nicht durch Beschneiden:
     ein deutsches Blatt ist schmaler, und Beschneiden hiesse hier, oben und
     unten die Randzeichen abzuschneiden.

Die Farbzeichen kommen aus der Ecke des Koenigs jeder Reihe: dort steht ein
einzelnes, grosses Zeichen ganz frei. Genommen wird die groesste
zusammenhaengende Farbflaeche darin; der Grund wird durchsichtig.
"""
import os
import sys

import numpy as np
from PIL import Image

RANG = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']   # Unter = J, Ober = Q, Sau = A
OHNE = {'6'}                                            # Watten spielt ohne Sechser
# Reihenfolge der Reihen in der Vorlage; Buchstabe = Dateiname wie in den anderen Decks
REIHEN = [('herz', 'H'), ('eichel', 'C'), ('gras', 'S'), ('schellen', 'D')]

ZIEL = (260, 364)
LUFT = 3                    # Pixel Rand, die um jede Karte stehen bleiben


def grundfarbe(bild):
    """Die Farbe des Untergrunds — aus dem aeussersten Rand der Vorlage."""
    a = np.asarray(bild.convert('RGB')).astype(np.int16)
    rand = np.concatenate([a[:3].reshape(-1, 3), a[-3:].reshape(-1, 3),
                           a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)])
    return tuple(int(v) for v in np.median(rand, axis=0))


def tinte_maske(bild, grund):
    """Bedruckt oder blanker Grund?

    Ein fester Helligkeitswert taugt nicht: der Grund kann weiss sein oder
    beige, und weisses Papier ist genauso hell wie ein weisser Grund. Gefragt
    wird deshalb nach dem Abstand zur Grundfarbe — alles, was sich davon
    absetzt, gehoert zu einer Karte.
    """
    a = np.asarray(bild.convert('RGB')).astype(np.int16)
    return np.abs(a - np.array(grund, np.int16)).max(axis=2) > 18


def begradigen(bild, grund):
    """Schieflage ausgleichen, falls die Vorlage nicht gerade liegt."""
    maske = tinte_maske(bild, grund)
    H, W = maske.shape
    punkte = []
    for x in range(0, W, 3):
        treffer = np.flatnonzero(maske[:, x])
        if treffer.size and treffer[0] < H * 0.3:
            punkte.append((x, treffer[0]))
    if len(punkte) < 30:
        print('  Oberkante nicht sicher erkannt — Vorlage bleibt, wie sie ist.')
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
    gerade = bild.rotate(winkel, resample=Image.BICUBIC, expand=True, fillcolor=grund)
    return gerade, winkel


def baender(anteil, stueck, mindest):
    """Zusammenhaengende bedruckte Abschnitte einer Projektion.

    Zwischen zwei Karten ist der Anteil glatt null, innerhalb einer Karte nie —
    dafuer sorgt allein schon der aufgedruckte Rahmen. Ein Schwellwert knapp
    ueber null trennt beides sauber, ohne von der Dichte der Zeichen abzuhaengen.
    """
    ueber = anteil > 0.002
    gefunden, i = [], 0
    while i < len(ueber):
        if ueber[i]:
            j = i
            while j < len(ueber) and ueber[j]:
                j += 1
            if j - i >= mindest:
                gefunden.append((i, j))
            i = j
        else:
            i += 1
    return gefunden if len(gefunden) == stueck else None


def auf_format(karte):
    """Auf 260 zu 364 bringen — durch Auffuellen, nicht durch Beschneiden.

    Ein deutsches Blatt ist schmaler als das franzoesische. Beschneiden hiesse
    hier, oben und unten die Randzeichen abzuschneiden; verzerren wuerde neben
    den anderen Decks auffallen. Also wird mit der Randfarbe der Karte
    aufgefuellt — bei weissem Papier sieht man davon nichts.
    """
    zw, zh = ZIEL
    b, h = karte.size
    faktor = min(zw / float(b), zh / float(h))
    klein = karte.resize((max(1, int(round(b * faktor))),
                          max(1, int(round(h * faktor)))), Image.LANCZOS)

    a = np.asarray(klein.convert('RGB'))
    rand = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    fuell = tuple(int(v) for v in np.median(rand, axis=0))

    blatt = Image.new('RGB', ZIEL, fuell)
    blatt.paste(klein, ((zw - klein.width) // 2, (zh - klein.height) // 2))
    return blatt


def _weiten(maske, rand):
    """Eine Maske um ein paar Pixel aufblasen."""
    breit = maske.copy()
    for achse in (0, 1):
        for schritt in (rand, -rand):
            breit |= np.roll(breit, schritt, axis=achse)
    return breit


def _schliessen(maske, rand):
    """Duenne Spalten in einer Maske zuziehen, ohne sie wachsen zu lassen."""
    if not rand:
        return maske
    return ~_weiten(~_weiten(maske, rand), rand)


def _flecken(maske):
    """Zusammenhaengende Flaechen in einer Maske finden.

    Kein scipy zur Hand, deshalb selbst gemacht: zeilenweise Laufstuecke
    bilden und ueber eine Union-Find-Struktur zusammenfassen. Fuer die Groesse
    einer Karte ist das schnell genug und spart eine Abhaengigkeit.
    """
    H, W = maske.shape
    eltern = {}

    def wurzel(x):
        while eltern[x] != x:
            eltern[x] = eltern[eltern[x]]
            x = eltern[x]
        return x

    def verbinden(a, b):
        ra, rb = wurzel(a), wurzel(b)
        if ra != rb:
            eltern[rb] = ra

    marken = np.zeros((H, W), np.int32)
    naechste = 1
    for y in range(H):
        zeile = maske[y]
        x = 0
        while x < W:
            if not zeile[x]:
                x += 1
                continue
            start = x
            while x < W and zeile[x]:
                x += 1
            marke = 0
            if y > 0:
                oben = marken[y - 1, max(0, start - 1):min(W, x + 1)]
                treffer = oben[oben > 0]
                if treffer.size:
                    marke = int(treffer[0])
                    for t in np.unique(treffer):
                        verbinden(marke, int(t))
            if not marke:
                marke = naechste
                eltern[marke] = marke
                naechste += 1
            marken[y, start:x] = marke

    if naechste == 1:
        return {}
    fertig = {}
    for y in range(H):
        for x in range(W):
            m = marken[y, x]
            if not m:
                continue
            w = wurzel(int(m))
            k = fertig.setdefault(w, [x, y, x, y, 0])
            k[0] = min(k[0], x); k[1] = min(k[1], y)
            k[2] = max(k[2], x); k[3] = max(k[3], y)
            k[4] += 1
    return fertig


ZEICHENECKE = (0.15, 0.02, 0.45, 0.32)      # Ausschnitt links oben auf dem Koenig


def farbzeichen(karte, name, ziel):
    """Das Farbzeichen aus der Ecke des Koenigs herausloesen.

    Auf den Zahlenkarten haengen die Zeichen aneinander — bei Eichel und Gras
    an einer gemalten Ranke, bei Herz beruehren sich die Nachbarn. Dort die
    groesste Flaeche zu nehmen liefert ein Bueschel statt eines Zeichens.

    Der Koenig traegt links oben ein einzelnes, grosses und voellig freies
    Zeichen. Aus diesem Ausschnitt wird die groesste zusammenhaengende
    Farbflaeche genommen, die den Rand nicht beruehrt; die Krone daneben und
    der schwarze Buchstabe bleiben draussen.
    """
    b, h = karte.size
    l, o, r, u = ZEICHENECKE
    ecke = karte.crop((int(b * l), int(h * o), int(b * r), int(h * u)))
    a = np.asarray(ecke.convert('RGB')).astype(np.int16)
    tinte = (a.max(axis=2) - a.min(axis=2)) > 60          # kraeftige Farbe
    H, W = tinte.shape

    # Die Schelle ist oben gelb, in der Mitte gruen und unten rot, getrennt
    # durch schwarze Striche — ohne Nachhilfe zerfaellt sie in drei Stuecke.
    # Ein paar Pixel zugezogen haelt sie zusammen; zu viel zieht das Herz an
    # den Umhang des Koenigs. Weil das je Farbe anders liegt, werden mehrere
    # Weiten durchprobiert und die groesste noch saubere Flaeche gewinnt.
    beste, groesse = None, 0
    for weite in (0, 2, 3, 4, 5):
        for x0, y0, x1, y1, n in _flecken(_schliessen(tinte, weite)).values():
            if x0 <= 0 or y0 <= 0 or x1 >= W - 1 or y1 >= H - 1:
                continue                                   # beruehrt den Rand
            bb, bh = x1 - x0 + 1, y1 - y0 + 1
            if n < 300 or n > 0.5 * H * W:
                continue                                   # Punkt oder halbe Karte
            if not 0.45 <= bb / float(bh) <= 1.9:
                continue                                   # Ranke oder Stiel
            if n < 0.45 * bb * bh:
                continue                                   # zu locker, kein Zeichen
            if n > groesse:
                groesse, beste = n, (x0, y0, x1 + 1, y1 + 1)
    if beste is None:
        print('  %-9s Farbzeichen nicht gefunden — ganze Ecke genommen.' % name)
        beste = (0, 0, W, H)

    zeichen = ecke.crop(beste).convert('RGBA')
    a2 = np.asarray(zeichen).astype(np.int16)
    blass = (a2.max(axis=2) - a2.min(axis=2)) < 45         # Papier und Grund
    blass &= a2[:, :, :3].mean(axis=2) > 150
    rgba = np.asarray(zeichen).copy()
    rgba[blass, 3] = 0

    bild = Image.fromarray(rgba, 'RGBA')
    seite = int(max(bild.size) * 1.12)
    quadrat = Image.new('RGBA', (seite, seite), (0, 0, 0, 0))
    quadrat.paste(bild, ((seite - bild.width) // 2, (seite - bild.height) // 2))
    quadrat.resize((128, 128), Image.LANCZOS).save(
        os.path.join(ziel, 'farbe-' + name + '.webp'), 'WEBP', quality=92, method=6)


def rueckseite(ziel):
    """Eine schlichte Rueckseite im Stil des Blatts.

    Die Vorlage zeigt nur die Vorderseiten, deshalb wird sie gezeichnet: roter
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
        print('Keine Vorlage gefunden: ' + quelle)
        print('Leg das Bild dorthin (oder gib den Pfad als Argument an) und '
              'starte noch einmal.')
        return 1
    os.makedirs(ziel, exist_ok=True)

    bild = Image.open(quelle).convert('RGB')
    print('Vorlage: %d x %d' % bild.size)

    grund = grundfarbe(bild)
    bild, winkel = begradigen(bild, grund)
    print('Grund %s, Schieflage %.3f Grad' % (grund, winkel))

    maske = tinte_maske(bild, grund)
    zeilen = baender(maske.mean(axis=1), len(REIHEN), 40)
    if not zeilen:
        print('  Vier Kartenreihen nicht gefunden. Stimmt die Vorlage?')
        return 1

    geschrieben, uebersprungen = 0, 0
    for (r0, r1), (farbe, brief) in zip(zeilen, REIHEN):
        streifen = maske[r0:r1]
        spalten = baender(streifen.mean(axis=0), len(RANG), 40)
        if not spalten:
            print('  %-9s neun Karten nicht gefunden — Reihe uebersprungen.' % farbe)
            continue

        koenig = None
        for (c0, c1), rang in zip(spalten, RANG):
            karte = bild.crop((max(0, c0 - LUFT), max(0, r0 - LUFT),
                               min(bild.width, c1 + LUFT), min(bild.height, r1 + LUFT)))
            if rang == 'K':
                koenig = karte
            if rang in OHNE:
                uebersprungen += 1
                continue
            auf_format(karte).save(os.path.join(ziel, rang + brief + '.webp'),
                                   'WEBP', quality=92, method=6)
            geschrieben += 1
        if koenig is not None:
            farbzeichen(koenig, farbe, ziel)
        print('  %-9s fertig (%d x %d je Karte)' % (farbe, spalten[0][1] - spalten[0][0],
                                                    r1 - r0))

    rueckseite(ziel)
    print('\n%d Karten geschrieben, %d Sechser weggelassen, '
          '4 Farbzeichen und eine Rueckseite.' % (geschrieben, uebersprungen))
    return 0


if __name__ == '__main__':
    sys.exit(main())
