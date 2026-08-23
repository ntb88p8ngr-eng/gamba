# Sound-Pack

Alle Klänge der Seite lassen sich hier durch eigene Audiodateien ersetzen —
einzeln, und wenn nötig unterschiedlich je Spiel.

Gesteuert wird das über **`sounds.json`** in diesem Ordner. Die Audiodateien
legst du daneben, gern in Unterordnern.

Nichts davon ist Pflicht. Jeder Klang, für den keine Datei hinterlegt ist,
klingt weiter wie eingebaut. Du kannst also mit einem einzigen Ton anfangen.

---

## Schnellstart

1. Datei ablegen, z. B. `assets/sfx/ui/klick.mp3`
2. In `sounds.json` eintragen:

```json
"sounds": {
  "click": "ui/klick.mp3"
}
```

3. Seite neu laden. Fertig.

Zum Ausprobieren ohne Neuladen: in der Browser-Konsole `GK.sfxPack.reload()`
aufrufen, dann `GK.sfx('click')`.

---

## Aufbau von `sounds.json`

```json
{
  "version": 1,
  "defaults": { "volume": 1, "preload": false },
  "sounds":   { "click": "…", "coin": "…" },
  "games":    { "crash": { "boom": "…" } },
  "music":    [ { "id": "lounge", "name": "…", "file": "…" } ]
}
```

| Block | Wofür |
|---|---|
| `defaults` | gilt für alle Klänge |
| `sounds` | globale Belegung, greift überall |
| `games` | Abweichungen für ein einzelnes Spiel |
| `music` | Hintergrundmusik als Datei |

---

## Die drei Schreibweisen

Eine Datei, kurz:

```json
"click": "ui/klick.mp3"
```

Mehrere Varianten — bei jedem Abspielen wird eine ausgewählt:

```json
"card": ["karten/1.mp3", "karten/2.mp3", "karten/3.mp3"]
```

Ausführlich, mit allen Reglern:

```json
"boom": {
  "files": ["fx/explosion.mp3"],
  "volume": 1.4,
  "rate": 0.9,
  "rateJitter": 0.08,
  "delay": 0.05
}
```

---

## Alle Felder

| Feld | Typ | Standard | Bedeutung |
|---|---|---|---|
| `file` | Text | – | Eine Datei. Gleichwertig zu `files` mit einem Eintrag. |
| `files` | Liste | – | Mehrere Varianten desselben Klangs. |
| `volume` | Zahl | `1` | Lautstärke-Faktor. `0.5` = halb so laut, `2` = doppelt. Maximal 4. |
| `volumeJitter` | Zahl | `0` | Zufällige Abweichung der Lautstärke, z. B. `0.1`. Lässt Wiederholungen lebendiger klingen. |
| `rate` | Zahl | `1` | Abspielgeschwindigkeit; ändert auch die Tonhöhe. `0.8` tiefer und langsamer, `1.3` höher und schneller. |
| `rateJitter` | Zahl | `0` | Zufällige Abweichung der Geschwindigkeit. Bei oft wiederholten Klängen (Hufschlag, Kartengeben) sehr wirkungsvoll. |
| `detune` | Zahl | `0` | Feinstimmung in Cent, ±1200 = eine Oktave. Wird nicht von jedem Browser unterstützt. |
| `delay` | Zahl | `0` | Verzögerung in Sekunden vor dem Abspielen. |
| `offset` | Zahl | `0` | Startpunkt in der Datei, in Sekunden. Praktisch, um eine Stille am Anfang zu überspringen. |
| `duration` | Zahl | – | Nur diesen Ausschnitt abspielen, in Sekunden. Zusammen mit `offset` lassen sich mehrere Klänge aus einer einzigen Datei schneiden. |
| `pick` | Text | `"zufall"` | Wie aus `files` gewählt wird: `"zufall"` oder `"reihum"`. |
| `preload` | Wahrheitswert | `false` | Beim Seitenstart laden statt beim ersten Abspielen. |
| `enabled` | Wahrheitswert | `true` | Auf `false` bleibt dieser Klang **stumm** — auch der eingebaute. |

In `defaults` wirken `volume` (als zusätzlicher Faktor über allem) und
`preload` (für alle Klänge auf einmal).

---

## Pro Spiel abweichen

Unter `games` steht die **id** des Spiels. Ein Eintrag dort überschreibt nur
die Felder, die er selbst setzt — der Rest kommt weiter aus `sounds`.

```json
"sounds": {
  "boom": { "files": ["fx/explosion.mp3"], "volume": 1 }
},
"games": {
  "crash":     { "boom": "crash/rakete-zerlegt.mp3" },
  "mines":     { "boom": { "volume": 1.6 } },
  "smaugcave": { "growl": "hoehle/drache.mp3", "coin": "hoehle/gold.mp3" }
}
```

Ergebnis:

* **Crash** nimmt eine ganz andere Datei.
* **Mines** behält `fx/explosion.mp3`, spielt sie aber lauter — es steht ja
  nur `volume` dort.
* **Smaugs Höhle** bekommt eigenes Knurren und eigenen Münzklang.
* Überall sonst bleibt es bei `fx/explosion.mp3`.

Einen Klang in genau einem Spiel abschalten:

```json
"games": { "mystery": { "click": { "enabled": false } } }
```

Gültige ids — alle 21 Spiele stehen auch schon als leere Einträge in
`sounds.json`, es reicht also, dort die gewünschten Klänge einzutragen:
`slots`, `roulette`, `blackjack`, `baccarat`, `coinflip`, `dice`, `crash`,
`mines`, `wheel`, `plinko`, `scratch`, `horses`, `icebear`, `ocean`, `poker`,
`penguin`, `scratch9`, `mystery`, `flappy`, `jump`, `smaugcave`.

---

## Die 25 Klänge

| Name | Wann er kommt | Wo besonders |
|---|---|---|
| `click` | jeder Knopfdruck | überall, mit Abstand am häufigsten |
| `hover` | Maus über einer Spielkachel | Lobby |
| `chip` | Einsatz ändern, Auswahl umschalten | überall |
| `spin` | eine Runde startet | Slots, Rad, Crash |
| `tick` | einzelner Klick beim Ausrollen | Rad, Roulette |
| `reel` | eine Walze hält an | Slots, Tiefsee |
| `card` | eine Karte wird gelegt | Blackjack, Poker, Baccarat |
| `coin` | Chips kommen zurück, kleiner Fund | überall |
| `cash` | Auszahlung | überall |
| `win` | gewonnen | überall |
| `bigwin` | großer Gewinn | ab hohem Vielfachen |
| `jackpot` | Höchstgewinn, Levelaufstieg | überall |
| `lose` | verloren | überall |
| `error` | nicht erlaubt, zu wenig Chips, gesperrt | überall |
| `boom` | Explosion, Absturz | Crash, Mines |
| `gem` | Edelstein gefunden | Mines, Höhle |
| `rocket` | Triebwerk während des Flugs | Crash |
| `hoof` | Hufschlag | Pferderennen |
| `startbell` | Startglocke | Pferderennen |
| `whoosh` | Ansicht wechselt, etwas fliegt vorbei | überall |
| `waddle` | Sprung von Scholle zu Scholle | Pinguin-Sprung |
| `soul` | Seele wird gesetzt | Mitternachts-Mysterium |
| `snuff` | Kerze geht aus | Mitternachts-Mysterium |
| `growl` | der Drache regt sich | Smaugs Höhle |
| `plop` | Landung | Eisbär, Pinguin |

`click`, `chip`, `coin` und `lose` hört man am häufigsten — dort lohnt sich
`files` mit mehreren Varianten und ein bisschen `rateJitter` am meisten,
sonst wird die Wiederholung schnell aufdringlich.

---

## Eigene Musik

Die fünf eingebauten Hintergrund-Tracks entstehen live im Browser. Daneben
darf jedes Pack eigene Musik als fertige Datei mitbringen — sie erscheint
unter **🎵 Musik & Sound** in derselben Liste, erkennbar am 💿.

```json
"music": [
  {
    "id": "vegas-lounge",
    "name": "Vegas Lounge",
    "mood": "Big Band · Bläser und Besen",
    "file": "musik/vegas-lounge.mp3",
    "volume": 0.9,
    "bpm": 96,
    "skins": ["old-vegas"]
  }
]
```

| Feld | Pflicht | Wofür |
|---|---|---|
| `id` | ja | Kennung, unter der sich die Auswahl das Stück merkt |
| `file` | ja | Pfad, relativ zu diesem Ordner |
| `name` | — | Was in der Liste steht |
| `mood` | — | Die kleine Zeile darunter |
| `volume` | — | 0 bis 1, Feinabgleich gegen die eingebauten Stücke |
| `bpm` | — | nur Anzeige |
| `skins` | — | Liste von Anstrichen; ohne das Feld läuft es überall |
| `nurRadio` | — | `true` = läuft nur im Sender, steht nicht in der Stückauswahl |
| `dauer` | — | Länge in Sekunden; der Server braucht sie, um die Sendung zu takten |

Anders als die Klänge wird Musik nicht vorab dekodiert, sondern als ganze
Datei in Schleife abgespielt — ein Stück von drei Minuten gehört nicht in
einen Puffer. Nimm also etwas, das sich nahtlos wiederholt.

Der Pfad darf heißen wie die Datei auf der Platte, Leerzeichen und Klammern
eingeschlossen (`music/vegas-fm/Take Five.mp3`) — die Adresse wird beim
Laden kodiert.

`nurRadio` ist für ganze Sendungen gedacht. Ein Sender wie Vegas FM bringt
zehn Titel mit; stünden die alle einzeln in der Auswahl, wäre von den
eingebauten Stücken nichts mehr zu sehen. Mit `nurRadio` laufen sie im
Radio ganz normal mit und tauchen sonst nirgends auf. Wer das Radio
abschaltet, während so ein Titel läuft, landet auf dem ersten Stück der
Auswahl — sonst spielte Musik, die in keiner Liste steht.

`skins` verbindet Musik mit dem Anstrich der Seite: `["old-vegas"]` heißt,
das Stück taucht nur unter Old Vegas auf. Wer den Anstrich wechselt,
während ein fremdes Stück läuft, landet automatisch auf einem erlaubten.
Welche Anstriche es gibt, steht in `assets/skins/README.md`.

---

## Radio

Unter der Stückauswahl steht das **Radio**: ein Sender spielt mehrere
Stücke hintereinander und schaltet von selbst weiter, statt eines im Loop
zu lassen.

Es gibt zwei Arten von Sendern, und sie haben wenig gemeinsam.

Die einen kommen aus dem Block `radio` hier in dieser Datei und spielen
Stücke aus dem Pack. Die anderen sind **Webradios**: fremde Ströme, die
ohnehin schon laufen. Die legt der Admin im Panel an, nicht hier — sie
liegen beim Server und lassen sich im Betrieb ändern, ohne dass jemand an
eine Datei muss.

Gibt es für den laufenden Anstrich keinen Sender, fehlt der
Radio-Abschnitt im Musikfenster ganz.

Sender aus dem Pack:

```json
"radio": [
  {
    "id": "vegas-fm",
    "name": "Vegas FM",
    "was": "Lounge, Swing und ein bisschen Rauch",
    "tracks": ["vegas-lounge", "swing-nacht", "keller"],
    "mischen": false,
    "dauer": 240,
    "skins": ["old-vegas"]
  }
]
```

| Feld | Pflicht | Wofür |
|---|---|---|
| `id` | ja | Kennung, unter der sich die Auswahl den Sender merkt |
| `name` | — | Was auf der Kachel steht |
| `was` | — | Die kleine Zeile darunter |
| `tracks` | — | Kennungen in Sendereihenfolge; ohne das Feld alles, was zum Anstrich passt |
| `mischen` | — | `false` behält die Reihenfolge bei, sonst wird gemischt |
| `dauer` | — | Sekunden je Stück, mindestens 30, Voreinstellung 210 |
| `skins` | — | Liste von Anstrichen; ohne das Feld läuft der Sender überall |

## Gleichlauf

Ein Sender aus diesem Block läuft nicht im Browser, sondern auf dem
Server: der weiß, welches Stück gerade dran ist und seit wann. Wer
einschaltet, kommt mitten hinein — wie bei einem echten Radio, und alle
hören dasselbe Stück an derselben Stelle. Im Musikfenster steht unter den
Sendern, was gerade läuft; im Admin-Panel lässt sich weiterschalten oder
ein Stück auflegen, für alle zugleich.

Dafür braucht der Server die Länge jedes Stücks — sonst weiß er nicht,
wann das nächste dran ist. Deshalb das Feld `dauer` in Sekunden. Fehlt
es, nimmt er die `dauer` des Senders und schaltet nach dieser Zeit
weiter, egal wie lang die Datei wirklich ist.

Ein **Webradio** braucht davon nichts: es läuft ohnehin schon, und wer
sich dranhängt, hört dasselbe wie alle anderen. Spulen und weiterschalten
geht dort nicht.

Was gerade läuft, steht trotzdem da. Icecast und Shoutcast schieben den
Titel im ICY-Verfahren zwischen die Audiodaten — ein `<audio>` im Browser
reicht das nicht heraus, also liest der Server kurz mit und gibt die
Zeile weiter. Sender, die nichts mitschicken, zeigen ihren Namen; mehr
gibt es dort dann nicht zu holen.

Läuft kein Server (`index.html` direkt geöffnet), spielt jeder Sender
lokal weiter — dann eben mit eigener Reihenfolge. Webradios gibt es dann
gar nicht, denn sie stehen beim Server.

`dauer` beim Sender gilt nur für die eingebauten Loops — die enden nie
von allein. Eine Datei läuft bis zum Ende und gibt dann weiter.
In `tracks` dürfen beide Arten stehen, eingebaute Loops (`keller`,
`nebel`, `beton`, `turbo`, `saeure`) genauso wie eigene Dateien.

Wer oben ein Stück von Hand anklickt, beendet die Sendung — die eigene
Wahl gewinnt. Wechselt jemand den Anstrich, während ein Sender läuft, den
es dort nicht gibt, hört die Sendung ebenfalls auf; die Musik selbst
läuft mit dem angefangenen Stück weiter.

Gibt es für den laufenden Anstrich gar keinen Sender, verschwindet der
ganze Abschnitt aus dem Fenster — eine Überschrift über einem leeren
Kasten wäre nur eine Frage ohne Antwort.

---

## Dateiformate

MP3, OGG, WAV und M4A funktionieren; MP3 spielt überall. Kurze Effekte sind
als MP3 oder OGG am unkompliziertesten.

Die Dateien laufen durch denselben Lautstärkeregler wie alles andere. Nimm
also normal ausgesteuerte Dateien und regle Feinheiten über `volume` statt in
der Datei selbst.

---

## Wenn etwas nicht klingt

In der Browser-Konsole:

```js
GK.sfxPack.debug('click')          // welche Datei gilt gerade?
GK.sfxPack.debug('boom', 'crash')  // und im Spiel Crash?
GK.sfxPack.problems                // Liste der Ladefehler
GK.sfxPack.broken                  // Einträge, die nicht gelesen werden konnten
GK.sfxPack.unknown                 // Einträge mit einem Namen, den es nicht gibt
GK.sfxPack.names()                 // alle gültigen Tonnamen
GK.sfxPack.reload()                // sounds.json neu einlesen
```

`debug` zeigt unter `quelle`, ob gerade `datei`, `eingebaut` oder `stumm`
gilt, und unter `geladen`, ob die Datei schon im Speicher liegt.

Häufige Ursachen:

* **Pfad falsch.** Pfade gelten ab diesem Ordner: `ui/klick.mp3` meint
  `assets/sfx/ui/klick.mp3`.
* **Name falsch geschrieben.** Ein Eintrag, den kein Spiel abruft, liegt still
  da und der bisherige Klang läuft weiter — etwa `loss` statt `lose`. Solche
  Namen werden beim Laden gemeldet und stehen in `GK.sfxPack.unknown`; das
  gilt auch für einen Spielnamen unter `games`, den es nicht gibt.
* **Erster Ton kommt noch eingebaut.** Dateien werden beim ersten Bedarf
  geladen; ab dem zweiten Mal liegen sie bereit. Mit `"preload": true` ist
  schon der erste Ton die Datei.
* **Ton kommt nach dem Bild.** Meist steht Stille am Anfang der Datei — beim
  Schneiden bleibt vorne gern eine halbe Sekunde stehen, und die zählt beim
  Abspielen voll mit. Sie wird automatisch übersprungen; wie viel, zeigt
  `GK.sfxPack.debug('cash').vorlauf` in Millisekunden. Soll die Datei doch von
  ganz vorn laufen: `"trim": false`. Ein eigenes `"offset"` hat immer Vorrang.
* **Langer Klang bei einem schnellen Ereignis.** Manche Spiele wiederholen
  einen Ton im Takt — das Hufgetrappel etwa alle 150 ms. Der eingebaute Klang
  ist dort ein einzelner Schlag. Legst du eine ganze Galopp-Aufnahme darüber,
  merkt das Spiel das und spielt sie **einmal**, statt zwanzig Kopien
  übereinanderzulegen.
* **Tippfehler in sounds.json.** Die Datei wird in drei Stufen gelesen:
  normal, dann nach dem Übergehen von Kommentaren und einem Komma zu viel vor
  der schließenden Klammer, und zuletzt Eintrag für Eintrag. In der letzten
  Stufe fällt nur der kaputte Eintrag weg — alle anderen Klänge spielen
  weiter. Welcher es war, steht mit Zeilennummer in `GK.sfxPack.broken` und
  kurz nach dem Laden auch als Meldung auf der Seite.
* **Nach dem Deploy unverändert.** Die Dateien werden beim Bauen ins Image
  gelegt, ein Neustart allein reicht nicht: `docker compose up -d --build`.
