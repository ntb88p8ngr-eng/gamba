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
  "games":    { "crash": { "boom": "…" } }
}
```

| Block | Wofür |
|---|---|
| `defaults` | gilt für alle Klänge |
| `sounds` | globale Belegung, greift überall |
| `games` | Abweichungen für ein einzelnes Spiel |

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

Gültige ids: `slots`, `roulette`, `blackjack`, `coinflip`, `dice`, `crash`,
`mines`, `wheel`, `plinko`, `scratch`, `horses`, `icebear`, `ocean`, `poker`,
`penguin`, `scratch9`, `mystery`, `smaugcave`, `baccarat`.

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
* **Tippfehler in sounds.json.** Die Datei wird in drei Stufen gelesen:
  normal, dann nach dem Übergehen von Kommentaren und einem Komma zu viel vor
  der schließenden Klammer, und zuletzt Eintrag für Eintrag. In der letzten
  Stufe fällt nur der kaputte Eintrag weg — alle anderen Klänge spielen
  weiter. Welcher es war, steht mit Zeilennummer in `GK.sfxPack.broken` und
  kurz nach dem Laden auch als Meldung auf der Seite.
* **Nach dem Deploy unverändert.** Die Dateien werden beim Bauen ins Image
  gelegt, ein Neustart allein reicht nicht: `docker compose up -d --build`.
