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

  2. Raster finden. Die Karten liegen dicht an dicht, und Papier ist genauso
     hell wie der Untergrund — nach Helligkeit zu suchen bringt nichts. Was
     man dagegen sicher findet, sind lange dunkle Striche: die Kartenkante
     und der aufgedruckte Rahmen. Daraus kommen zuerst die Reihengrenzen
     (spaltenweise, denn das Foto ist leicht perspektivisch verzogen), dann
     je Reihe die Spaltengrenzen aus dem weissen Rand unter der Oberkante.

  3. Zuschneiden. Jede Karte wird auf ihr Feld geschnitten, mittig auf das
     Seitenverhaeltnis der uebrigen Decks gebracht (260 zu 364) und als
     WebP gespeichert.

Die Farbzeichen kommen aus der Ecke des Koenigs jeder Reihe: dort steht ein
einzelnes, grosses Zeichen ganz frei. Genommen wird die groesste
zusammenhaengende Farbflaeche darin; Papier wird durchsichtig.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

RANG = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']   # Unter = J, Ober = Q, Sau = A
OHNE = {'6'}                                            # Watten spielt ohne Sechser
# Reihenfolge der Reihen im Foto; Buchstabe = Dateiname wie in den anderen Decks
REIHEN = [('herz', 'H'), ('eichel', 'C'), ('gras', 'S'), ('schellen', 'D')]

ZIEL = (260, 364)
GRUND = (214, 210, 180)     # Tischfarbe, fuer die Ecken beim Drehen


def karten_maske(bild):
    """Karte oder Tisch?

    Der erste Ansatz ging ueber die Helligkeit — der scheitert an einem echten
    Foto: der Tisch ist beige und damit selbst hell, das Licht faellt schraeg
    ein, und die bedruckten Flaechen sind dunkler als der Tisch.

    Der Tisch ist aber verlaesslich gelblich: Rot deutlich ueber Blau, und
    dabei nicht kraeftig gefaerbt. Beides trifft auf keine Karte zu — Papier
    ist neutral weiss (Rot gleich Blau), Druckfarbe ist kraeftig. Genau danach
    wird gefragt.
    """
    a = np.asarray(bild.convert('RGB')).astype(np.int16)
    neutral = (a[:, :, 0] - a[:, :, 2]) < 20          # weisses Papier
    kraeftig = (a.max(axis=2) - a.min(axis=2)) > 70   # Druckfarbe
    return neutral | kraeftig


def rahmen(maske, anteil=0.5):
    """Aeussere Grenzen des Kartenblocks."""
    z = np.flatnonzero(maske.mean(axis=1) > anteil)
    s = np.flatnonzero(maske.mean(axis=0) > anteil)
    if not z.size or not s.size:
        return None
    return int(s[0]), int(z[0]), int(s[-1]) + 1, int(z[-1]) + 1


def begradigen(bild):
    maske = karten_maske(bild)
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


def teilen(von, bis, stueck):
    """Eine Strecke in gleich grosse Abschnitte legen — nur als Rueckfall."""
    schritt = (bis - von) / float(stueck)
    return [von + i * schritt for i in range(stueck + 1)]


def striche(bild):
    """Wo ist es dunkler als seine Umgebung?

    Ein fester Schwellwert scheitert am schraeg einfallenden Licht: dieselbe
    Kartenkante ist links im Bild heller als rechts eine weisse Flaeche. Der
    Vergleich mit dem eigenen Umfeld ist davon unabhaengig und laesst genau
    das stehen, worauf es ankommt — Kartenkante und aufgedruckter Rahmen.
    """
    lum = np.asarray(bild.convert('RGB')).astype(float).mean(axis=2)
    umfeld = np.asarray(Image.fromarray(lum.astype('uint8'))
                        .filter(ImageFilter.BoxBlur(9))).astype(float)
    return lum, lum < umfeld - 10


def _schrumpfen(maske, laenge, achse):
    """Nur Striche behalten, die mindestens so lang sind."""
    rest = maske.copy()
    schritt = 1
    while schritt < laenge:
        rest &= np.roll(rest, -schritt, axis=achse)
        schritt *= 2
    return rest


def _weiten(maske, rand):
    """Eine Maske um ein paar Pixel aufblasen."""
    breit = maske.copy()
    for achse in (0, 1):
        for schritt in (rand, -rand):
            breit |= np.roll(breit, schritt, axis=achse)
    return breit


def _schliessen(maske, rand):
    """Duenne Spalten in einer Maske zuziehen, ohne sie wachsen zu lassen."""
    return ~_weiten(~_weiten(maske, rand), rand)


def _gruppen(werte, abstand):
    """Dicht beieinander liegende Zahlen zusammenfassen."""
    haufen = []
    for w in sorted(werte):
        if haufen and w - haufen[-1][-1] <= abstand:
            haufen[-1].append(w)
        else:
            haufen.append([w])
    return haufen


def reihengrenzen(strich, x0, x1, reihen):
    """Die waagerechten Kartenkanten — fuer jede Bildspalte einzeln.

    Das Foto ist minimal perspektivisch verzogen: quer ueber das Blatt
    wandern die Reihen um rund zwanzig Pixel nach unten. Ein einziger Wert je
    Reihe wuerde aussen anschneiden, deshalb wird jede Kartenspalte fuer sich
    vermessen und dazwischen linear interpoliert.

    Je Grenze liegen zwei bis drei Striche dicht beieinander — Rahmenunterkante
    der oberen Karte, Papierkante, Rahmenoberkante der unteren. Gesucht ist die
    Papierkante in der Mitte; aussen die jeweils aeusserste.
    """
    breit = (x1 - x0) / float(reihen[1])
    mitten, saeulen = [], []
    for i in range(reihen[1]):
        a = int(round(x0 + i * breit)) + 20
        b = int(round(x0 + (i + 1) * breit)) - 20
        anteil = _schrumpfen(strich[:, a:b], 32, 1).mean(axis=1)
        spitzen = [int(np.mean(g)) for g in _gruppen(np.flatnonzero(anteil > 0.35), 8)]
        zonen = _gruppen(spitzen, 100)
        if len(zonen) != reihen[0] + 1:
            return None
        saeulen.append([min(zonen[0])] +
                       [int(np.median(z)) for z in zonen[1:-1]] +
                       [max(zonen[-1])])
        mitten.append((a + b) / 2.0)

    mitten = np.array(mitten)
    saeulen = np.array(saeulen, float)
    # Fehlt bei einer Karte ein Strich, rutscht ihre Grenze auf den Nachbarn.
    # Die Reihen laufen aber schnurgerade quer ueber das Blatt, also wird je
    # Grenze eine Gerade gelegt und der Ausreisser darauf zurueckgeholt.
    for r in range(saeulen.shape[1]):
        x, y = mitten, saeulen[:, r]
        for _ in range(2):
            k, d = np.polyfit(x, y, 1)
            passt = np.abs(saeulen[:, r] - (k * mitten + d)) < 8
            if passt.sum() < 4:
                break
            x, y = mitten[passt], saeulen[passt, r]
        saeulen[:, r] = k * mitten + d
    return mitten, saeulen


def spaltengrenzen(lum, oben, x0, x1, spalten):
    """Die senkrechten Kartenkanten einer Reihe.

    Unter der Oberkante liegt bei jeder Karte ein Streifen weisses Papier,
    bevor der Rahmen beginnt. Quer darueber ist jede Fuge zwischen zwei Karten
    ein sauberer Einbruch — die einzige Stelle des Fotos, an der die Spalten
    ohne Druckfarbe im Weg zu sehen sind.
    """
    hoehe, breite = lum.shape
    von, bis = max(0, x0 - 60), min(breite, x1 + 60)

    # Wie breit der weisse Streifen ist, haengt davon ab, wie gerade die Karte
    # liegt. Deshalb ein paar Zuschnitte durchprobieren und den ersten nehmen,
    # der genau die erwarteten Fugen findet.
    for hoch, tief_, mindest in ((5, 17, 14), (4, 14, 10), (6, 16, 16),
                                 (3, 12, 12), (7, 20, 12)):
        profil = np.zeros(bis - von)
        for x in range(von, bis):
            y = int(round(oben(x)))
            profil[x - von] = lum[max(0, y + hoch):min(hoehe, y + tief_), x].mean()

        bezug = np.array([profil[max(0, i - 60):i + 60].max()
                          for i in range(len(profil))])
        flach = profil < bezug - mindest

        taeler, i = [], 0
        while i < len(flach):
            if flach[i]:
                j = i
                while j < len(flach) and flach[j]:
                    j += 1
                if j - i >= 2:
                    if taeler and i + von - taeler[-1][1] <= 4:
                        taeler[-1] = (taeler[-1][0], j + von)   # eine Fuge, kein Paar
                    else:
                        taeler.append((i + von, j + von))
                i = j
            else:
                i += 1
        if len(taeler) == spalten + 1:
            # aussen zaehlt die innere Flanke, dazwischen die Mitte der Fuge
            return np.array([taeler[0][1]] +
                            [(a + b) / 2.0 for a, b in taeler[1:-1]] +
                            [taeler[-1][0]], float)
    return None


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


ZEICHENECKE = (0.16, 0.02, 0.44, 0.32)      # Ausschnitt links oben auf dem Koenig


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
    bauch = karte.crop((int(b * l), int(h * o), int(b * r), int(h * u)))
    a = np.asarray(bauch.convert('RGB')).astype(np.int16)
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
            if n < 400 or n > 0.5 * H * W:
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

    zeichen = bauch.crop(beste).convert('RGBA')
    a2 = np.asarray(zeichen).astype(np.int16)
    blass = (a2[:, :, 0] - a2[:, :, 2]) > -40
    blass &= (a2.max(axis=2) - a2.min(axis=2)) < 45        # Papier und Tisch
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

    kasten = rahmen(karten_maske(bild))
    if not kasten:
        print('  Kartenblock nicht gefunden. Stimmt die Vorlage?')
        return 1
    x0, y0, x1, y1 = kasten
    print('Kartenblock: %d x %d bei (%d, %d)' % (x1 - x0, y1 - y0, x0, y0))

    lum, strich = striche(bild)
    gefunden = reihengrenzen(strich, x0, x1, (len(REIHEN), len(RANG)))
    if gefunden is None:
        print('  Reihen nicht erkannt — es wird gleichmaessig geteilt.')
        mitten = np.array([0.0, float(bild.width)])
        saeulen = np.array([teilen(y0, y1, len(REIHEN))] * 2)
    else:
        mitten, saeulen = gefunden
        print('Reihen bei %s (Mitte des Blatts)' %
              ', '.join('%d' % v for v in saeulen[len(saeulen) // 2]))

    def kante(r):
        """Die r-te waagerechte Grenze als Funktion der Bildspalte."""
        return lambda x: float(np.interp(x, mitten, saeulen[:, r]))

    geschrieben, uebersprungen = 0, 0
    for r, (farbe, brief) in enumerate(REIHEN):
        oben, unten = kante(r), kante(r + 1)
        spalten = spaltengrenzen(lum, oben, x0, x1, len(RANG))
        if spalten is None:
            print('  %-9s Spalten nicht erkannt — gleichmaessig geteilt.' % farbe)
            spalten = np.array(teilen(x0, x1, len(RANG)))
        koenig = None
        for i, rang in enumerate(RANG):
            c0, c1 = spalten[i], spalten[i + 1]
            mitte = (c0 + c1) / 2.0
            karte = auf_format(bild.crop((int(round(c0)) + 3,
                                          int(round(oben(mitte))) + 3,
                                          int(round(c1)) - 3,
                                          int(round(unten(mitte))) - 3)))
            if rang == 'K':
                koenig = karte
            if rang in OHNE:
                uebersprungen += 1
                continue
            karte.save(os.path.join(ziel, rang + brief + '.webp'),
                       'WEBP', quality=92, method=6)
            geschrieben += 1
        if koenig is not None:
            farbzeichen(koenig, farbe, ziel)
        print('  %-9s fertig' % farbe)

    rueckseite(ziel)
    print('\n%d Karten geschrieben, %d Sechser weggelassen, '
          '4 Farbzeichen und eine Rueckseite.' % (geschrieben, uebersprungen))
    return 0


if __name__ == '__main__':
    sys.exit(main())
