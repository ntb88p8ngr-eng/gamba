# 👑 GAMBAKING — Fantasy Casino

Ein knallbuntes Fantasy-Casino für Challenges unter Freunden. **Kein Echtgeld, keine
Einzahlung, keine Auszahlung** — alle Chips sind wertlose Spielwährung. Es geht nur um
Angeben, Ehre und die Krone im Leaderboard.

Reines HTML/CSS/JavaScript. Kein Build, kein Framework, keine Abhängigkeiten, kein Server.
`index.html` im Browser öffnen und los.

---

## Los geht's

```bash
# einfach doppelklicken …
open index.html

# … oder lokal ausliefern (empfohlen, damit alles sauber lädt)
python3 -m http.server 8000
# → http://localhost:8000
```

Beim ersten Besuch fragt ein Popup nach **Spielername + Avatar**. Jeder startet mit
**500 Chips**. Alles wird in `localStorage` gespeichert — mehrere Freunde am selben Gerät
legen einfach mehrere Spieler an und wechseln über den Namen oben rechts.

---

## Die 10 Spiele

| # | Spiel | Was passiert | Max |
|---|-------|--------------|-----|
| 1 | 🎰 **Fantasy Reels** | 3 Walzen, gestaffelter Stopp, Auto-Spin | 50× |
| 2 | 🎡 **Neon Roulette** | Europäisches Rad (0–36), Farben, Dutzende, Einzelzahlen | 36× |
| 3 | 🃏 **Royal Blackjack** | 6 Decks, Hit/Stand/Doppeln, Dealer zieht bis 17, BJ zahlt 3:2 | 3:2 |
| 4 | 🪙 **Drachenmünze** | Krone oder Drache, 3D-Flip, Serien-Bonus ab 3 Siegen | 3× |
| 5 | 🎲 **Würfelduell** | Duell gegen den Dealer, Über/Unter 7, Exakt 7 | 5,5× |
| 6 | 🚀 **Raketen-Crash** | Multiplikator steigt live, Cash-out vor dem Crash, Auto-Cashout | ∞ |
| 7 | 💎 **Drachenhöhle** | 5×5 Minenfeld, 1–24 Drachen, jederzeit auszahlen | ~200× |
| 8 | 🎡 **Rad des Schicksals** | 20 Segmente zwischen ☠ und Jackpot | 5× |
| 9 | 🔻 **Plinko Palast** | 12 Reihen Pins, 3 Risikostufen, mehrere Kugeln gleichzeitig | 40× |
| 10 | 🎫 **Runen-Rubbellos** | Echtes Freirubbeln mit Maus/Finger, 3 Gleiche gewinnen | 20× |

Wer komplett pleite ist, bekommt automatisch **50 Mitleids-Chips** — niemand fliegt raus.
Dazu gibt es alle 24 Stunden einen **Tagesbonus** von 250 Chips.

---

## 🛡️ Admin-Modus

Schild-Symbol oben rechts → **PIN `1337`** (im Panel änderbar).

* **💸 Money-Give** — Spieler antippen, Betrag eingeben, `GEBEN`. Auch `ABZIEHEN` und
  `SETZEN AUF` für einen exakten Kontostand.
* **🎁 Allen geben** — Chips-Regen für den ganzen Tisch.
* **♻️ Alle auf 500** — neue Runde, alle Statistiken zurück auf Anfang.
* **🍀 Glücks-Regler** — heimlicher Cheat pro Spieler (0 = verflucht, 50 = neutral,
  100 = gesegnet). Wirkt auf alle Spiele außer Blackjack.
* **🗑 Spieler löschen** und **🔑 PIN ändern**.

Geschenkte Chips werden separat verbucht und zählen **nicht** als Profit im Leaderboard —
so bleibt die Rangliste ehrlich, auch wenn der Admin großzügig war.

---

## 🏆 Leaderboard

Vier Wertungen: **Chips**, **Profit** (ohne Admin-Geschenke), **bester Einzelgewinn** und
**Anzahl Spiele**. Klick auf eine Zeile wechselt zu diesem Spieler. Darunter läuft ein
Live-Feed mit den letzten Gewinnen, Pleiten und Admin-Aktionen.

---

## Technik

```
index.html          Struktur & Sound-freie Basis
css/style.css       Layout, Neon-Look, Modals, Leaderboard, Responsive
css/games.css       Styles der einzelnen Spiele
js/core.js          State, localStorage, Audio-Engine, Effekte, Einsatz-Widget
js/games/*.js       Ein Modul pro Spiel (registriert sich selbst)
js/app.js           Lobby, Leaderboard, Spielerverwaltung, Admin-Panel
assets/logo.svg     Logo (Krone auf Casino-Chip)
```

* **Sound** wird komplett per Web Audio API synthetisiert — keine Audio-Dateien.
  Browser starten Audio erst nach der ersten Interaktion; der Ton-Button oben schaltet um.
* **Animationen**: CSS-Keyframes plus Canvas für Konfetti, Emoji-Regen, Crash-Kurve
  und Plinko. `prefers-reduced-motion` wird respektiert.
* **Neues Spiel hinzufügen**: `GK.registerGame({ id, name, emoji, blurb, badge, color,
  rules, mount(root) })`. `mount` baut die Oberfläche und gibt optional eine
  Aufräumfunktion zurück.
* Getestet in Chromium (Desktop 1400px und Mobil 360/390px) — alle 10 Spiele laufen
  fehlerfrei durch.

---

## ⚠️ Hinweis

GambaKing simuliert Glücksspiel **ausschließlich zu Unterhaltungszwecken**. Es gibt keine
Einzahlung, keinen Kauf von Chips und keinerlei Auszahlung. Die Chips haben keinen Wert.
Alle Daten bleiben lokal im Browser und lassen sich im Footer jederzeit vollständig löschen.
