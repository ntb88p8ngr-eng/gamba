# 👑 GAMBAKING — Fantasy Casino

Ein knallbuntes Fantasy-Casino für Challenges unter Freunden. **Kein Echtgeld, keine
Einzahlung, keine Auszahlung** — alle Chips sind wertlose Spielwährung. Es geht nur um
Angeben, Ehre und die Krone im Leaderboard.

14 Spiele, Level-System mit freischaltbaren Spielen, eigenes Icon-Set, prozedural
erzeugte Hintergrundmusik und ein gemeinsames Leaderboard über einen kleinen Server.

---

## Los geht's

```bash
node server.js          # → http://localhost:3000
```

Mehr braucht es nicht: **keine Abhängigkeiten, kein Build, kein npm install.** Der Server
liefert die Seite aus *und* hält die Spielstände.

Beim ersten Besuch legst du ein **Konto mit Passwort** an, danach meldest du dich jedes
Mal damit an. Jeder startet mit **500 Chips**.

**Für die Runde mit Freunden:** Server auf einem Rechner starten, alle anderen öffnen
dessen IP im Browser (`http://192.168.x.x:3000`) — alle sehen dasselbe Leaderboard, live.

Ohne Server geht es auch: `index.html` direkt öffnen. Dann läuft alles im
**Offline-Modus** — ohne Konten und Passwörter, der Spielstand bleibt nur in diesem
einen Browser.

```bash
PORT=8080 node server.js          # anderer Port
GAMBAKING_PIN=4711 node server.js # eigene Admin-PIN
```

### Mit HTTPS (Let's Encrypt)

Wenn ein Zertifikat da ist, spricht der Server direkt TLS — kein Reverse-Proxy nötig:

```bash
# kurz über die Domain
SSL_DOMAIN=casino.deine-domain.de PORT=443 HTTP_REDIRECT_PORT=80 node server.js

# oder die Pfade einzeln
SSL_CERT=/etc/letsencrypt/live/deine.domain/fullchain.pem \
SSL_KEY=/etc/letsencrypt/live/deine.domain/privkey.pem \
PORT=443 node server.js
```

* `SSL_DOMAIN` ist die Kurzform für die beiden Standardpfade unter
  `/etc/letsencrypt/live/<domain>/`.
* `HTTP_REDIRECT_PORT=80` schickt alles von `http://` per `301` auf `https://`.
* **Erneuerung ohne Neustart:** der Server überwacht die Zertifikatsdateien und lädt sie
  nach dem `certbot renew` automatisch nach (`setSecureContext`). Im Log steht dann
  *„Zertifikat neu geladen"*.
* Fehlt oder klemmt das Zertifikat, sagt der Server das beim Start und läuft über HTTP
  weiter, statt abzustürzen.

Zwei Stolpersteine: Die Dateien unter `/etc/letsencrypt` gehören root — der Server muss
sie lesen dürfen. Und die Ports 80/443 brauchen unter Linux ebenfalls Rechte; entweder
als root starten, `setcap` verwenden, oder einen hohen Port nehmen und einen
Reverse-Proxy davorsetzen.

Sobald der Server öffentlich steht, greift außerdem eine **Brute-Force-Bremse**: nach
8 Fehlversuchen ist die Kombination aus IP und Spielername 15 Minuten gesperrt.

### Im Docker-Container, neben einer bestehenden Website

```bash
cp .env.example .env      # Domain, Unterpfad und Admin-PIN eintragen
docker compose up -d --build
```

Damit läuft das Casino als Container hinter Traefik unter
`https://deine-domain.ddns.net/gamba/`, während deine bisherige Seite auf `/` bleibt.
TLS macht dann Traefik, der Container selbst spricht HTTP.

Drei Umgebungsvariablen sind dafür da:

| Variable | Bedeutung |
|---|---|
| `BASE_PATH=/gamba` | die Seite liegt in einem Unterpfad; der Server nimmt `/gamba/api/…` **und** `/api/…` an und leitet `/gamba` auf `/gamba/` weiter |
| `TRUST_PROXY=1` | echte Besucher-IP aus `X-Forwarded-For` — sonst teilen sich alle dieselbe Brute-Force-Bremse |
| `DATA_DIR=/data` | Spielstände ins Volume statt ins Image |

Zum Ausprobieren ohne Traefik:
`docker compose -f docker-compose.local.yml up --build` → `http://localhost:8080/gamba/`

Die komplette Anleitung inklusive Traefik-Beispiel, bestehendem certbot-Zertifikat,
nginx-Variante und Backup steht in **[docs/DOCKER.md](docs/DOCKER.md)**.

---

## Die 14 Spiele

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
| 14 | **Königs-Poker** 🔒 Lv10 | Texas Hold'em gegen drei KI-Gegner, Blinds, Bluffs und Showdown | ganzer Pot | 8 % Rake |

Beim Poker gibt es keine feste Quote: dort spielst du gegen die drei KI-Gegner, nicht
gegen das Haus. Das Haus nimmt nur **8 % Rake** vom gewonnenen Pot — und auch das nur,
wenn es überhaupt zum Flop kam. In 20.000 simulierten Händen kommt ein Spieler, der
genauso spielt wie die Gegner, auf **91,6 %**; wer solide passt und erhöht, auf **94 %**;
wer alles mitgeht, auf **81 %**. Gutes Spiel zahlt sich also wirklich aus.

Die Quoten sind bewusst **knapper als im echten Casino** — es soll sich verdient anfühlen.
Wer komplett pleite ist, bekommt **50 Mitleids-Chips** — aber nur **einmal pro Tag**.
Dazu gibt es alle 24 Stunden **250 Chips Tagesbonus**. Wer beides an einem Tag
verbraucht und trotzdem alles verzockt, muss bis morgen warten oder den Admin fragen.

---

## 🔐 Konten & Anmeldung

* **Registrieren:** Name, Passwort (min. 4 Zeichen) und Avatar. Namen sind eindeutig.
* **Anmelden:** bei jedem Besuch. Die Sitzung liegt im `sessionStorage` — ein Reload im
  selben Tab bleibt angemeldet, ein neuer Besuch verlangt wieder das Passwort.
* **Passwort ändern:** im Kontomenü (Klick auf den eigenen Namen oben rechts).
* **Passwort vergessen:** der Admin setzt es im Admin-Panel per 🔑 neu. Dabei fliegen
  alle laufenden Sitzungen dieses Kontos raus.

Passwörter werden mit **scrypt und eigenem Salt** gehasht; im Klartext wird nichts
gespeichert und die Hashes verlassen den Server nie. Jede Spielaktion braucht eine
gültige Sitzung — Anfragen auf ein fremdes Konto beantwortet der Server mit `403`,
Anfragen ohne Sitzung mit `401`.

**Zur Übertragung:** Mit `SSL_DOMAIN`/`SSL_CERT` läuft alles über HTTPS, dann sind auch
die Passwörter unterwegs verschlüsselt (siehe oben). Ohne Zertifikat spricht der Server
reines HTTP — im heimischen WLAN in Ordnung, aber dann bitte kein Passwort nehmen, das
du anderswo benutzt.

---

## ⭐ Level & XP

XP gibt es fürs Spielen: **Einsatz/8** pro Runde (max. 60) plus Bonus-XP für Gewinne.
Jedes Level bringt **100 × Level an Chips** — und vier Spiele schalten sich erst mit der
Zeit frei (Level 2, 4, 7 und 10).

Die Kurve ist bewusst lang: Level 2 braucht 280 XP, Level 4 schon 1.200, Level 7 ganze
3.480 und Level 10 satte 6.840. Bei einem Einsatz von 25 Chips sind das grob
**40 / 170 / 500 / 1.000 Runden** — das Pferderennen ist schnell offen, der
Tiefsee-Schatz ist ein Projekt für mehrere Abende und der Pokertisch das Fernziel.

Titel steigen mit: Chip-Küken → Zocker → Hochroller → Casino-Hai → Legende → GambaKing.

Level-Chips zählen wie Admin-Geschenke **nicht** als Profit im Leaderboard.

---

## 🛡️ Admin-Modus

Schild oben rechts → **PIN `1337`** (im Panel oder per `GAMBAKING_PIN` änderbar).

* **💸 Money-Give** — Spieler antippen, Betrag eingeben, `GEBEN`. Auch `ABZIEHEN` und
  `SETZEN AUF`.
* **⭐ XP geben** — einzeln oder für alle; Level und Freischaltungen passen sich sofort an.
  XP abziehen kann ein Spiel auch wieder sperren.
* **🔑 Passwort zurücksetzen** — pro Spieler, direkt in der Spielerliste.
* **🎁 Allen geben** · **♻️ Alle auf 500** · **🗑 Alle Daten löschen**
* **🍀 Glücks-Regler** — heimlicher Cheat pro Spieler (0 = verflucht, 100 = gesegnet).
* **🔑 PIN ändern** und **Spieler löschen**.

Alle Admin-Aktionen laufen über ein Server-Token. Ohne gültige PIN antwortet der Server
mit `403` — auch wenn jemand die Anfrage von Hand baut. **Daten löschen kann nur der
Admin**, im Footer gibt es dafür keinen Knopf mehr.

---

## 🎵 Musik & Sound

* **Acht Loops** — vier ruhige (Neon Lounge, Tiefsee, Retro Chips, Mitternacht) und
  vier schnelle (Turbo-Rausch 140, Jackpot-Fieber 128, Adrenalin 152, All In 170 BPM),
  komplett per Web Audio erzeugt — keine Audio-Dateien, kein Nachladen.
* **Lautstärkeregler** direkt neben dem Mute-Button in der Kopfzeile.
* **🎵-Button** öffnet das Menü mit Track-Auswahl, getrennten Reglern für Musik und
  Spiel-Sounds und einem klaren **Musik aus**.
* Alle Spiel-Sounds sind ebenfalls synthetisiert.

---

## 🏆 Leaderboard

Vier Wertungen: **Chips**, **Profit** (ohne geschenkte Chips), **bester Einzelgewinn**
und **Anzahl Spiele** — plus Level und Titel pro Spieler. Darunter läuft ein Live-Feed
aller Gewinne, Pleiten und Admin-Aktionen.
In der Lobby aktualisiert sich alles alle 6 Sekunden vom Server.

---

## Technik

```
server.js           Node-Server ohne Abhängigkeiten: liefert die Seite, hält die Daten,
                    optional mit TLS und automatischem Zertifikats-Nachladen
data/               wird beim ersten Start angelegt (gambaking.json)

Dockerfile          Image auf Basis node:22-alpine, läuft als Benutzer node
docker-compose.yml  Casino hinter Traefik unter /gamba
docs/DOCKER.md      Anleitung für den Betrieb neben einer bestehenden Website

index.html          Grundgerüst
css/style.css       Layout, Neon-Look, Level-Leiste, Modals, Responsive
css/games.css       Styles der einzelnen Spiele
js/core.js          State, Sync, Audio-Engine, Effekte, XP/Level, Einsatz-Widget
js/net.js           Server-Anbindung, Anmeldung und Sitzungen, Offline-Fallback
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

**Ehrlich gesagt:** Konten und Kontostände sind abgesichert — fremde Konten kann niemand
anfassen. Aber die Spielausgänge werden weiterhin im Browser gewürfelt: wer die
Entwicklertools öffnet, kann sich auf dem **eigenen** Konto Chips erschummeln. Für ein
Fantasy-Casino unter Freunden ist das in Ordnung; für echten Wettbewerb müssten die
Würfel auf den Server wandern.

**Neues Spiel hinzufügen:** `GK.registerGame({ id, name, emoji, icon, blurb, badge,
color, minLevel, rules, mount(root) })`. `mount` baut die Oberfläche und gibt optional
eine Aufräumfunktion zurück.

Getestet in Chromium, Desktop (1400 px) und Mobil (360/390 px): alle 14 Spiele,
Level-Freischaltung, Admin-Flows, Server-Sync über zwei Geräte — ohne JS-Fehler.
`prefers-reduced-motion` wird respektiert.

---

## ⚠️ Hinweis

GambaKing simuliert Glücksspiel **ausschließlich zu Unterhaltungszwecken**. Es gibt keine
Einzahlung, keinen Kauf von Chips und keinerlei Auszahlung. Die Chips haben keinen Wert.
