# 👑 GAMBAKING — Fantasy Casino

Ein knallbuntes Fantasy-Casino für Challenges unter Freunden. **Kein Echtgeld, keine
Einzahlung, keine Auszahlung** — alle Chips sind wertlose Spielwährung. Es geht nur um
Angeben, Ehre und die Krone im Leaderboard.

13 Spiele, Level-System mit freischaltbaren Spielen, eigenes Icon-Set, prozedural
erzeugte Hintergrundmusik und ein gemeinsames Leaderboard über einen kleinen Server.

---

## Los geht's

```bash
node server.js          # → http://localhost:3000
```

Mehr braucht es nicht: **keine Abhängigkeiten, kein Build, kein npm install.** Der Server
liefert die Seite aus *und* hält die Spielstände.

Beim ersten Besuch fragt ein Popup nach **Spielername + Avatar**. Jeder startet mit
**500 Chips**.

**Für die Runde mit Freunden:** Server auf einem Rechner starten, alle anderen öffnen
dessen IP im Browser (`http://192.168.x.x:3000`) — alle sehen dasselbe Leaderboard, live.

Ohne Server geht es auch: `index.html` direkt öffnen. Dann läuft alles im
**Offline-Modus** und die Spielstände bleiben nur in diesem einen Browser.

```bash
PORT=8080 node server.js          # anderer Port
GAMBAKING_PIN=4711 node server.js # eigene Admin-PIN
```

---

## Die 13 Spiele

| # | Spiel | Was passiert | Max | Quote |
|---|-------|--------------|-----|-------|
| 1 | **Fantasy Reels** | 3 Walzen, gestaffelter Stopp, Auto-Spin | 50× | 87 % |
| 2 | **Neon Roulette** | Europäisches Rad (0–36), Farben, Dutzende, Einzelzahlen | 32× | 87–92 % |
| 3 | **Royal Blackjack** | 6 Decks, Hit/Stand/Doppeln, Dealer zieht bis 17, BJ zahlt 6:5 | 6:5 | ~97 % |
| 4 | **Drachenmünze** | Krone oder Drache, 3D-Flip, feste Bonus-Chips für Siegesserien | 1,9× + Bonus | 95 % |
| 5 | **Würfelduell** | Duell gegen den Dealer, Über/Unter 7, Exakt 7 | 5,1× | 85–92 % |
| 6 | **Raketen-Crash** | Multiplikator steigt live, Cash-out vor dem Crash, Auto-Cashout | ∞ | 92 % |
| 7 | **Drachenhöhle** | 5×5 Minenfeld, 1–24 Drachen, jederzeit auszahlen | ~200× | 92 % |
| 8 | **Rad des Schicksals** | 20 Segmente zwischen Totenkopf und Jackpot | 5× | 87 % |
| 9 | **Plinko Palast** | 12 Reihen Pins, 3 Risikostufen, mehrere Kugeln gleichzeitig | 40× | 90 % |
| 10 | **Runen-Rubbellos** | Echtes Freirubbeln mit Maus/Finger, 3 Gleiche gewinnen | 20× | 85 % |
| 11 | **Königliches Pferderennen** 🔒 Lv2 | 5 Pferde mit eigenen Quoten, Live-Rennen mit Führungswechseln | 11× | 88 % |
| 12 | **Eisbär auf dem Eis** 🔒 Lv4 | Scholle für Scholle nach oben, 3 Schwierigkeiten, jederzeit aussteigen | 233× | 91 % |
| 13 | **Tiefsee-Schatz** 🔒 Lv7 | 5 Walzen, 5 Gewinnlinien, Wild-Dreizack und Scatter-Truhe | 1900× | 85 % |

Die Quoten sind bewusst **knapper als im echten Casino** — es soll sich verdient anfühlen.
Wer komplett pleite ist, bekommt automatisch **50 Mitleids-Chips**, dazu gibt es alle
24 Stunden **250 Chips Tagesbonus**.

---

## ⭐ Level & XP

XP gibt es fürs Spielen: **Einsatz/4** pro Runde (max. 150) plus Bonus-XP für Gewinne.
Jedes Level bringt **100 × Level an Chips** — und drei Spiele schalten sich erst mit der
Zeit frei (Level 2, 4 und 7).

Titel steigen mit: Chip-Küken → Zocker → Hochroller → Casino-Hai → Legende → GambaKing.

Level-Chips zählen wie Admin-Geschenke **nicht** als Profit im Leaderboard.

---

## 🛡️ Admin-Modus

Schild oben rechts → **PIN `1337`** (im Panel oder per `GAMBAKING_PIN` änderbar).

* **💸 Money-Give** — Spieler antippen, Betrag eingeben, `GEBEN`. Auch `ABZIEHEN` und
  `SETZEN AUF`.
* **⭐ XP geben** — einzeln oder für alle; Level und Freischaltungen passen sich sofort an.
  XP abziehen kann ein Spiel auch wieder sperren.
* **🎁 Allen geben** · **♻️ Alle auf 500** · **🗑 Alle Daten löschen**
* **🍀 Glücks-Regler** — heimlicher Cheat pro Spieler (0 = verflucht, 100 = gesegnet).
* **🔑 PIN ändern** und **Spieler löschen**.

Alle Admin-Aktionen laufen über ein Server-Token. Ohne gültige PIN antwortet der Server
mit `403` — auch wenn jemand die Anfrage von Hand baut. **Daten löschen kann nur der
Admin**, im Footer gibt es dafür keinen Knopf mehr.

---

## 🎵 Musik & Sound

* **Vier minimalistische Loops** (Neon Lounge, Tiefsee, Retro Chips, Mitternacht),
  komplett per Web Audio erzeugt — keine Audio-Dateien, kein Nachladen.
* **Lautstärkeregler** direkt neben dem Mute-Button in der Kopfzeile.
* **🎵-Button** öffnet das Menü mit Track-Auswahl, getrennten Reglern für Musik und
  Spiel-Sounds und einem klaren **Musik aus**.
* Alle Spiel-Sounds sind ebenfalls synthetisiert.

---

## 🏆 Leaderboard

Vier Wertungen: **Chips**, **Profit** (ohne geschenkte Chips), **bester Einzelgewinn**
und **Anzahl Spiele** — plus Level und Titel pro Spieler. Klick auf eine Zeile wechselt
zu diesem Spieler. Darunter läuft ein Live-Feed aller Gewinne, Pleiten und Admin-Aktionen.
In der Lobby aktualisiert sich alles alle 6 Sekunden vom Server.

---

## Technik

```
server.js           Node-Server ohne Abhängigkeiten: liefert die Seite + hält die Daten
data/               wird beim ersten Start angelegt (gambaking.json)

index.html          Grundgerüst
css/style.css       Layout, Neon-Look, Level-Leiste, Modals, Responsive
css/games.css       Styles der einzelnen Spiele
js/core.js          State, Sync, Audio-Engine, Effekte, XP/Level, Einsatz-Widget
js/net.js           Server-Anbindung mit Offline-Fallback
js/icons.js         Eigenes SVG-Icon-Set (Drachen, Früchte, Meerestiere, …)
js/music.js         Sequencer für die Hintergrund-Loops
js/games/*.js       Ein Modul pro Spiel (registriert sich selbst)
js/app.js           Lobby, Leaderboard, Level-UI, Spielerverwaltung, Admin-Panel
assets/logo.svg     Logo (Krone auf Casino-Chip)
```

**Datenfluss:** Der Client rechnet Spielausgänge lokal (für sofortiges Feedback) und
schickt jede Änderung als typisierte Operation (`wager`, `payout`, `xp`, `grant`, …) an
den Server. Der Server rechnet sie selbst nach — er übernimmt keine Kontostände vom
Client — und antwortet mit dem verbindlichen Stand. Fällt der Server aus, läuft alles
lokal weiter.

**Ehrlich gesagt:** Wer die Entwicklertools öffnet, kann sich Chips erschummeln. Für ein
Fantasy-Casino unter Freunden ist das in Ordnung; für echten Wettbewerb müssten die
Spielausgänge auf dem Server gewürfelt werden.

**Neues Spiel hinzufügen:** `GK.registerGame({ id, name, emoji, icon, blurb, badge,
color, minLevel, rules, mount(root) })`. `mount` baut die Oberfläche und gibt optional
eine Aufräumfunktion zurück.

Getestet in Chromium, Desktop (1400 px) und Mobil (360/390 px): alle 13 Spiele,
Level-Freischaltung, Admin-Flows, Server-Sync über zwei Geräte — ohne JS-Fehler.
`prefers-reduced-motion` wird respektiert.

---

## ⚠️ Hinweis

GambaKing simuliert Glücksspiel **ausschließlich zu Unterhaltungszwecken**. Es gibt keine
Einzahlung, keinen Kauf von Chips und keinerlei Auszahlung. Die Chips haben keinen Wert.
