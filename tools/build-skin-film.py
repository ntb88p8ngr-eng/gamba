#!/usr/bin/env python3
"""Bewegter Hintergrund für einen Skin.

Aus einem langen Film wird eine kurze Schleife: ein paar Einstellungen,
weich ineinander geblendet, am Anfang aus dem Schwarz auf und am Ende
wieder zurück. Genau das macht die Schleife nahtlos — an der Nahtstelle
steht auf beiden Seiten Schwarz, da gibt es nichts zu springen.

    python3 tools/build-skin-film.py vorlage.mp4
    python3 tools/build-skin-film.py vorlage.mp4 --start 16 96 136 280 330 398
    python3 tools/build-skin-film.py vorlage.mp4 --schnitte      # nur zeigen

Herausfallen drei Dateien in assets/skins/<skin>/:

    hintergrundfilm.webm   VP9, die leichtere Fassung
    hintergrundfilm.mp4    H.264, die, die jeder Browser kann
    hintergrundfilm.webp   ein Standbild daraus

Das Standbild ist kein Beiwerk: es ist die Vorschau in der Auswahl, es
steht da, solange der Film lädt, und es bleibt stehen für alle, die am
Gerät „weniger Bewegung" eingestellt haben.

Der Beschnitt (--crop) schneidet weg, was nicht ins Bild gehört. Die
Vorlage von Old Vegas trug oben rechts ein Wasserzeichen und unten einen
eingebrannten Timecode; 640x280 ab y=100 lässt beides draussen und ergibt
nebenbei ein schön breites Bild.

Gebraucht wird ffmpeg. Liegt keines im Pfad, tut es auch:

    pip install imageio-ffmpeg
"""
import argparse
import os
import shutil
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# Voreinstellungen — passen zur Vorlage von Old Vegas
STARTS = [16, 96, 136, 280, 330, 398]
STUECK = 6.0        # Sekunden je Einstellung
BLENDE = 1.0        # Sekunden Überblendung dazwischen
SCHWARZ = 0.8       # Auf- und Abblende an den Enden
BREIT, HOCH = 1280, 560
FPS = 24


def ffmpeg():
    """ffmpeg im Pfad, sonst das von imageio-ffmpeg."""
    p = shutil.which('ffmpeg')
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('Kein ffmpeg gefunden. Abhilfe: pip install imageio-ffmpeg')


def lauf(args, still=True):
    r = subprocess.run(args, capture_output=still, text=True)
    if r.returncode != 0:
        if still:
            sys.stderr.write(r.stderr[-2000:])
        sys.exit('ffmpeg brach ab (%d)' % r.returncode)
    return r


def schnitte_zeigen(ff, quelle):
    """Wo wechselt die Einstellung? Hilft beim Aussuchen der Startzeiten."""
    # metadata=print schreibt in eine Datei, nicht auf die Ausgabe — ohne
    # file= bleibt die Liste leer, und man sucht den Fehler woanders.
    import tempfile
    fd, weg = tempfile.mkstemp(suffix='.txt')
    os.close(fd)
    try:
        subprocess.run(
            [ff, '-hide_banner', '-loglevel', 'error', '-i', quelle,
             '-filter_complex', "select='gt(scene,0.3)',metadata=print:file=" + weg,
             '-an', '-f', 'null', '-'],
            capture_output=True, text=True)
        with open(weg, encoding='utf-8', errors='replace') as f:
            roh = f.read()
    finally:
        if os.path.exists(weg):
            os.remove(weg)
    zeiten = []
    for zeile in roh.splitlines():
        if 'pts_time:' in zeile:
            try:
                zeiten.append(float(zeile.split('pts_time:')[1].split()[0]))
            except (IndexError, ValueError):
                pass
    print('%d Schnitte gefunden.' % len(zeiten))
    paare = sorted(((zeiten[i + 1] - zeiten[i], zeiten[i])
                    for i in range(len(zeiten) - 1)), reverse=True)
    print('Die längsten Einstellungen (Dauer / Start) — von dort aus wählen:')
    for dauer, start in paare[:15]:
        print('   %6.1f s   ab %7.1f s' % (dauer, start))
    return zeiten


def graph(n, crop):
    """Der Filtergraph: beschneiden, skalieren, überblenden, ab- und aufblenden."""
    # fps muss NACH setpts stehen. Andersherum meldet xfade „current rate of
    # 1/0 is invalid" — es besteht auf einer festen Bildrate, und setpts
    # macht die Angabe hinterher wieder zunichte.
    einzeln = ('crop=%s,scale=%d:%d:flags=lanczos,setpts=PTS-STARTPTS,'
               'fps=%d,format=yuv420p' % (crop, BREIT, HOCH, FPS))
    teile = ['[%d:v]%s[v%d]' % (i, einzeln, i) for i in range(n)]

    vorher = 'v0'
    for i in range(1, n):
        # Die Blende sitzt immer am Ende des bisher Zusammengesetzten
        versatz = i * (STUECK - BLENDE)
        raus = 'x%d' % i
        teile.append('[%s][v%d]xfade=transition=fade:duration=%s:offset=%s[%s]'
                     % (vorher, i, BLENDE, versatz, raus))
        vorher = raus

    gesamt = n * STUECK - (n - 1) * BLENDE
    # Entrauschen gehört in denselben Graphen — ein -vf daneben lehnt ffmpeg
    # ab, sobald ein filter_complex denselben Strom speist. Altes Filmkorn
    # kostet sonst mehr Bits als das Motiv, und hinter dem Schleier auf der
    # Seite sieht man davon ohnehin nichts.
    teile.append('[%s]hqdn3d=2:1.5:3:3,fade=t=in:st=0:d=%s,fade=t=out:st=%s:d=%s[out]'
                 % (vorher, SCHWARZ, round(gesamt - SCHWARZ, 3), SCHWARZ))
    return ';'.join(teile), gesamt


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('quelle', help='Die Filmvorlage')
    ap.add_argument('--skin', default='old-vegas', help='Für welchen Skin (Ordnername)')
    ap.add_argument('--start', type=float, nargs='+', default=STARTS,
                    help='Startzeiten der Einstellungen in Sekunden')
    ap.add_argument('--crop', default='640:280:0:100',
                    help='Beschnitt b:h:x:y — schneidet Wasserzeichen weg')
    ap.add_argument('--standbild-bei', type=float, default=8.0,
                    help='Sekunde in der Schleife, aus der das Standbild kommt')
    ap.add_argument('--schnitte', action='store_true',
                    help='Nur die Schnitte der Vorlage auflisten')
    a = ap.parse_args()

    ff = ffmpeg()
    if not os.path.exists(a.quelle):
        sys.exit('Vorlage nicht gefunden: ' + a.quelle)
    if a.schnitte:
        schnitte_zeigen(ff, a.quelle)
        return

    ziel = os.path.join(ROOT, 'assets', 'skins', a.skin)
    os.makedirs(ziel, exist_ok=True)
    mp4 = os.path.join(ziel, 'hintergrundfilm.mp4')
    webm = os.path.join(ziel, 'hintergrundfilm.webm')
    webp = os.path.join(ziel, 'hintergrundfilm.webp')

    fg, gesamt = graph(len(a.start), a.crop)
    eingaben = []
    for s in a.start:
        eingaben += ['-ss', str(s), '-t', str(STUECK), '-i', a.quelle]

    print('Schneide %d Einstellungen zu %.1f s Schleife …' % (len(a.start), gesamt))
    lauf([ff, '-hide_banner', '-loglevel', 'error', '-y'] + eingaben
         + ['-filter_complex', fg, '-map', '[out]', '-an',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

    print('Zweite Fassung als VP9 …')
    lauf([ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-an',
          '-c:v', 'libvpx-vp9', '-crf', '46', '-b:v', '0', '-row-mt', '1',
          '-deadline', 'good', '-cpu-used', '3', '-pix_fmt', 'yuv420p', webm])

    print('Standbild …')
    png = os.path.join(ziel, '_standbild.png')
    lauf([ff, '-hide_banner', '-loglevel', 'error', '-y',
          '-ss', str(a.standbild_bei), '-i', mp4, '-frames:v', '1', png])
    try:
        from PIL import Image
        Image.open(png).convert('RGB').save(webp, 'WEBP', quality=82, method=6)
    finally:
        if os.path.exists(png):
            os.remove(png)

    for p in (webm, mp4, webp):
        print('  %-26s %6.0f KB' % (os.path.basename(p), os.path.getsize(p) / 1024))
    print('Fertig. Eintragen in js/skins.js, falls noch nicht geschehen.')


if __name__ == '__main__':
    main()
