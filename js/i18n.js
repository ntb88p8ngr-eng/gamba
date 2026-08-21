/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Sprachumschalter

   Die Seite ist auf Deutsch geschrieben und bleibt es auch: Deutsch ist
   die Quelle, Englisch die Übersetzung. Statt jeden Aufruf im ganzen
   Programm mit einem Schlüssel zu versehen — das wären tausende Stellen in
   einundzwanzig Spielmodulen —, übersetzt dieses Modul den fertigen
   Bildschirm: es geht den Baum durch, tauscht bekannte Texte aus und hört
   danach mit einem MutationObserver zu, damit auch alles Nachgezeichnete
   übersetzt wird.

   Vorteile: kein Spielmodul muss angefasst werden, und was im Wörterbuch
   fehlt, bleibt einfach auf Deutsch stehen statt zu verschwinden.

   Umgeschaltet wird ohne Neuladen: jede Änderung am Baum wird in `beruehrt`
   vermerkt, und der Weg zurück auf Deutsch stellt genau diese Stellen wieder
   her. Was im Wörterbuch fehlt, bleibt unangetastet stehen.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var SCHLUESSEL = 'gambaking:sprache';
  var sprache = 'de';
  try { sprache = localStorage.getItem(SCHLUESSEL) === 'en' ? 'en' : 'de'; } catch (e) {}

  GK.lang = function () { return sprache; };

  /* ── Wörterbuch ──────────────────────────────────────────────────────
     Schlüssel ist der deutsche Text, genau so wie er auf dem Schirm steht
     (Groß- und Kleinschreibung inbegriffen, Leerraum wird vorher gestutzt). */
  var WB = {
    /* Kopf, Fuß, Hauptseite */
    'fantasy casino · kein echtgeld': 'fantasy casino · no real money',
    'Chips': 'Chips',
    'Gast': 'Guest',
    '0 € ECHTGELD': '0 € REAL MONEY',
    '100% CHAOS': '100% CHAOS',
    'ZUFALLSSPIEL': 'RANDOM GAME',
    'MULTIPLAYER': 'MULTIPLAYER',
    'LEADERBOARD': 'LEADERBOARD',
    'TAGESBONUS': 'DAILY BONUS',
    '🎰 DIE SPIELHALLE': '🎰 THE ARCADE',
    '🏆 LEADERBOARD': '🏆 LEADERBOARD',
    '💰 Chips': '💰 Chips',
    '📈 Profit': '📈 Profit',
    '💥 Bester Win': '💥 Best win',
    '🎮 Spiele': '🎮 Rounds',
    '➕ Konto erstellen': '➕ Create account',
    '📜 LETZTE AKTIONEN': '📜 LATEST ACTION',
    'Multiplayer': 'Multiplayer',
    '← LOBBY': '← LOBBY',
    '❔ REGELN': '❔ RULES',
    'Spiel': 'Game',
    'ist ein Fantasy-Casino. Es wird': 'is a fantasy casino. No',
    'kein echtes Geld': 'real money',
    'eingesetzt, gewonnen oder ausgezahlt. Alle Chips sind wertlose Spielwährung — nur für Spaß & Challenges unter Freunden.':
      'is wagered, won or paid out. All chips are worthless play money — just for fun and challenges among friends.',
    '18+ Vibes, 0 € Einsatz ·': '18+ vibes, 0 € stakes ·',
    'Konten und Spielstände liegen auf dem Casino-Server': 'Accounts and progress live on the casino server',
    'Spielstände liegen auf dem Casino-Server': 'Progress lives on the casino server',
    'Offline-Modus: Spielstände nur in diesem Browser': 'Offline mode: progress stays in this browser',
    '· Löschen kann nur der Admin': '· only the admin can delete them',
    'Jeder startet mit': 'Everyone starts with',
    'Wer am Ende die dickste Krone trägt, gewinnt Ruhm, Ehre und ewiges Angeben-Recht.':
      'Whoever wears the fattest crown at the end wins glory, honour and eternal bragging rights.',
    'Hier erscheint gleich, wer gerade abräumt (oder alles verliert).':
      'This is where you will see who is cleaning up (or losing everything).',
    'Hier erscheint gleich, wer in der Party abräumt (oder alles verliert).':
      'This is where you will see who is cleaning up in the party (or losing everything).',
    'Noch keine Spieler. Leg los und hol dir die Krone!': 'No players yet. Get going and grab the crown!',

    /* Anmeldung und Konto */
    'Anmelden': 'Log in', 'Neues Konto': 'New account', 'Abmelden': 'Log out',
    'Name': 'Name', 'Passwort': 'Password', 'Passwort wiederholen': 'Repeat password',
    'Dein Konto': 'Your account', 'Konto': 'Account', 'Spieler': 'Players',
    'Bester Win': 'Best win', 'Profit': 'Profit', 'Gespielt': 'Rounds played',
    'Chips gesamt': 'Total chips', 'Level': 'Level',
    'Willkommen zurück!': 'Welcome back!',
    'Passwort ändern': 'Change password',
    'Abbrechen': 'Cancel', 'Schließen': 'Close', 'Weiter': 'Continue', 'Fertig': 'Done',
    'JA, RAUS': 'YES, LEAVE',

    /* Einsatz-Widget und Spielrahmen */
    'DEIN EINSATZ': 'YOUR BET', 'EINSATZ': 'BET', 'Einsatz': 'Bet',
    'ALL IN 🔥': 'ALL IN 🔥', 'MIN': 'MIN',
    'REGELN': 'RULES', 'So geht das': 'How it works',
    'Zurück': 'Back', '← ZURÜCK': '← BACK',
    'Nicht genug Chips! 😅': 'Not enough chips! 😅',
    'Gewonnen!': 'You win!', 'Verloren': 'You lose',
    'Nochmal': 'Again', 'STARTEN': 'START', 'SPIN': 'SPIN', 'DREHEN': 'SPIN',
    'AUSSTEIGEN': 'CASH OUT', 'CASH OUT': 'CASH OUT', 'WEITER': 'CONTINUE',
    'ENDLOS': 'ENDLESS', 'AUTO AUS': 'AUTO OFF', 'AUTO AN': 'AUTO ON',

    /* Spielnamen */
    'Fantasy Slots': 'Fantasy Slots', 'Neon Roulette': 'Neon Roulette',
    'Royal Blackjack': 'Royal Blackjack', 'Baccarat Royale': 'Baccarat Royale',
    'Drachenmünze': 'Dragon Coin', 'Würfelduell': 'Dice Duel',
    'Raketen-Crash': 'Rocket Crash', 'Drachenhöhle': 'Dragon Lair',
    'Rad des Schicksals': 'Wheel of Fate', 'Plinko Palast': 'Plinko Palace',
    'Runen-Rubbellos': 'Rune Scratcher', 'Königliches Pferderennen': 'Royal Horse Race',
    'Blitzhuf': 'Lightning Hoof', 'Eisbär auf dem Eis': 'Polar Bear on Ice',
    'Tiefsee-Schatz': 'Deep Sea Treasure', 'Königs-Poker': "King's Poker",
    'Pinguin-Sprung': 'Penguin Hop', 'Kristall-Rubbellos': 'Crystal Scratcher',
    'Mitternachts-Mysterium': 'Midnight Mystery', 'Flatterflug': 'Flutter Flight',
    'Endlos-Sprung': 'Endless Jump', 'Smaugs Höhle': "Smaug's Lair",

    /* Kacheln: Kurztexte */
    'Drei Walzen voller Drachen, Kronen und Kirschen. Drei Gleiche = Regen aus Chips.':
      'Three reels full of dragons, crowns and cherries. Three of a kind = a rain of chips.',
    'Rot, Schwarz oder die eine mutige Zahl. Das Rad entscheidet über Ruhm und Elend.':
      'Red, black or that one brave number. The wheel decides between glory and misery.',
    'Komm auf 21 — oder so nah wie möglich. Der Dealer zieht bis 17. Nerven aus Stahl nötig.':
      'Get to 21 — or as close as you can. The dealer draws to 17. Nerves of steel required.',
    'Punto Banco wie im Salon. Setz auf Player, Banker oder Tie — und lass die Karten sprechen.':
      'Punto Banco like in the salon. Back player, banker or tie — and let the cards talk.',
    'Krone oder Drache. 50/50, keine Ausreden. Serien geben fette Bonus-Multiplikatoren.':
      'Crown or dragon. 50/50, no excuses. Streaks pay fat bonus multipliers.',
    'Zwei Würfel, vier Wettarten und ein Dealer, der dich auslachen will.':
      'Two dice, four bet types and a dealer who wants to laugh at you.',
    'Der Multiplikator steigt und steigt. Cash out bevor die Rakete explodiert — oder verlier alles.':
      'The multiplier climbs and climbs. Cash out before the rocket blows — or lose it all.',
    'Sammle Edelsteine im Drachenhort. Hinter jedem Feld lauert vielleicht ein Drache.':
      'Collect gems in the dragon hoard. A dragon may lurk behind every tile.',
    'Ein Dreh, ein Schicksal. Zwischen Totenkopf und 5× liegt nur ein bisschen Karma.':
      'One spin, one fate. Between skull and 5× lies nothing but karma.',
    'Kugel rein, Nerven raus. 12 Reihen Chaos entscheiden, wo dein Einsatz landet.':
      'Ball in, nerves out. Twelve rows of chaos decide where your bet lands.',
    'Freirubbeln mit der Maus. Drei gleiche Runen und die Chips gehören dir.':
      'Scratch it open with the mouse. Three matching runes and the chips are yours.',
    'Fünf Pferde, eine Bahn, null Vernunft. Setz auf deinen Favoriten und brüll ihn ins Ziel.':
      'Five horses, one track, zero reason. Back your favourite and yell it home.',
    'Führ den Eisbären über die Schollen. Jeder Schritt zahlt mehr — bis das Eis unter ihm bricht.':
      'Guide the polar bear across the floes. Every step pays more — until the ice breaks.',
    '5×5 Felder, 15 Gewinnlinien, ein versunkener Schatz. Truhen zahlen überall — und öffnen die Freispiele.':
      '5×5 tiles, 15 paylines, a sunken treasure. Chests pay anywhere — and open the free spins.',
    "Texas Hold'em gegen drei sture KI-Gegner. Bluffen erlaubt, Zittern inklusive.":
      "Texas hold'em against three stubborn bots. Bluffing allowed, shaking included.",
    'Von Scholle zu Scholle Richtung Horizont. Jeder Sprung zahlt mehr — und jeder kann der letzte sein.':
      'From floe to floe towards the horizon. Every hop pays more — and every one could be the last.',
    'Neun Felder, acht Linien. Jede Reihe aus drei gleichen Runen zahlt — und sie zählen alle zusammen.':
      'Nine tiles, eight lines. Every row of three matching runes pays — and they all add up.',
    'Ruf Seelen auf den Altar. Solange neue kommen, brennen die Kerzen weiter — und der Einsatz wächst.':
      'Call souls to the altar. While new ones arrive the candles keep burning — and the stake grows.',
    'Ein Tipp lässt ihn steigen, sonst fällt er. Jede Röhre zahlt mehr — und die Lücke wird enger.':
      'A tap lifts him, otherwise he drops. Every pipe pays more — and the gap gets tighter.',
    'Von Plattform zu Plattform immer höher. Jede Stufe zahlt mehr — und die Fledermäuse werden mehr.':
      'From platform to platform, ever higher. Every level pays more — and the bats keep coming.',
    'Ein Schiebe-Labyrinth voller Gold — schleich dich tief hinein, aber wehe, Smaug wacht auf.':
      'A sliding maze full of gold — sneak in deep, but woe if Smaug wakes up.',

    /* Mehrspieler und Party */
    'Neue Party': 'New party', 'Partymodus': 'Party mode',
    'PARTY AUFMACHEN': 'OPEN PARTY', 'PARTY STARTEN': 'START PARTY',
    'PARTY VERLASSEN': 'LEAVE PARTY', 'MITMACHEN': 'JOIN', 'LÄUFT': 'RUNNING', 'VOLL': 'FULL',
    'Party verlassen?': 'Leave the party?',
    'Party läuft': 'Party running', 'Party vorbei': 'Party over',
    'Startchips für alle': 'Starting chips for everyone', 'Spielzeit': 'Play time',
    'Erlaubte Spiele': 'Allowed games', 'Alle Spiele offen': 'All games unlocked',
    'Nachschub bei null Chips': 'Top-up at zero chips',
    'Aus — wer blank ist, ist raus': 'Off — broke is out',
    'Der Gastgeber startet die Party.': 'The host starts the party.',
    'EINSTELLUNGEN ÄNDERN': 'CHANGE SETTINGS', 'NOCH EINE RUNDE': 'ANOTHER ROUND',
    'Tisch verlassen': 'Leave table', 'Neuer Tisch': 'New table', 'Tische': 'Tables',
    'Warten auf Mitspieler…': 'Waiting for players…',

    /* Admin */
    'Admin-Modus': 'Admin mode', 'Admin-Panel': 'Admin panel', 'ADMIN-PIN': 'ADMIN PIN',
    'SPIELER': 'PLAYERS', 'BETRAG': 'AMOUNT', 'GEBEN': 'GIVE', 'ABZIEHEN': 'TAKE',
    'SETZEN AUF': 'SET TO', 'ERFAHRUNG (XP & LEVEL)': 'EXPERIENCE (XP & LEVEL)',
    'XP-BETRAG': 'XP AMOUNT', 'XP GEBEN': 'GIVE XP', 'ALLEN XP GEBEN': 'GIVE XP TO ALL',
    'GLÜCKS-REGLER (HEIMLICHER CHEAT)': 'LUCK SLIDER (SECRET CHEAT)',
    'QUOTEN JE SPIEL': 'ODDS PER GAME', 'ALLE NEUTRAL': 'ALL NEUTRAL',
    'STATISTIK': 'STATISTICS', 'Alle Spieler': 'All players', 'Alle Spiele': 'All games',
    'Netto Spieler': 'Player net', 'Einsätze': 'Bets', 'Auszahlungen': 'Payouts',
    'Runden': 'Rounds', 'Logins': 'Logins', 'Gesamt': 'Overall',
    '1 Std': '1 hr', '3 Std': '3 hrs', '6 Std': '6 hrs', '12 Std': '12 hrs',
    '24 Std': '24 hrs', '7 Tage': '7 days', '30 Tage': '30 days',
    '📊 Balken': '📊 Bars', '📈 Linie': '📈 Line',
    'OFFENE TISCHE & PARTYS': 'OPEN TABLES & PARTIES', 'AKTUALISIEREN': 'REFRESH',
    'NÄCHSTER WIPE': 'NEXT WIPE', 'DATUM (0 UHR)': 'DATE (MIDNIGHT)',
    'WIPE PLANEN': 'SCHEDULE WIPE', 'ABSAGEN': 'CANCEL',
    'Stufen mit zurücksetzen': 'Reset levels too',
    'EINZELNEN SPIELER ZURÜCKSETZEN': 'RESET A SINGLE PLAYER',
    'SPIELER ZURÜCKSETZEN': 'RESET PLAYER', 'VERWALTUNG': 'MANAGEMENT',
    'ALLEN GEBEN': 'GIVE TO ALL', 'PIN ÄNDERN': 'CHANGE PIN', 'ADMIN VERLASSEN': 'LEAVE ADMIN',
    'GEFAHRENZONE': 'DANGER ZONE', 'ALLE DATEN LÖSCHEN': 'DELETE ALL DATA',
    'Gerade ist nichts offen.': 'Nothing is open right now.',
    'Keine Spieler vorhanden.': 'No players yet.',

    /* Häufige Sätze aus den Spielen */
    'Setz deine Chips und leg los!': 'Place your chips and go!',
    'Setz deine Chips!': 'Place your chips!',
    'ENDLOS': 'ENDLESS',
    'Endlos-Modus gestoppt — Chips reichen nicht mehr': 'Endless mode stopped — not enough chips left',
    'Nur Wasser. Nochmal abtauchen?': 'Just water. Dive again?',
    'ABTAUCHEN': 'DIVE', 'TAUCHEN': 'DIVE',
    'RITUAL BEGINNEN': 'START RITUAL', 'AUTO-RITUAL': 'AUTO RITUAL', 'RITUAL': 'RITUAL',
    'LOSFLIEGEN': 'TAKE OFF', 'LOSSPRINGEN': 'START JUMPING',
    'RAKETE STARTEN': 'LAUNCH ROCKET', 'AUTO-CASHOUT BEI': 'AUTO CASHOUT AT',
    'LETZTE RUNDEN': 'LAST ROUNDS', 'Die Walzen drehen…': 'The reels are spinning…',
    'Freispiel läuft…': 'Free spin running…', 'FREISPIELE': 'FREE SPINS',
    'Noch am Boden': 'Still on the ground', 'Der Flug läuft. Aussteigen geht jederzeit.':
      'The flight is on. You can cash out any time.',
    'Der Lauf läuft. Stufe 0.': 'The run is on. Level 0.',
    'Rauf mit dir — aussteigen geht jederzeit!': 'Up you go — cash out any time!',
    'Flügel raus — tippen zum Steigen!': 'Wings out — tap to climb!',
    'ABGESTÜRZT': 'CRASHED', 'TIPPEN ZUM FLATTERN': 'TAP TO FLAP',
    'TIPPEN ZUM STARTEN': 'TAP TO START',
    'Tippen oder Leertaste für den nächsten Versuch': 'Tap or press space for another try',
    'Tippen oder Leertaste für den nächsten Lauf': 'Tap or press space for another run',
    'A/D bewegen · Klick schießt · Leertaste startet': 'A/D to move · click to shoot · space starts',
    'Tippen, Leertaste oder LOSFLIEGEN drücken': 'Tap, press space or hit TAKE OFF',
    'AUTOMATISCH AUSSTEIGEN NACH': 'AUTO CASH OUT AFTER',
    'AUTOMATISCH AUSSTEIGEN NACH STUFE': 'AUTO CASH OUT AFTER LEVEL',
    'Nur der Admin darf das': 'Only the admin may do that',
    'Sitzung abgelaufen': 'Session expired',
    'Name oder Passwort stimmt nicht': 'Name or password is wrong',
    'Diesen Namen gibt es schon — melde dich an': 'That name is taken — log in instead',
    'Nicht genug Chips': 'Not enough chips',

    /* Wett-Erklärungen, die beim Umschalten der Wettart neu gesetzt werden.
       Sie stehen zwar in einem p.hint, kommen aber als reiner Text — daher
       gehören sie hierher und nicht ins HTML-Wörterbuch. */
    'Zahlt 1:1. Gewinnt, wenn die Spielerhand naeher an 9 liegt.':
      'Pays 1:1. Wins when the player hand is closer to 9.',
    'Zahlt 1:1, ohne Kommission — und gewinnt etwas oefter als Player.':
      'Pays 1:1, no commission — and wins slightly more often than player.',
    'Zahlt 8:1, trifft aber selten. Bei Gleichstand kassiert nur diese Wette.':
      'Pays 8:1 but rarely hits. On a tie only this bet cashes in.',
    'Deine Summe muss die des Dealers schlagen. Gleichstand = Einsatz zurück.':
      'Your total has to beat the dealer’s. A tie returns your bet.',
    'Deine beiden Würfel zusammen müssen mehr als 7 ergeben.':
      'Your two dice together have to add up to more than 7.',
    'Deine beiden Würfel zusammen müssen weniger als 7 ergeben.':
      'Your two dice together have to add up to less than 7.',
    'Genau 7 — der riskante Held-Move.': 'Exactly 7 — the risky hero move.',
    /* Die Kurzhilfen an den Einsatz-Chips — sie stehen in jedem Spiel. */
    '1 weniger': '1 less', '5 weniger': '5 less', '50 weniger': '50 less',
    '1 mehr': '1 more', 'Alles setzen': 'Bet everything', 'Halbieren': 'Halve',
    'Verdoppeln': 'Double',

    /* Beschriftungen aus einzelnen Spielen */
    'Auszahlung': 'Payout', 'Nächster Bonus': 'Next bonus', 'Nächster': 'Next',
    'Noch nichts gesetzt — tipp auf die Felder': 'Nothing placed yet — tap the fields',
    '2 Drachen': '2 dragons', '3 Drachen': '3 dragons', '5 Drachen': '5 dragons',
    '8 Drachen': '8 dragons', '12 Drachen': '12 dragons', '18 Drachen': '18 dragons',
    '24 Drachen': '24 dragons',
    '☠ Nichts': '☠ Nothing',
    '0,5× halb zurück': '0.5× half back', '1× zurück': '1× your bet',
    '3 gleiche Runen = Gewinn': '3 matching runes = a win',
    '„Die Pferde sind am Start…"': '“The horses are at the gate…”',
    '❄️ Dünnes Eis': '❄️ Thin ice',
    '· 2× auf alles': '· 2× on everything',
    'V groß': 'V wide', 'Λ groß': 'Λ wide', 'Treppe auf': 'stairs up',
    'Treppe ab': 'stairs down', 'Welle': 'wave', 'Zacke': 'zigzag',
    '„Setz dich, der Tisch wartet."': '“Sit down, the table is waiting.”',
    'ein Einsatz': 'one bet', 'doppelter Einsatz': 'double bet',
    'Auf die Scholle tippen zum Springen': 'Tap the floe to hop',
    'Der Altar ist kalt.': 'The altar is cold.',
    'Smaug schläft tief.': 'Smaug sleeps deeply.',
    'Ersatzkachel drehen, dann eine Reihe/Spalte schieben.':
      'Turn the spare tile, then push a row or column.',
    'Schlüssel': 'Keys',

    /* ── Meldungen aus dem Spielbetrieb ──
       Was ohne Zahlen darin auskommt, steht hier; alles mit eingesetzten
       Werten läuft unten über die Muster. */
    /* ── Knöpfe in den Spielen ──
       Sie tragen ihr Symbol im selben Text — deshalb steht es im Schlüssel
       mit drin, sonst greift das Wörterbuch nicht. */
    '🎰 SPIN': '🎰 SPIN', '🔁 AUTO 10': '🔁 AUTO 10', '♾️ ENDLOS': '♾️ ENDLESS',
    '↩ LETZTEN ZURÜCK': '↩ UNDO LAST', '🗑 TISCH RÄUMEN': '🗑 CLEAR TABLE',
    '🎡 DREH DAS RAD': '🎡 SPIN THE WHEEL', '🎡 SCHICKSAL DREHEN': '🎡 SPIN FATE',
    '🃏 KARTEN GEBEN': '🃏 DEAL CARDS', '🎴 KARTEN GEBEN': '🎴 DEAL CARDS',
    '💰 DOPPELN': '💰 DOUBLE', 'KRONE': 'CROWN', 'DRACHE': 'DRAGON',
    '🪙 MÜNZE WERFEN': '🪙 TOSS THE COIN', '🎲 WÜRFELN': '🎲 ROLL THE DICE',
    '🤖 AUTO AUS': '🤖 AUTO OFF', '🤖 AUTO AN': '🤖 AUTO ON',
    '🚀 RAKETE STARTEN': '🚀 LAUNCH ROCKET',
    '⛏️ HÖHLE BETRETEN': '⛏️ ENTER THE CAVE', '🗝️ HÖHLE BETRETEN': '🗝️ ENTER THE CAVE',
    '💰 AUSZAHLEN': '💰 CASH OUT', '💰 AUSSTEIGEN': '💰 CASH OUT',
    '🤯 Irre': '🤯 Insane', '🔻 KUGEL FALLEN LASSEN': '🔻 DROP THE BALL',
    '🎫 LOS KAUFEN': '🎫 BUY A TICKET', '💠 LOS KAUFEN': '💠 BUY A TICKET',
    '👁 ALLES AUFDECKEN': '👁 REVEAL EVERYTHING',
    '🏇 RENNEN STARTEN': '🏇 START THE RACE',
    '🧊 Dickes Eis': '🧊 Thick ice', '❄️ Dünnes Eis': '❄️ Thin ice',
    '💀 Todeseis': '💀 Death ice', '🐻‍❄️ LOSMARSCHIEREN': '🐻‍❄️ SET OFF',
    '🌊 ABTAUCHEN': '🌊 DIVE',
    '🃏 EINE HAND': '🃏 ONE HAND', '🃏🃏 ZWEI HÄNDE': '🃏🃏 TWO HANDS',
    '♠️ NEUE HAND': '♠️ NEW HAND', '🏳️ PASSEN': '🏳️ FOLD',
    '✔️ CHECK / MITGEHEN': '✔️ CHECK / CALL', '🔥 ERHÖHEN': '🔥 RAISE',
    '✔️ CHECK': '✔️ CHECK', '📞 MITGEHEN': '📞 CALL',
    '🐧 LOSSPRINGEN': '🐧 START HOPPING', '🦘 LOSSPRINGEN': '🦘 START JUMPING',
    '➡️ WEITER': '➡️ CONTINUE',
    '🕯️ RITUAL BEGINNEN': '🕯️ BEGIN THE RITUAL', '🔁 AUTO-RITUAL': '🔁 AUTO RITUAL',
    '🐦 LOSFLIEGEN': '🐦 TAKE OFF',
    '⟳ DREHEN': '⟳ TURN', '🏃 FLIEHEN & SICHERN': '🏃 FLEE & BANK IT',
    '1 Drache': '1 dragon',

    'Viel Glück!': 'Good luck!',
    'Rot': 'Red', 'Schwarz': 'Black', 'Gerade': 'Even', 'Ungerade': 'Odd',
    /* Symbole aus den Walzenspielen und den Rubbellosen */
    'Alge': 'Kelp', 'Muschel': 'Shell', 'Fisch': 'Fish', 'Riff-Fisch': 'Reef fish',
    'Krabbe': 'Crab', 'Krake': 'Octopus', 'Hai': 'Shark', 'Perle': 'Pearl',
    'Dreizack': 'Trident', 'Schatztruhe': 'Treasure chest',
    'Krone': 'Crown', 'Stern': 'Star', 'Juwel': 'Jewel', 'Flamme': 'Flame',
    'Kleeblatt': 'Clover', 'Münze': 'Coin', 'Kirsche': 'Cherry', 'Glocke': 'Bell',
    'Königskrone': "King's crown",
    'Das Rad dreht sich…': 'The wheel is spinning…',
    /* Smaugs Wachsamkeit und die Absturzgründe beim Flatterflug */
    'Schläft': 'Asleep', 'Regt sich': 'Stirring', 'Misstrauisch': 'Suspicious',
    'Wach': 'Awake', 'JAGT!': 'HUNTING!', 'SMAUG JAGT DICH!': 'SMAUG IS HUNTING YOU!',
    'Im Boden gelandet': 'Hit the ground',
    'Die Münze fliegt…': 'The coin is in the air…',
    'Die Würfel fliegen…': 'The dice are rolling…',
    'Vorsichtig… welche Scholle hält?': 'Careful… which floe will hold?',
    'Das Eis bricht! 🌊 Der Bär schwimmt, dein Einsatz nicht.':
      'The ice breaks! 🌊 The bear swims, your bet does not.',
    'Das Eis knackt schon… viel Glück!': 'The ice is cracking already… good luck!',
    'Platsch. Der Pinguin schwimmt zurück.': 'Splash. The penguin swims back.',
    'Keine einzige Seele erscheint — der Einsatz verhallt.':
      'Not a single soul appears — the bet fades away.',
    'Jeder Sockel besetzt — der Grand-Bonus fällt.':
      'Every pedestal taken — the grand bonus drops.',
    'Zu wenige Seelen für einen Gewinn.': 'Too few souls for a win.',
    'Die Kerzen sind aus. Das Ritual hat gehalten.':
      'The candles are out. The ritual held.',
    'Die letzte Kerze erlischt.': 'The last candle goes out.',
    'Auto-Ritual gestoppt — Chips reichen nicht mehr':
      'Auto ritual stopped — not enough chips left',
    'Mindestens 5 Chips (5 Linien)': 'At least 5 chips (5 lines)',
    'Keine Linie, keine Bonus-Rune — Niete!': 'No line, no bonus rune — a blank!',
    'Keine einzige Röhre geschafft.': 'Not a single pipe made.',
    'Keine einzige Stufe geschafft.': 'Not a single level made.',
    'Voll in die Röhre': 'Straight into the pipe',
    '1× — Einsatz zurück, nichts passiert': '1× — bet back, nothing happens',
    '☠ Totenkopf — das Schicksal ist grausam': '☠ Skull — fate is cruel',
    'Dafür reichen deine Chips nicht': 'Your chips are not enough for that',
    'Erst Chips auf den Tisch legen': 'Put some chips on the table first',
    'Für diesen Grundeinsatz reichen die Chips nicht':
      'Your chips are not enough for this base bet',
    'Hand abgebrochen — zu wenig Chips': 'Hand aborted — not enough chips',
    'Dir fehlen die Chips zum Mitgehen — du kannst nur passen.':
      'You are short of chips to call — folding is all that is left.',
    'Weiter geht’s — deine Hand von vorhin.': 'Carry on — your hand from before.',
    'Weiter geht’s — die Hand von vorhin.': 'Carry on — the hand from before.',
    'Weiter geht’s — die Runde von vorhin.': 'Carry on — the round from before.',
    'Weiter geht’s — du bist am Zug.': 'Carry on — it is your move.',
    'Weiter geht’s — schieb eine Reihe.': 'Carry on — push a row.',
    'Weiter rubbeln — dein Los von vorhin.': 'Keep scratching — your ticket from before.',
    'Kein Weg frei — die Runde geht ohne Bewegung weiter.':
      'No way through — the round continues without a move.',
    'Stern! Der nächste Fund zählt doppelt ✨': 'Star! The next find counts double ✨',
    'Alle Schlüssel! Smaugs Hort ist offen 🔓': 'All keys! Smaug’s hoard is open 🔓',
    'Zaubertrank getrunken — kurzzeitig weniger Verdacht 🧪':
      'Potion drunk — less suspicion for a moment 🧪',
    'Deine Figur stand auf der geschobenen Kachel und ist mitgewandert!':
      'Your figure stood on the pushed tile and travelled along!',
    'Nutze das Labyrinth: schiebe Smaug aus, dann lauf zum Ausgang!':
      'Use the maze: push Smaug out of the way, then run for the exit!',
    'Smaug hat dich erwischt — Schatz und Einsatz verbrannt.':
      'Smaug caught you — treasure and bet burned.',
    'Du schleichst dich in die Höhle…': 'You sneak into the cave…',
    'Der Berg aus Gold glänzt im Feuerschein. Smaug schläft — für jetzt. Was nimmst du mit?':
      'The mound of gold gleams in the firelight. Smaug sleeps — for now. What do you take?',
    'Such die Edelsteine… 💎': 'Find the gems… 💎',

    /* Pokerblätter und das Geplauder am Tisch */
    'Hohe Karte': 'High card', 'Ein Paar': 'One pair', 'Zwei Paare': 'Two pair',
    'Drilling': 'Three of a kind', 'Straße': 'Straight', 'Vierling': 'Four of a kind',
    'Beide Hände vorn': 'Both hands ahead', 'Alle passen': 'Everyone folds',
    'Gewonnen': 'Won', 'River — letzte Runde.': 'River — last round.',
    'Zurueck auf eine Hand.': 'Back to one hand.',
    'Das war zu leicht.': 'That was too easy.',
    'Einmal ist keinmal!': 'Once is never!',
    'Geduld ist eine Waffe.': 'Patience is a weapon.',
    'Ich warte auf Besseres.': 'I am waiting for something better.',
    'Chips sind nur Konfetti.': 'Chips are just confetti.',
    '„Setz dich, der Tisch wartet."': '“Sit down, the table is waiting.”',

    /* Namen, die in den Regeln mit übersetzt sind — sonst stünde in der
       Regel „Golden Mane" und auf der Bahn „Goldmähne". */
    'Blitzhuf': 'Lightning Hoof', 'Donnerwolke': 'Thundercloud',
    'Kleefuchs': 'Clover Fox', 'Schattentanz': 'Shadow Dance',
    'Goldmähne': 'Golden Mane',
    'Baron von Bluff': 'Baron von Bluff', 'Gräfin Eiskalt': 'Countess Icecold',
    'Onkel Kalle': 'Uncle Charlie',

    'WETTART': 'BET TYPE',
    '⚔️ Duell': '⚔️ Duel', '⬆️ Über 7': '⬆️ Over 7',
    '⬇️ Unter 7': '⬇️ Under 7', '🎯 Exakt 7': '🎯 Exactly 7',
    '🌫️ Nebelschleier': '🌫️ Veil of Mist', '🌕 Blutmond': '🌕 Blood Moon',
    '🕳️ Abgrund': '🕳️ Abyss',
    'viele Seelen, kleine Werte': 'many souls, small values',
    'ausgewogen, mit Zähnen': 'balanced, with teeth',
    'selten, dafür brutal': 'rare, but brutal'
  };

  /* ── Ganze Absätze mit Auszeichnung ─────────────────────────────────
     Die Tipps unter den Spielen bestehen aus mehreren Textstücken mit <b>
     dazwischen. Stückweise zu übersetzen ginge zwar, wäre aber ein Wörterbuch
     aus Halbsätzen — deshalb werden diese Absätze am Stück ausgetauscht.
     Verglichen wird der zusammengeschobene innerHTML. */
  var HTML_SELEKTOR = 'p.hint, .mp-intro, .admin-note, .party-schalter-was, .fl-info, .jp-info';
  var WB_HTML = {
    '💡 Tipp: Die Krone zahlt <b>100×</b>. Zwei gleiche Symbole retten dir immerhin einen Teil vom Einsatz. <b>Endlos</b> dreht weiter, bis du stoppst oder die Chips alle sind.':
      '💡 Tip: the crown pays <b>100×</b>. Two matching symbols at least save part of your bet. <b>Endless</b> keeps spinning until you stop or run out of chips.',
    '💡 Du kannst <b>beliebig viele Felder gleichzeitig</b> belegen — jeder Klick legt einen weiteren Chip drauf. Rechtsklick räumt ein Feld wieder ab.':
      '💡 You can cover <b>as many fields at once</b> as you like — every click adds another chip. Right-click clears a field again.',
    '💡 6 Decks, Dealer bleibt auf <b>17</b> stehen. Blackjack zahlt <b>6:5</b>.':
      '💡 6 decks, the dealer stands on <b>17</b>. Blackjack pays <b>6:5</b>.',
    '💡 8 Decks. Die dritte Karte folgt fester Tabelle — <b>Banker</b> gewinnt etwas oefter als Player und zahlt hier trotzdem voll aus.':
      '💡 8 decks. The third card follows a fixed table — <b>banker</b> wins slightly more often than player and still pays in full here.',
    '💡 Bei <b>Irre</b> zahlen die Außenfächer 40× — die Mitte frisst dafür fast alles.':
      '💡 On <b>Insane</b> the outer slots pay 40× — but the middle eats almost everything.',
    '💡 Halt die Maus gedrückt und wisch über die Felder. Ab rund <b>einem Drittel</b> freigerubbelt springt das Feld von selbst auf.':
      '💡 Hold the mouse down and wipe across the tiles. Once about <b>a third</b> is scratched off, the tile opens by itself.',
    '💡 Acht Linien auf einem Los: die <b>Mitte</b> liegt in vier davon. Zwei Linien gleichzeitig sind kein Zufall, sondern der Normalfall bei einem guten Los.':
      '💡 Eight lines on one ticket: the <b>centre</b> sits in four of them. Two lines at once is not luck, it is what a good ticket looks like.',
    '💡 Der Geber (<b>D</b>) rückt jede Hand weiter. Das Haus nimmt <b>8 % Rake</b> — aber nur, wenn ein Flop fällt.':
      '💡 The dealer button (<b>D</b>) moves on every hand. The house takes <b>8 % rake</b> — but only if a flop is dealt.',
    '💡 Du kannst auch <b>direkt auf die nächste Scholle tippen</b>. Jeder Sprung gelingt mit <b>75 %</b>; nach zwölf Schollen ist das Festland erreicht — <b>27,5×</b>.':
      '💡 You can also <b>tap the next floe directly</b>. Every hop succeeds with <b>75 %</b>; after twelve floes you reach the mainland — <b>27.5×</b>.',
    '💡 Es zählt die <b>Summe</b> aller Seelen. Jede neue Seele stellt die drei Kerzen zurück — lange Ketten sind der eigentliche Gewinn.':
      '💡 What counts is the <b>sum</b> of all souls. Every new soul resets the three candles — long chains are where the money is.',
    '💡 Je näher an Smaugs Hort in der Mitte, desto wertvoller der Fund — und desto wacher wird er. Vor „JAGT!“ kannst du jederzeit fliehen.':
      '💡 The closer to Smaug\'s hoard in the middle, the richer the find — and the more awake he gets. Before “HUNTING!” you can flee at any time.',
    '💡 Der <b>Dreizack</b> ersetzt alles außer der Truhe. Fünf Dreizacke auf einer Linie zahlen <b>1900×</b> den Linieneinsatz. <b>Endlos</b> taucht weiter, bis du stoppst oder die Chips alle sind.':
      '💡 The <b>trident</b> substitutes for everything except the chest. Five tridents on one line pay <b>1900×</b> the line bet. <b>Endless</b> keeps diving until you stop or run out of chips.',
    '💡 <b>Tippen oder Leertaste</b> — auch zum Starten. Der Zuwachs je Röhre wächst mit, dafür wird die Lücke enger und das Tempo höher. Nach <b>25 Röhren</b> zahlt der Flug von selbst aus.':
      '💡 <b>Tap or press space</b> — that starts the run too. The gain per pipe keeps growing, but the gap gets tighter and the pace faster. After <b>25 pipes</b> the flight cashes out by itself.',
    '💡 <b>A</b>/<b>D</b> bewegen, <b>Klick</b> schießt — am Handy die Knöpfe unter dem Feld und ein Tipp aufs Feld. Ein Tipp startet auch den Lauf.':
      '💡 <b>A</b>/<b>D</b> to move, <b>click</b> to shoot — on a phone use the buttons on the field and tap the field itself. A tap also starts the run.',
    'Noch am Boden': 'Still on the ground',
    '⚠️ Alle Chips sind <b>reine Fantasie</b> — kein echtes Geld, keine Auszahlung.':
      '⚠️ All chips are <b>pure fantasy</b> — no real money, no payout.'
  };

  /* Muster für Texte mit Zahlen darin. Reihenfolge zählt: die erste
     passende Regel gewinnt. */
  var REGELN = [
    [/^(\d+) SPIELE$/, '$1 GAMES'],
    [/^(\d+) SPIELE · 1 KRONE$/, '$1 GAMES · 1 CROWN'],
    [/^Lv (\d+)$/, 'Lv $1'],
    [/^Level (\d+) nötig$/, 'Needs level $1'],
    [/^Ab Level (\d+)$/, 'From level $1'],
    [/^(.+) Chips$/, '$1 chips'],
    [/^Einsatz (.+)$/, 'Bet $1'],
    [/^Gewinn (.+)$/, 'Win $1'],
    [/^(\d+) Runden$/, '$1 rounds'],
    [/^(\d+) Spiele$/, '$1 rounds'],
    [/^(\d+) Siege$/, '$1 wins'],
    [/^vor (\d+) Min\.$/, '$1 min ago'],
    [/^vor (\d+) Std\.$/, '$1 hrs ago'],
    [/^gerade eben$/, 'just now'],
    [/^(\d+) Min\.$/, '$1 min'],
    [/^(\d+) Std\.$/, '$1 hrs'],
    [/^Willkommen zurück, (.+)! 👑$/, 'Welcome back, $1! 👑'],
    [/^AUTO (\d+)$/, 'AUTO $1'],
    [/^Stufe (\d+)$/, 'Level $1'],
    [/^Stufe (\d+) · (.+)$/, 'Level $1 · $2'],
    [/^(\d+) Röhren · (.+)$/, '$1 pipes · $2'],
    /* Legende im Rad des Schicksals: Beschriftung und Anzahl in einem Stück. */
    [/^0,5× halb zurück \((\d+)\)$/, '0.5× half back ($1)'],
    [/^1× zurück \((\d+)\)$/, '1× your bet ($1)'],
    [/^☠ Nichts \((\d+)\)$/, '☠ Nothing ($1)'],
    [/^(\d+(?:,\d+)?)× Jackpot \((\d+)\)$/, '$1× jackpot ($2)'],
    /* Startnummer und Pferdename stehen zusammen in einer Zeile. */
    [/^(\d+) Blitzhuf$/, '$1 Lightning Hoof'],
    [/^(\d+) Donnerwolke$/, '$1 Thundercloud'],
    [/^(\d+) Kleefuchs$/, '$1 Clover Fox'],
    [/^(\d+) Schattentanz$/, '$1 Shadow Dance'],
    [/^(\d+) Goldmähne$/, '$1 Golden Mane'],
    /* Nummer und Name der Gewinnlinie im Tiefsee-Schatz. */
    [/^(\d+) V groß$/, '$1 V wide'],
    [/^(\d+) Λ groß$/, '$1 Λ wide'],
    [/^(\d+) V klein$/, '$1 V narrow'],
    [/^(\d+) Λ klein$/, '$1 Λ narrow'],
    [/^(\d+) Treppe auf$/, '$1 stairs up'],
    [/^(\d+) Treppe ab$/, '$1 stairs down'],
    [/^(\d+) Welle$/, '$1 wave'],
    [/^(\d+) Gegenwelle$/, '$1 counter-wave'],
    [/^(\d+) Zacke$/, '$1 zigzag'],
    [/^(\d+) Gegenzacke$/, '$1 counter-zigzag'],
    [/^(\d+) Mitte$/, '$1 middle'],
    [/^(\d+) Oben$/, '$1 top'],
    [/^(\d+) Unten$/, '$1 bottom'],
    [/^(\d+) Zwei$/, '$1 second'],
    [/^(\d+) Vier$/, '$1 fourth'],
    /* ── Meldungen mit eingesetzten Werten ──
       Die Ersetzung darf auch eine Funktion sein: dann lässt sich ein Name
       aus der Mitte noch einmal durchs Wörterbuch schicken (Pferde, Gegner
       am Pokertisch), statt ihn deutsch stehen zu lassen. */
    /* Die Zeile im Statistik-Hinweis unter dem Zeiger */
    [/^(.+) Runden · (.+) gesetzt · (.+) ausgezahlt · (.+) Logins$/,
      '$1 rounds · $2 staked · $3 paid out · $4 logins'],
    [/^(.+) Runden · (.+) gesetzt · (.+) ausgezahlt$/, '$1 rounds · $2 staked · $3 paid out'],
    /* Knöpfe, die eine Zahl mittragen */
    [/^➡️ WEITER \((.+)\)$/, '➡️ CONTINUE ($1)'],
    [/^📞 MITGEHEN \((.+)\)$/, '📞 CALL ($1)'],
    [/^🔥 ERHÖHEN \((.+)\)$/, '🔥 RAISE ($1)'],
    [/^💰 AUSSTEIGEN \((.+)\)$/, '💰 CASH OUT ($1)'],
    [/^🏃 FLIEHEN \((.+)\)$/, '🏃 FLEE ($1)'],
    [/^(\d+)× automatisch$/, '$1× automatic'],
    [/^(\d+) Drachen$/, '$1 dragons'],
    [/^max (.+)$/, 'max $1'],
    /* Freispiele und Treffermeldungen der Walzenspiele */
    [/^\+(\d+) Freispiele — die Serie geht weiter!$/, '+$1 free spins — the run continues!'],
    [/^(\d+) Freispiele! Jeder Gewinn zählt (.+)$/, '$1 free spins! Every win counts $2'],
    [/^(\d+)× (.+) auf Linie (\d+)(.*)$/,
      function (m, n, sym, li, rest) { return n + '× ' + (WB[sym] || sym) + ' on line ' + li + rest; }],
    [/^Runde zu Ende gespielt — (.+) Chips verloren$/, 'Round played out — $1 chips lost'],
    [/^Runde zu Ende gespielt — (.+) Chips$/, 'Round played out — $1 chips'],
    [/^Runde abgebrochen — (.+) Chips zurück$/, 'Round cancelled — $1 chips back'],
    [/^(.+) (\d+) — gewonnen! \+(.+)$/, '$1 $2 — you win! +$3'],
    [/^(.+) gewinnt mit (\d+) gegen (\d+)$/, '$1 wins with $2 against $3'],
    [/^(.+) bei (\d+) Röhren — (.+) Chips futsch$/,
      function (m, woran, n, c) { return (WB[woran] || woran) + ' at ' + n + ' pipes — ' + c + ' chips gone'; }],
    [/^Gleichstand bei (\d+) — Einsatz zurück$/, 'Tie at $1 — bet returned'],
    [/^Push bei (\d+) — Einsatz zurück$/, 'Push at $1 — bet returned'],
    [/^Dealer überkauft mit (\d+)! 🎉(.*)$/, 'Dealer busts with $1! 🎉$2'],
    [/^Überkauft mit (\d+)(.*)$/, 'Bust with $1$2'],
    [/^(\d+) schlägt (\d+) — gewonnen!(.*)$/, '$1 beats $2 — you win!$3'],
    [/^(\d+) schlägt deine (\d+)( 😤)?$/, '$1 beats your $2$3'],
    [/^(\d+) schlägt (\d+) 🏆(.*)$/, '$1 beats $2 🏆$3'],
    [/^(\d+) — über 7! 🎉(.*)$/, '$1 — over 7! 🎉$2'],
    [/^(\d+) — unter 7! 🎉(.*)$/, '$1 — under 7! 🎉$2'],
    [/^(\d+) — nicht über 7$/, '$1 — not over 7'],
    [/^(\d+) — nicht unter 7$/, '$1 — not under 7'],
    [/^(\d+) — keine 7$/, '$1 — no 7'],
    [/^EXAKT 7! 🎯 (.+)$/, 'EXACTLY 7! 🎯 $1'],
    [/^CRASH bei (.+)× — Einsatz verglüht 💀$/, 'CRASH at $1× — bet burned up 💀'],
    [/^Flug beendet bei (.+) — (.+) Chips gesichert$/, 'Flight ended at $1 — $2 chips secured'],
    [/^Lauf beendet auf Stufe (\d+) — (.+) Chips gesichert$/,
      'Run ended at level $1 — $2 chips secured'],
    [/^Ausgestiegen auf Stufe (\d+)(.*)$/, 'Cashed out at level $1$2'],
    [/^Ein Drache! 🐉 Einsatz von (.+) verbrannt\.$/, 'A dragon! 🐉 Bet of $1 burned.'],
    [/^Keine Seele — noch (\d+) Kerzen?\.$/, 'No soul — $1 candle(s) left.'],
    [/^(\d+) neue Seelen? (.+)$/, '$1 new soul(s) $2'],
    [/^(\d+) Seelen, aber nichts wert — Einsatz weg\.$/,
      '$1 souls, but worth nothing — bet gone.'],
    [/^(\d+) Treffer — (.+) zurück$/, '$1 hits — $2 back'],
    [/^Scholle (\d+) von (\d+) — (.+)$/, 'Floe $1 of $2 — $3'],
    [/^Die Scholle bricht bei Nummer (\d+)(.*)$/, 'The floe breaks at number $1$2'],
    [/^(.+)× — \+(.+) Chips!$/, '$1× — +$2 chips!'],
    [/^(.+)× — Einsatz zurück$/, '$1× — bet returned'],
    [/^(.+)× — nur (.+) von (.+) zurück$/, '$1× — only $2 of $3 back'],
    [/^(.+)× — nur (.+) zurück$/, '$1× — only $2 back'],
    [/^(\d+) \((.+)\) — kein Treffer$/, '$1 ($2) — no hit'],
    /* Roulette-Treffer: die Liste dazwischen sind Wettfelder, jedes für sich
       im Wörterbuch. */
    [/^(\d+) — (.+) trifft! (.+)$/, function (m, n, liste, rest) {
      var teile = liste.split(', ').map(function (x) {
        var w = x.match(/^(.*?)( \+\d+ weitere)?$/);
        return (WB[w[1]] || w[1]) + (w[2] ? w[2].replace(' weitere', ' more') : '');
      });
      return n + ' — ' + teile.join(', ') + ' hits! ' + rest;
    }],
    [/^3× (.+) — Einsatz zurück$/, '3× $1 — bet returned'],
    [/^(.+) — Niete!$/, '$1 — a blank!'],
    [/^(.+) — (.+) zurück$/, '$1 — $2 back'],
    [/^Unterbrochene Runde fortgesetzt · Einsatz (.+)$/, 'Interrupted round resumed · bet $1'],
    [/^Unterbrochene Hand fortgesetzt · Einsatz (.+)$/, 'Interrupted hand resumed · bet $1'],
    [/^Unterbrochener Lauf fortgesetzt · Einsatz (.+)$/, 'Interrupted run resumed · bet $1'],
    [/^Unterbrochenes Los fortgesetzt · Einsatz (.+)$/, 'Interrupted ticket resumed · bet $1'],
    [/^Unterbrochener Zug fortgesetzt · (.+) · Einsatz (.+)$/,
      'Interrupted move resumed · $1 · bet $2'],
    [/^(\d+)er Serie! \+(.+) Bonus-Chips 🔥$/, '$1-in-a-row! +$2 bonus chips 🔥'],
    [/^☁️ Der Himmel ist erreicht! (.+)$/, '☁️ You reached the sky! $1'],
    [/^Smaug: (.+) \((\d+)%\)$/, function (m, wach, p) { return 'Smaug: ' + (WB[wach] || wach) + ' (' + p + '%)'; }],
    [/^Schlüssel gefunden \((\d+)\/(\d+)\) 🗝️$/, 'Key found ($1/$2) 🗝️'],
    /* Namen mitten im Satz: die gehen noch einmal durchs Wörterbuch. */
    [/^„(.+) geht in Führung!"$/, function (m, n) { return '“' + (WB[n] || n) + ' takes the lead!”'; }],
    [/^🏁 „(.+) gewinnt das Rennen!" — Platz 2: (.+)$/,
      function (m, a, b) { return '🏁 “' + (WB[a] || a) + ' wins the race!” — 2nd: ' + (WB[b] || b); }],
    [/^(.+) gewinnt — dein (.+) war zu langsam$/,
      function (m, a, b) { return (WB[a] || a) + ' wins — your ' + (WB[b] || b) + ' was too slow'; }],
    /* Der Pokertisch redet in Anführungszeichen — die stehen im Muster mit
       drin, sonst landet das „ mitten im Namen und das Wörterbuch greift nicht. */
    [/^„(.+) (erhöht|erhöhst) auf (.+)\."$/,
      function (m, n, v, b) { return '“' + (WB[n] || n) + (v === 'erhöhst' ? ' raise' : ' raises') + ' to ' + b + '.”'; }],
    [/^„(.+) (geht|gehst) mit (.+) mit\."$/,
      function (m, n, v, b) { return '“' + (WB[n] || n) + (v === 'gehst' ? ' call' : ' calls') + ' ' + b + '.”'; }],
    [/^„(.+) passt\."$/, function (m, n) { return '“' + (WB[n] || n) + ' folds.”'; }],
    [/^„(.+) schiebt\."$/, function (m, n) { return '“' + (WB[n] || n) + ' checks.”'; }],
    [/^„Blinds stehen — (.+) und (.+)\."$/, '“Blinds are up — $1 and $2.”'],
    [/^„Du zeigst (.+) — der Pot gehört dir\."$/,
      function (m, h) { return '“You show ' + (WB[h] || h) + ' — the pot is yours.”'; }],
    [/^„(.+)"$/, function (m, t) { return '“' + (WB[t] || t) + '”'; }],
    [/^(.+) gewinnt mit (.+) \((.+) verloren\)$/,
      function (m, n, h, v) { return (WB[n] || n) + ' wins with ' + (WB[h] || h) + ' (' + v + ' lost)'; }],
    [/^(.+) gewinnt — alle anderen passen \((.+) verloren\)$/,
      function (m, n, v) { return (WB[n] || n) + ' wins — everyone else folds (' + v + ' lost)'; }],
    [/^(.+) — Pot (.+) \((.+)\)$/,
      function (m, h, p, n) { return (WB[h] || h) + ' — pot ' + p + ' (' + n + ')'; }],
    [/^Hand (\d+): (.+)$/, function (m, i, h) { return 'Hand ' + i + ': ' + (WB[h] || h); }],
    [/^(.+) verliert (.+) bei (.+)$/, '$1 loses $2 at $3'],
    [/^(.+) gewinnt (.+) bei (.+)$/, '$1 wins $2 at $3'],
    [/^(.+) betritt das Casino mit (.+)$/, '$1 enters the casino with $2']
  ];

  function uebersetze(text) {
    var roh = String(text);
    var t = roh.trim();
    if (!t) return null;
    var neu = WB[t];
    if (neu === undefined) {
      for (var i = 0; i < REGELN.length; i++) {
        if (REGELN[i][0].test(t)) { neu = t.replace(REGELN[i][0], REGELN[i][1]); break; }
      }
    }
    if (neu === undefined || neu === t) return null;
    /* Führenden und folgenden Leerraum behalten — sonst kleben Texte
       zusammen, die im Original durch ein Leerzeichen getrennt waren. */
    var vorne = roh.match(/^\s*/)[0], hinten = roh.match(/\s*$/)[0];
    return vorne + neu + hinten;
  }

  var ATTRIBUTE = ['placeholder', 'title', 'aria-label', 'alt'];

  /* Was angefasst wurde, damit sich das Umschalten zurück ohne Neuladen
     rückgängig machen lässt. Knoten, die inzwischen aus dem Baum geflogen
     sind, werden beim Zurücksetzen einfach übersprungen. */
  var beruehrt = [];
  var beobachter = null;

  function knotenBearbeiten(n) {
    if (n.nodeType === 3) {
      var neu = uebersetze(n.nodeValue);
      if (neu !== null) {
        beruehrt.push({ n: n, art: 'text', alt: n.nodeValue });
        n.nodeValue = neu;
      }
      return;
    }
    if (n.nodeType !== 1) return;

    /* Ganze Absätze zuerst: passt einer, sind die Textstücke darin erledigt
       und müssen nicht einzeln durchs Wörterbuch. */
    if (n.matches && n.matches(HTML_SELEKTOR)) {
      var roh = n.innerHTML.replace(/\s+/g, ' ').trim();
      var ersatz = WB_HTML[roh];
      if (ersatz !== undefined && ersatz !== roh) {
        beruehrt.push({ n: n, art: 'html', alt: n.innerHTML });
        n.innerHTML = ersatz;
        return;
      }
    }

    /* Eingabefelder mit Wert: nur Knöpfe, nicht was jemand getippt hat. */
    if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit')) {
      var w = uebersetze(n.value);
      if (w !== null) { beruehrt.push({ n: n, art: 'wert', alt: n.value }); n.value = w; }
    }
    ATTRIBUTE.forEach(function (a) {
      if (!n.hasAttribute || !n.hasAttribute(a)) return;
      var v = uebersetze(n.getAttribute(a));
      if (v !== null) {
        beruehrt.push({ n: n, art: 'attr', name: a, alt: n.getAttribute(a) });
        n.setAttribute(a, v);
      }
    });
  }

  function baumBearbeiten(wurzel) {
    if (!wurzel) return;
    knotenBearbeiten(wurzel);
    if (wurzel.nodeType !== 1 && wurzel.nodeType !== 9) return;
    var lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = lauf.nextNode())) knotenBearbeiten(n);
  }

  function anschalten() {
    baumBearbeiten(document.body);
    document.documentElement.lang = 'en';
    beobachter = new MutationObserver(function (aenderungen) {
      /* Der Beobachter darf sich nicht selbst wecken: Textänderungen, die
         von hier kommen, sind schon übersetzt und werden beim zweiten
         Durchlauf nicht noch einmal gefunden (das Wörterbuch kennt nur
         Deutsch als Schlüssel). */
      aenderungen.forEach(function (a) {
        if (a.type === 'characterData') { knotenBearbeiten(a.target); return; }
        for (var i = 0; i < a.addedNodes.length; i++) baumBearbeiten(a.addedNodes[i]);
      });
    });
    beobachter.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true
    });
  }

  /** Alles zurück auf Deutsch — ohne Neuladen. */
  function ausschalten() {
    if (beobachter) { beobachter.disconnect(); beobachter = null; }
    for (var i = beruehrt.length - 1; i >= 0; i--) {
      var e = beruehrt[i];
      if (!e.n || (e.n.isConnected === false)) continue;
      if (e.art === 'text') e.n.nodeValue = e.alt;
      else if (e.art === 'html') e.n.innerHTML = e.alt;
      else if (e.art === 'wert') e.n.value = e.alt;
      else e.n.setAttribute(e.name, e.alt);
    }
    beruehrt = [];
    document.documentElement.lang = 'de';
  }

  /* ── Der Umschalter ─────────────────────────────────────────────────
     Zwei Bilder aus der Vorlage: links leuchtet die amerikanische Flagge
     (Englisch), rechts die deutsche. Angezeigt wird der Zustand, nicht die
     Wahlmöglichkeit — deshalb steht auf Deutsch das deutsche Bild da. */
  /* Es gibt den Schalter mehr als einmal: im Kopf am Rechner, in den
     Kontoeinstellungen am Handy. Alle angelegten Knöpfe stehen hier, damit
     ein Klick auf den einen auch den anderen richtig zeigt. */
  var schalter = [];

  function beschriftung() {
    return sprache === 'de' ? 'Switch to English' : 'Auf Deutsch umschalten';
  }

  function schalterZeigen() {
    for (var i = schalter.length - 1; i >= 0; i--) {
      var b = schalter[i];
      /* Der Knopf aus einem geschlossenen Fenster hängt nicht mehr im
         Dokument — der fliegt hier raus, statt sich anzusammeln. */
      if (!b.isConnected) { schalter.splice(i, 1); continue; }
      b.title = beschriftung();
      b.setAttribute('aria-label', beschriftung());
      var bild = b.querySelector('img');
      if (bild) bild.src = 'assets/symbols/sprache-' + sprache + '.webp';
    }
  }

  function wechseln() {
    sprache = sprache === 'de' ? 'en' : 'de';
    try { localStorage.setItem(SCHLUESSEL, sprache); } catch (e) {}
    if (GK.sfx) GK.sfx('click');
    /* Sofort umschalten statt neu zu laden: was übersetzt wurde, ist
       vermerkt und lässt sich damit genauso sauber zurückstellen. */
    if (sprache === 'en') anschalten(); else ausschalten();
    schalterZeigen();
  }

  /** Baut einen Sprachknopf. `gross` gibt ihm die Fassung fürs Kontofenster. */
  function knopfBauen(gross) {
    var b = document.createElement('button');
    b.className = 'lang-schalter' + (gross ? ' lang-gross' : '');
    b.type = 'button';
    b.title = beschriftung();
    b.setAttribute('aria-label', beschriftung());
    b.innerHTML = '<img src="assets/symbols/sprache-' + sprache + '.webp" alt="" draggable="false">';
    b.addEventListener('click', wechseln);
    schalter.push(b);
    return b;
  }

  function schalterBauen() {
    var kopf = document.querySelector('.topbar-right') || document.querySelector('.topbar');
    if (!kopf) return;
    var b = knopfBauen(false);
    /* Vor die Schild-Schaltfläche, damit die Reihe im Kopf gleich bleibt. */
    var schild = kopf.querySelector('#hud-shield');
    if (schild) kopf.insertBefore(b, schild); else kopf.appendChild(b);
  }

  /* Für das Kontofenster: ein Knopf zum Einhängen, wo er gebraucht wird. */
  GK.langKnopf = function () { return knopfBauen(true); };

  function start() {
    schalterBauen();
    if (sprache === 'en') anschalten();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.GK);
