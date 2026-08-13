/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Mehrspieler

   Haelt die Tische und fuehrt die Runden. Der Server entscheidet alles:
   welche Karte faellt, wer dran ist, wer gewinnt und wer wieviel bekommt.
   Der Browser zeigt nur an, was hier steht — sonst koennte man mit einer
   veraenderten Seite mitspielen.

   Uebertragen wird per Langabfrage: /api/mp/state haelt die Anfrage offen,
   bis sich am Tisch etwas aendert oder die Zeit ablaeuft. Das kommt ohne
   WebSocket aus und passt damit zum Rest des Servers.

   Chips gehoeren immer entweder dem Konto oder einem Stapel am Tisch, nie
   beidem. Beim Platznehmen wandert der Einkauf vom Konto auf den Stapel,
   beim Aufstehen zurueck.
   ═══════════════════════════════════════════════════════════ */
'use strict';

var holdem = require('./js/holdem.js');

/* Wie lange ein Zug dauern darf, bevor der Server ihn selbst macht. */
var TURN_MS = 30000;
/* Pause zwischen zwei Haenden, damit man das Ergebnis noch sieht. */
var BREAK_MS = 6000;
/* Ohne Lebenszeichen gilt ein Spieler als weg. */
var ONLINE_MS = 20000;
/* Wer so lange nicht mehr da war, wird vom Tisch genommen. */
var DROP_MS = 90000;
/* Langabfrage: so lange wird eine Anfrage hoechstens offen gehalten. */
var POLL_MS = 25000;

var GAMES = {
  poker: {
    name: 'Königs-Poker',
    kurz: 'Texas Hold\'em, 2 bis 6 Plätze. Blinds, Flop, Turn, River — gegen echte Leute.',
    icon: 'poker',
    seats: 6,
    minSeats: 2
  },
  coinflip: {
    name: 'Münzduell',
    kurz: 'Einer gegen einen. Beide setzen gleich viel, die Münze entscheidet.',
    icon: 'coin',
    seats: 2,
    minSeats: 2
  }
};

function createMP(deps) {
  /* deps: players() -> db.players, save(), feed(text, kind) */

  var tables = new Map();      // id -> Tisch
  var online = new Map();      // Spieler-id -> { at, name, avatar }
  var waiters = [];            // offene Langabfragen
  var seq = 1;

  function now() { return Date.now(); }
  function newId(p) { return p + Math.random().toString(36).slice(2, 8); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function int(v) { var n = Math.floor(Number(v)); return isFinite(n) ? n : 0; }

  /* ── Aenderungen bekanntgeben ─────────────────────────────────────── */

  function bump(t) {
    seq++;
    if (t) t.v = seq;
    var offen = waiters;
    waiters = [];
    offen.forEach(function (w) {
      try { w.fire(); } catch (e) {}
    });
  }

  /** Wartet, bis sich etwas aendert — oder gibt nach POLL_MS auf. */
  function wait(since, send) {
    if (seq > since) return send();
    var fertig = false;
    var w = {
      fire: function () {
        if (fertig) return;
        fertig = true;
        clearTimeout(timer);
        send();
      }
    };
    var timer = setTimeout(w.fire, POLL_MS);
    waiters.push(w);
  }

  /* ── Anwesenheit ──────────────────────────────────────────────────── */

  function touch(id) {
    var p = deps.players()[id];
    if (!p) return;
    online.set(id, { at: now(), name: p.name, avatar: p.avatar });
  }

  function isOnline(id) {
    var o = online.get(id);
    return !!o && now() - o.at < ONLINE_MS;
  }

  /* ── Tische ───────────────────────────────────────────────────────── */

  function seatOf(t, id) {
    for (var i = 0; i < t.seats.length; i++) {
      if (t.seats[i] && t.seats[i].id === id) return i;
    }
    return -1;
  }

  function besetzt(t) {
    return t.seats.filter(function (s) { return !!s; }).length;
  }

  function tableOf(id) {
    var gefunden = null;
    tables.forEach(function (t) { if (seatOf(t, id) >= 0) gefunden = t; });
    return gefunden;
  }

  function createTable(id, opts) {
    var spiel = GAMES[opts.game] ? opts.game : 'poker';
    var g = GAMES[spiel];
    var p = deps.players()[id];
    if (!p) return { error: 'Spieler nicht gefunden', code: 404 };
    if (tableOf(id)) return { error: 'Du sitzt schon an einem Tisch', code: 409 };
    if (tables.size >= 40) return { error: 'Gerade sind alle Tische belegt', code: 429 };

    var bb = clamp(int(opts.bb) || 10, 2, 5000);
    var t = {
      id: newId('t'),
      game: spiel,
      name: String(opts.name || (p.name + 's Tisch')).slice(0, 24),
      host: id,
      sb: Math.max(1, Math.floor(bb / 2)),
      bb: bb,
      minBuy: bb * 10,
      maxBuy: bb * 200,
      seats: new Array(g.seats).fill(null),
      createdAt: now(),
      v: seq + 1,
      hand: null,
      naechste: 0,
      log: [],
      dealer: 0
    };
    tables.set(t.id, t);
    var ein = join(id, { table: t.id, buyIn: opts.buyIn });
    if (ein.error) { tables.delete(t.id); return ein; }
    return { ok: true, table: t.id };
  }

  function log(t, text) {
    t.log.unshift({ at: now(), text: text });
    if (t.log.length > 30) t.log.length = 30;
  }

  /* ── Platz nehmen und aufstehen ───────────────────────────────────── */

  function join(id, opts) {
    var t = tables.get(String(opts.table || ''));
    if (!t) return { error: 'Diesen Tisch gibt es nicht mehr', code: 404 };
    var p = deps.players()[id];
    if (!p) return { error: 'Spieler nicht gefunden', code: 404 };
    if (seatOf(t, id) >= 0) return { ok: true, table: t.id };
    var anderer = tableOf(id);
    if (anderer) return { error: 'Du sitzt schon an einem anderen Tisch', code: 409 };

    var frei = t.seats.indexOf(null);
    if (frei < 0) return { error: 'Der Tisch ist voll', code: 409 };

    var einkauf = t.game === 'coinflip'
      ? clamp(int(opts.buyIn) || t.bb * 10, t.minBuy, t.maxBuy)
      : clamp(int(opts.buyIn) || t.minBuy, t.minBuy, t.maxBuy);
    if (einkauf > p.balance) {
      return { error: 'Dafür reichen deine Chips nicht — mindestens ' + t.minBuy, code: 400 };
    }

    p.balance -= einkauf;
    p.wagered += einkauf;
    t.seats[frei] = {
      id: id, name: p.name, avatar: p.avatar,
      stack: einkauf, buyIn: einkauf,
      at: now(), bereit: true, weg: 0
    };
    touch(id);
    log(t, p.name + ' setzt sich mit ' + einkauf + ' Chips an den Tisch');
    deps.save();
    starteWennMoeglich(t);
    bump(t);
    return { ok: true, table: t.id };
  }

  /** Aufstehen. Der Stapel geht zurueck aufs Konto. */
  function leave(id, grund) {
    var t = tableOf(id);
    if (!t) return { ok: true };
    var i = seatOf(t, id);
    var s = t.seats[i];
    var p = deps.players()[id];

    /* Mitten in einer Hand zaehlt das Aufstehen wie aufgeben: der bereits
       gesetzte Teil bleibt im Pot, der Rest kommt zurueck. */
    if (t.hand && s.h && !s.h.folded) {
      s.h.folded = true;
      log(t, s.name + ' verlässt den Tisch und gibt auf');
    }

    if (p) {
      p.balance += s.stack;
      p.returned += s.stack;
      if (s.stack > s.buyIn) {
        p.wins++;
        p.biggestWin = Math.max(p.biggestWin || 0, s.stack - s.buyIn);
        p.peak = Math.max(p.peak || 0, p.balance);
      } else if (s.stack < s.buyIn) {
        p.losses++;
      }
      p.plays++;
    }
    t.seats[i] = null;
    log(t, s.name + ' steht auf (' + s.stack + ' Chips)' + (grund ? ' — ' + grund : ''));
    deps.save();

    if (t.hand) weiter(t);
    if (besetzt(t) === 0) tables.delete(t.id);
    else starteWennMoeglich(t);
    bump(t);
    return { ok: true };
  }

  /* ── Runden starten ───────────────────────────────────────────────── */

  function spielbereit(t) {
    return t.seats.filter(function (s) { return s && s.stack > 0; }).length;
  }

  function starteWennMoeglich(t) {
    if (t.hand) return;
    var g = GAMES[t.game];
    if (spielbereit(t) < g.minSeats) { t.naechste = 0; return; }
    if (!t.naechste) t.naechste = now() + 2500;
  }

  function tick() {
    var jetzt = now();
    var etwas = false;

    tables.forEach(function (t) {
      // wer lange nicht mehr da war, wird vom Tisch genommen
      t.seats.forEach(function (s) {
        if (!s) return;
        if (isOnline(s.id)) { s.weg = 0; return; }
        if (!s.weg) s.weg = jetzt;
        else if (jetzt - s.weg > DROP_MS) { leave(s.id, 'Verbindung weg'); etwas = true; }
      });

      if (!tables.has(t.id)) return;

      if (!t.hand && t.naechste && jetzt >= t.naechste) {
        t.naechste = 0;
        starteHand(t);
        etwas = true;
        return;
      }
      if (t.hand && t.hand.ende && jetzt >= t.hand.ende) {
        t.hand = null;
        starteWennMoeglich(t);
        etwas = true;
        return;
      }
      if (t.hand && t.hand.deadline && jetzt >= t.hand.deadline) {
        zeitAbgelaufen(t);
        etwas = true;
      }
    });

    // abgelaufene Anwesenheit aufraeumen
    online.forEach(function (o, id) { if (jetzt - o.at > DROP_MS) online.delete(id); });

    if (etwas) bump(null);
  }

  function starteHand(t) {
    if (t.game === 'coinflip') return starteFlip(t);
    return startePoker(t);
  }

  /* ═══════════════ POKER ═══════════════ */

  function aktive(t) {
    // Plaetze mit Chips, in Sitzreihenfolge
    var out = [];
    t.seats.forEach(function (s, i) { if (s && s.stack > 0) out.push(i); });
    return out;
  }

  function naechsterPlatz(t, von, filter) {
    var n = t.seats.length;
    for (var k = 1; k <= n; k++) {
      var i = (von + k) % n;
      if (filter(t.seats[i], i)) return i;
    }
    return -1;
  }

  function startePoker(t) {
    var dabei = aktive(t);
    if (dabei.length < 2) return;

    var deck = holdem.newDeck();
    t.dealer = naechsterPlatz(t, t.dealer, function (s) { return s && s.stack > 0; });

    t.seats.forEach(function (s) {
      if (!s) return;
      s.h = null;
      if (s.stack <= 0) return;
      s.h = { cards: [deck.pop(), deck.pop()], bet: 0, gesamt: 0, folded: false, allIn: false, dran: false };
    });

    var h = {
      nr: (t.handNr = (t.handNr || 0) + 1),
      deck: deck,
      board: [],
      street: 'preflop',
      pot: 0,
      toCall: 0,
      minRaise: t.bb,
      turn: -1,
      deadline: 0,
      ende: 0,
      ergebnis: null
    };
    t.hand = h;

    var mit = dabei.slice();
    // Heads-up: der Dealer setzt den kleinen Blind
    var sbPlatz = mit.length === 2 ? t.dealer
      : naechsterPlatz(t, t.dealer, function (s) { return s && s.stack > 0; });
    var bbPlatz = naechsterPlatz(t, sbPlatz, function (s) { return s && s.stack > 0; });

    setzeBlind(t, sbPlatz, t.sb);
    setzeBlind(t, bbPlatz, t.bb);
    h.toCall = t.bb;
    h.minRaise = t.bb;
    h.letzterErhoeher = bbPlatz;

    h.turn = naechsterPlatz(t, bbPlatz, function (s) { return s && s.h && !s.h.folded && !s.h.allIn; });
    h.deadline = now() + TURN_MS;
    log(t, 'Hand ' + h.nr + ' — Blinds ' + t.sb + '/' + t.bb);
    bump(t);
  }

  function setzeBlind(t, i, betrag) {
    var s = t.seats[i];
    if (!s || !s.h) return;
    var b = Math.min(betrag, s.stack);
    s.stack -= b;
    s.h.bet += b;
    s.h.gesamt += b;
    t.hand.pot += b;
    if (s.stack === 0) s.h.allIn = true;
  }

  /** Alle, die in der Hand noch mitspielen. */
  function imSpiel(t) {
    var out = [];
    t.seats.forEach(function (s, i) { if (s && s.h && !s.h.folded) out.push(i); });
    return out;
  }

  function nochAmZug(t) {
    var out = [];
    t.seats.forEach(function (s, i) {
      if (s && s.h && !s.h.folded && !s.h.allIn) out.push(i);
    });
    return out;
  }

  /** Nachkaufen, wenn der Stapel leer ist. Sonst waere die Runde vorbei. */
  function rebuy(t, id, op) {
    var i = seatOf(t, id);
    var s = t.seats[i];
    var p = deps.players()[id];
    if (!p) return { error: 'Spieler nicht gefunden', code: 404 };
    if (s.stack > 0) return { error: 'Du hast noch Chips', code: 400 };
    if (t.hand && s.h && !s.h.folded) return { error: 'Erst die Hand zu Ende spielen', code: 409 };

    var betrag = clamp(int(op.buyIn) || t.minBuy, t.minBuy, t.maxBuy);
    if (betrag > p.balance) return { error: 'Dafür reichen deine Chips nicht', code: 400 };
    p.balance -= betrag;
    p.wagered += betrag;
    s.stack = betrag;
    s.buyIn += betrag;
    log(t, s.name + ' kauft für ' + betrag + ' Chips nach');
    deps.save();
    starteWennMoeglich(t);
    bump(t);
    return { ok: true };
  }

  function action(id, op) {
    var t = tableOf(id);
    if (!t) return { error: 'Du sitzt an keinem Tisch', code: 409 };
    touch(id);
    if (op.action === 'rebuy') return rebuy(t, id, op);
    if (t.game === 'coinflip') return flipAction(t, id, op);

    var h = t.hand;
    var i = seatOf(t, id);
    if (!h || h.ende) return { error: 'Gerade läuft keine Hand', code: 409 };
    if (h.turn !== i) return { error: 'Du bist nicht dran', code: 409 };

    var s = t.seats[i];
    var was = String(op.action || '');
    var fehlt = h.toCall - s.h.bet;

    if (was === 'fold') {
      s.h.folded = true;
      log(t, s.name + ' passt');
    } else if (was === 'check') {
      if (fehlt > 0) return { error: 'Da steht noch ein Einsatz', code: 400 };
      log(t, s.name + ' schiebt');
    } else if (was === 'call') {
      var b = Math.min(fehlt, s.stack);
      zahl(t, i, b);
      log(t, s.name + (b < fehlt ? ' geht All-in mit ' + b : ' geht mit (' + b + ')'));
    } else if (was === 'raise' || was === 'allin') {
      var ziel = was === 'allin' ? s.h.bet + s.stack : int(op.amount);
      var maximal = s.h.bet + s.stack;
      if (ziel > maximal) ziel = maximal;
      var mindestens = h.toCall + h.minRaise;
      if (ziel < mindestens && ziel < maximal) {
        return { error: 'Mindestens ' + mindestens, code: 400 };
      }
      if (ziel <= h.toCall && ziel < maximal) {
        return { error: 'Damit erhöhst du nicht', code: 400 };
      }
      var zuZahlen = ziel - s.h.bet;
      zahl(t, i, zuZahlen);
      if (ziel > h.toCall) {
        h.minRaise = Math.max(h.minRaise, ziel - h.toCall);
        h.toCall = ziel;
        h.letzterErhoeher = i;
        // eine echte Erhoehung oeffnet die Runde wieder
        t.seats.forEach(function (x, k) { if (x && x.h && k !== i) x.h.dran = false; });
      }
      log(t, s.name + (s.stack === 0 ? ' geht All-in (' + ziel + ')' : ' erhöht auf ' + ziel));
    } else {
      return { error: 'Unbekannter Zug', code: 400 };
    }

    s.h.dran = true;
    weiter(t);
    bump(t);
    return { ok: true };
  }

  function zahl(t, i, betrag) {
    var s = t.seats[i];
    var b = clamp(betrag, 0, s.stack);
    s.stack -= b;
    s.h.bet += b;
    s.h.gesamt += b;
    t.hand.pot += b;
    if (s.stack === 0) s.h.allIn = true;
  }

  function zeitAbgelaufen(t) {
    if (t.game === 'coinflip') { flipTimeout(t); return; }
    var h = t.hand;
    if (!h || h.turn < 0) return;
    var s = t.seats[h.turn];
    if (!s || !s.h) return;
    var fehlt = h.toCall - s.h.bet;
    if (fehlt <= 0) { s.h.dran = true; log(t, s.name + ' schiebt (Zeit)'); }
    else { s.h.folded = true; log(t, s.name + ' passt (Zeit)'); }
    weiter(t);
  }

  /** Runde weiterschalten: naechster Spieler, naechste Strasse, Showdown. */
  function weiter(t) {
    var h = t.hand;
    if (!h || h.ende) return;

    var drin = imSpiel(t);
    if (drin.length <= 1) return beende(t, drin);

    var offen = nochAmZug(t);
    var alleDran = offen.every(function (i) {
      var s = t.seats[i];
      return s.h.dran && s.h.bet === h.toCall;
    });

    if (offen.length <= 1) {
      /* Nur noch einer kann setzen — der Rest ist All-in. Wenn er den Einsatz
         gedeckt hat, laufen die restlichen Karten ohne weitere Zuege. */
      var einzeln = offen[0];
      var gedeckt = einzeln === undefined ||
        (t.seats[einzeln].h.dran && t.seats[einzeln].h.bet === h.toCall);
      if (gedeckt) return bisZumEnde(t);
    }

    if (alleDran) return naechsteStrasse(t);

    var von = h.turn;
    h.turn = naechsterPlatz(t, von, function (s) {
      return s && s.h && !s.h.folded && !s.h.allIn;
    });
    h.deadline = now() + TURN_MS;
  }

  function neueStrasseVorbereiten(t) {
    var h = t.hand;
    t.seats.forEach(function (s) {
      if (s && s.h) { s.h.bet = 0; s.h.dran = false; }
    });
    h.toCall = 0;
    h.minRaise = t.bb;
  }

  function karten(t, n) {
    var h = t.hand;
    h.deck.pop();                       // eine Karte verbrennen, wie am Tisch
    for (var k = 0; k < n; k++) h.board.push(h.deck.pop());
  }

  function naechsteStrasse(t) {
    var h = t.hand;
    if (h.street === 'river') return showdown(t);

    neueStrasseVorbereiten(t);
    if (h.street === 'preflop') { h.street = 'flop'; karten(t, 3); }
    else if (h.street === 'flop') { h.street = 'turn'; karten(t, 1); }
    else { h.street = 'river'; karten(t, 1); }

    var offen = nochAmZug(t);
    if (offen.length <= 1) return bisZumEnde(t);

    h.turn = naechsterPlatz(t, t.dealer, function (s) {
      return s && s.h && !s.h.folded && !s.h.allIn;
    });
    h.deadline = now() + TURN_MS;
  }

  /** Alle All-in: restliche Karten aufdecken und abrechnen. */
  function bisZumEnde(t) {
    var h = t.hand;
    neueStrasseVorbereiten(t);
    while (h.board.length < 5) {
      if (h.street === 'preflop') { h.street = 'flop'; karten(t, 3); }
      else if (h.street === 'flop') { h.street = 'turn'; karten(t, 1); }
      else { h.street = 'river'; karten(t, 1); }
    }
    h.street = 'river';
    showdown(t);
  }

  /* Seitentoepfe: wer weniger Chips hatte, kann auch nur bis dorthin
     gewinnen. Deshalb wird der Pot in Stufen zerlegt — eine je
     unterschiedlichem Gesamteinsatz. */
  function toepfe(t) {
    var stufen = [];
    t.seats.forEach(function (s) {
      if (s && s.h && s.h.gesamt > 0 && stufen.indexOf(s.h.gesamt) < 0) stufen.push(s.h.gesamt);
    });
    stufen.sort(function (a, b) { return a - b; });

    var out = [], vorher = 0;
    stufen.forEach(function (grenze) {
      var betrag = 0, berechtigt = [];
      t.seats.forEach(function (s, i) {
        if (!s || !s.h || s.h.gesamt <= vorher) return;
        betrag += Math.min(s.h.gesamt, grenze) - vorher;
        if (!s.h.folded) berechtigt.push(i);
      });
      if (betrag > 0) out.push({ betrag: betrag, spieler: berechtigt });
      vorher = grenze;
    });
    return out;
  }

  function showdown(t) {
    var h = t.hand;
    var drin = imSpiel(t);
    var bewertung = {};
    drin.forEach(function (i) {
      bewertung[i] = holdem.bestHand(t.seats[i].h.cards.concat(h.board));
    });

    var gewinne = {};
    toepfe(t).forEach(function (topf) {
      var kandidaten = topf.spieler.filter(function (i) { return bewertung[i]; });
      if (!kandidaten.length) kandidaten = topf.spieler;
      var best = -1;
      kandidaten.forEach(function (i) {
        var sc = bewertung[i] ? bewertung[i].score : -1;
        if (sc > best) best = sc;
      });
      var sieger = kandidaten.filter(function (i) {
        return (bewertung[i] ? bewertung[i].score : -1) === best;
      });
      var anteil = Math.floor(topf.betrag / sieger.length);
      var rest = topf.betrag - anteil * sieger.length;
      sieger.forEach(function (i, n) {
        gewinne[i] = (gewinne[i] || 0) + anteil + (n < rest ? 1 : 0);
      });
    });

    Object.keys(gewinne).forEach(function (i) { t.seats[i].stack += gewinne[i]; });

    h.ergebnis = {
      gewinne: gewinne,
      haende: {},
      zeigen: drin.length > 1
    };
    drin.forEach(function (i) {
      h.ergebnis.haende[i] = {
        name: bewertung[i].name,
        cards: t.seats[i].h.cards,
        five: bewertung[i].five
      };
    });

    var text = Object.keys(gewinne).map(function (i) {
      return t.seats[i].name + ' +' + gewinne[i] +
        (drin.length > 1 ? ' (' + bewertung[i].name + ')' : '');
    }).join(', ');
    log(t, 'Hand ' + h.nr + ': ' + text);
    if (drin.length > 1) {
      var bester = Object.keys(gewinne)[0];
      if (bester !== undefined && gewinne[bester] >= t.bb * 30) {
        deps.feed(t.seats[bester].name + ' gewinnt ' + gewinne[bester] +
                  ' Chips am Pokertisch „' + t.name + '“', 'win');
      }
    }

    h.street = 'showdown';
    h.turn = -1;
    h.deadline = 0;
    h.ende = now() + BREAK_MS;
    deps.save();
  }

  /** Alle bis auf einen haben gepasst. */
  function beende(t, drin) {
    var h = t.hand;
    var gewinne = {};
    if (drin.length === 1) {
      gewinne[drin[0]] = h.pot;
      t.seats[drin[0]].stack += h.pot;
      log(t, 'Hand ' + h.nr + ': ' + t.seats[drin[0]].name + ' +' + h.pot + ' (alle passen)');
    }
    h.ergebnis = { gewinne: gewinne, haende: {}, zeigen: false };
    h.turn = -1;
    h.deadline = 0;
    h.ende = now() + Math.floor(BREAK_MS / 2);
    deps.save();
  }

  /* ═══════════════ MUENZDUELL 1 gegen 1 ═══════════════ */

  function starteFlip(t) {
    var dabei = aktive(t);
    if (dabei.length < 2) return;
    var einsatz = Math.min(t.bb, t.seats[dabei[0]].stack, t.seats[dabei[1]].stack);
    t.hand = {
      nr: (t.handNr = (t.handNr || 0) + 1),
      einsatz: einsatz,
      wahl: {},                       // Platz -> 'krone' | 'drache'
      seite: null,
      ergebnis: null,
      deadline: now() + TURN_MS,
      ende: 0,
      turn: -1
    };
    log(t, 'Runde ' + t.hand.nr + ' — Einsatz ' + einsatz + ' pro Spieler');
    bump(t);
  }

  function flipAction(t, id, op) {
    var h = t.hand;
    if (!h || h.ende) return { error: 'Gerade läuft keine Runde', code: 409 };
    var i = seatOf(t, id);
    if (h.wahl[i]) return { error: 'Du hast schon gewählt', code: 409 };
    var wahl = op.action === 'drache' ? 'drache' : 'krone';

    /* Beide duerfen dieselbe Seite nicht nehmen — der zweite bekommt die
       andere, sonst gibt es nichts zu entscheiden. */
    var belegt = Object.keys(h.wahl).map(function (k) { return h.wahl[k]; });
    if (belegt.indexOf(wahl) >= 0) wahl = wahl === 'krone' ? 'drache' : 'krone';
    h.wahl[i] = wahl;
    log(t, t.seats[i].name + ' nimmt ' + (wahl === 'krone' ? 'Krone' : 'Drache'));

    if (Object.keys(h.wahl).length >= 2) wirf(t);
    bump(t);
    return { ok: true };
  }

  function flipTimeout(t) {
    var h = t.hand;
    if (!h || h.ende) return;
    // wer nicht gewaehlt hat, bekommt die freie Seite
    t.seats.forEach(function (s, i) {
      if (!s || s.stack <= 0 || h.wahl[i]) return;
      var belegt = Object.keys(h.wahl).map(function (k) { return h.wahl[k]; });
      h.wahl[i] = belegt.indexOf('krone') >= 0 ? 'drache' : 'krone';
      log(t, s.name + ' bekommt ' + h.wahl[i] + ' (Zeit)');
    });
    if (Object.keys(h.wahl).length >= 2) wirf(t);
    else { h.ende = now() + 1000; }
  }

  function wirf(t) {
    var h = t.hand;
    h.seite = Math.random() < 0.5 ? 'krone' : 'drache';
    var sieger = -1;
    Object.keys(h.wahl).forEach(function (i) { if (h.wahl[i] === h.seite) sieger = +i; });

    var gewinne = {};
    if (sieger >= 0) {
      var topf = 0;
      t.seats.forEach(function (s, i) {
        if (!s || h.wahl[i] === undefined) return;
        var b = Math.min(h.einsatz, s.stack);
        s.stack -= b;
        topf += b;
      });
      t.seats[sieger].stack += topf;
      gewinne[sieger] = topf;
      log(t, 'Münze zeigt ' + h.seite + ' — ' + t.seats[sieger].name + ' +' + topf);
    }
    h.ergebnis = { gewinne: gewinne, seite: h.seite };
    h.deadline = 0;
    h.ende = now() + BREAK_MS;
    deps.save();
  }

  /* ── Was der Browser zu sehen bekommt ─────────────────────────────── */

  /** Nur der Besitzer sieht seine Karten — bis zum Showdown. */
  function sichtTisch(t, viewer) {
    var h = t.hand;
    var zeigen = !!(h && h.ergebnis && h.ergebnis.zeigen);
    return {
      id: t.id,
      game: t.game,
      name: t.name,
      sb: t.sb, bb: t.bb, minBuy: t.minBuy, maxBuy: t.maxBuy,
      dealer: t.dealer,
      host: t.host,
      log: t.log.slice(0, 12),
      seats: t.seats.map(function (s, i) {
        if (!s) return null;
        var eigen = s.id === viewer;
        var karten = null;
        if (s.h && s.h.cards) {
          if (eigen) karten = s.h.cards;
          else if (zeigen && !s.h.folded) karten = s.h.cards;
        }
        return {
          platz: i, id: s.id, name: s.name, avatar: s.avatar,
          stack: s.stack, buyIn: s.buyIn,
          online: isOnline(s.id),
          bet: s.h ? s.h.bet : 0,
          folded: s.h ? !!s.h.folded : false,
          allIn: s.h ? !!s.h.allIn : false,
          cards: karten,
          verdeckt: !!(s.h && s.h.cards && !karten)
        };
      }),
      hand: h ? sichtHand(t, viewer) : null,
      wartetAb: t.naechste || 0,
      v: t.v
    };
  }

  function sichtHand(t, viewer) {
    var h = t.hand;
    if (t.game === 'coinflip') {
      var meinPlatz = seatOf(t, viewer);
      return {
        nr: h.nr, einsatz: h.einsatz,
        meineWahl: h.wahl[meinPlatz] || null,
        gewaehlt: Object.keys(h.wahl).length,
        seite: h.seite,
        ergebnis: h.ergebnis,
        deadline: h.deadline, ende: h.ende
      };
    }
    return {
      nr: h.nr,
      street: h.street,
      board: h.board,
      pot: h.pot,
      toCall: h.toCall,
      minRaise: h.minRaise,
      turn: h.turn,
      deadline: h.deadline,
      ende: h.ende,
      ergebnis: h.ergebnis
    };
  }

  function lobby(viewer) {
    var proSpiel = {};
    Object.keys(GAMES).forEach(function (g) {
      proSpiel[g] = {
        id: g, name: GAMES[g].name, kurz: GAMES[g].kurz,
        icon: GAMES[g].icon, plaetze: GAMES[g].seats,
        tische: 0, spieler: 0, namen: []
      };
    });

    var liste = [];
    tables.forEach(function (t) {
      var g = proSpiel[t.game];
      var leute = t.seats.filter(function (s) { return !!s; });
      if (g) {
        g.tische++;
        g.spieler += leute.length;
        leute.forEach(function (s) { if (g.namen.length < 12) g.namen.push(s.name); });
      }
      liste.push({
        id: t.id, game: t.game, name: t.name,
        sb: t.sb, bb: t.bb, minBuy: t.minBuy, maxBuy: t.maxBuy,
        plaetze: t.seats.length,
        besetzt: leute.length,
        laeuft: !!t.hand,
        spieler: leute.map(function (s) {
          return { name: s.name, avatar: s.avatar, stack: s.stack, online: isOnline(s.id) };
        })
      });
    });
    liste.sort(function (a, b) { return b.besetzt - a.besetzt || a.name.localeCompare(b.name); });

    var wach = [];
    online.forEach(function (o, id) {
      if (now() - o.at < ONLINE_MS) wach.push({ id: id, name: o.name, avatar: o.avatar });
    });

    var meiner = tableOf(viewer);
    return {
      spiele: Object.keys(proSpiel).map(function (g) { return proSpiel[g]; }),
      tische: liste,
      online: wach,
      meinTisch: meiner ? meiner.id : null,
      v: seq
    };
  }

  /* ── Aussenseite ──────────────────────────────────────────────────── */

  var timer = setInterval(tick, 1000);
  if (timer.unref) timer.unref();

  /**
   * Beim Herunterfahren jeden Stapel aufs Konto zurueckbuchen. Die Tische
   * liegen nur im Speicher — was hier nicht zurueckgeht, ist nach dem
   * Neustart verloren.
   */
  function shutdown() {
    var summe = 0;
    tables.forEach(function (t) {
      t.seats.forEach(function (s) {
        if (!s) return;
        var p = deps.players()[s.id];
        if (p) { p.balance += s.stack; p.returned += s.stack; summe += s.stack; }
        s.stack = 0;
      });
    });
    tables.clear();
    return summe;
  }

  return {
    GAMES: GAMES,
    shutdown: shutdown,
    touch: touch,
    lobby: lobby,
    wait: wait,
    seq: function () { return seq; },
    create: createTable,
    join: join,
    leave: leave,
    action: action,
    tableOf: tableOf,
    view: function (id, viewer) {
      var t = tables.get(String(id || ''));
      if (!t) return null;
      return sichtTisch(t, viewer);
    }
  };
}

module.exports = createMP;
