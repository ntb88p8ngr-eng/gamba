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
  watten: {
    name: 'Watten',
    kurz: 'Bayerisch Watten zu viert, zwei gegen zwei. Schlag und Trumpf werden angesagt, ' +
          'wer drei von fünf Stichen holt, gewinnt die Hand.',
    icon: 'cards',
    seats: 4,
    minSeats: 4
  },
  coinflip: {
    name: 'Münzduell',
    kurz: 'Einer gegen einen. Beide setzen gleich viel, die Münze entscheidet.',
    icon: 'coin',
    seats: 2,
    minSeats: 2
  }
};

/* ─────────────── Watten ───────────────
   Bayerische Regeln. Gespielt wird mit 32 Blatt; die deutschen Farben liegen
   auf den vorhandenen franzoesischen Kartenbildern, damit kein neues Deck
   noetig ist:
       Eichel = ♣    Gras = ♠    Herz = ♥    Schellen = ♦
       Unter  = J    Ober = Q    Koenig = K   Sau = A

   Die Rangfolge, von oben:
     1. Die drei "Kritischen" (Rechten): Max = Herz-Koenig, Belli =
        Schellen-Sieben, Spitz = Eichel-Sieben. Immer Trumpf, immer hoechste.
     2. Der "Rechte": die Karte, die zugleich den angesagten Schlag und die
        angesagte Trumpffarbe hat.
     3. Die uebrigen Karten des Schlags ("Blinde") — untereinander gleich
        stark, die zuerst gelegte schlaegt die spaeteren.
     4. Die uebrigen Karten der Trumpffarbe, in normaler Ordnung.
     5. Alles andere, aber nur in der angespielten Farbe.
   Farbzwang gibt es nicht: man darf immer alles legen. */
var W_FARBEN = [
  { s: '♣', name: 'Eichel' }, { s: '♠', name: 'Gras' },
  { s: '♥', name: 'Herz' }, { s: '♦', name: 'Schellen' }
];
var W_RANG = [
  { r: '7', name: 'Sieben', v: 1 }, { r: '8', name: 'Acht', v: 2 },
  { r: '9', name: 'Neun', v: 3 }, { r: '10', name: 'Zehn', v: 4 },
  { r: 'J', name: 'Unter', v: 5 }, { r: 'Q', name: 'Ober', v: 6 },
  { r: 'K', name: 'König', v: 7 }, { r: 'A', name: 'Sau', v: 8 }
];
var W_KRITISCH = [
  { r: 'K', s: '♥', name: 'Max' },
  { r: '7', s: '♦', name: 'Belli' },
  { r: '7', s: '♣', name: 'Spitz' }
];
/* Bis hierhin zaehlt eine Mannschaft, dann ist die Partie vorbei. */
var W_ZIEL = 11;

function createMP(deps) {
  /* deps: players() -> db.players, save(), feed(text, kind) */

  var tables = new Map();      // id -> Tisch
  var partys = new Map();      // id -> Party (Einzelspiele nebeneinander)
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
    offeneStapel();
    weckAlle();
  }

  /** Alle offenen Langabfragen aufwecken. */
  function weckAlle() {
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
    if (String(id).indexOf('bot:') === 0) return true;
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
    if (opts.game === 'party') return createParty(id, opts);
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
      /* Wann sich zuletzt etwas getan hat — daran haengt die Leerlauf-Frist. */
      stillSeit: now(),
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

  /**
   * Zeigt der Zug noch auf jemanden, der ziehen kann? Wird nach jedem
   * Platzwechsel aufgerufen. Ohne das wartet der Tisch bis zu 30 Sekunden
   * auf einen Spieler, der gar nicht in der Hand ist.
   */
  function zugPruefen(t) {
    var h = t.hand;
    if (!h || h.ende || t.game !== 'poker') return;
    if (h.turn >= 0 && kannZiehen(t.seats[h.turn])) return;
    weiter(t);
  }

  function log(t, text) {
    t.log.unshift({ at: now(), text: text });
    if (t.log.length > 30) t.log.length = 30;
  }

  /* ── Platz nehmen und aufstehen ───────────────────────────────────── */

  function join(id, opts) {
    if (opts.party || partys.has(String(opts.table || ''))) {
      return joinParty(id, { party: opts.party || opts.table });
    }
    var t = tables.get(String(opts.table || ''));
    if (!t) return { error: 'Diesen Tisch gibt es nicht mehr', code: 404 };
    var p = deps.players()[id];
    if (!p) return { error: 'Spieler nicht gefunden', code: 404 };
    if (seatOf(t, id) >= 0) return { ok: true, table: t.id };
    var anderer = tableOf(id);
    if (anderer) return { error: 'Du sitzt schon an einem anderen Tisch', code: 409 };

    var frei = t.seats.indexOf(null);
    if (frei < 0) return { error: 'Der Tisch ist voll', code: 409 };

    /* Unter dem Mindesteinkauf geht gar nichts — daran fuehrt kein Weg
       vorbei, sonst saesse jemand mit zwei Chips am Tisch. */
    if (p.balance < t.minBuy) {
      return { error: 'Dafür reichen deine Chips nicht — mindestens ' + t.minBuy, code: 400 };
    }
    /* Nach oben begrenzt der Tisch, aber auch das Konto: wer 2.000 mitnehmen
       will und 800 hat, setzt sich mit 800 hin, statt abgewiesen zu werden.
       Mehr als vorhanden kann dabei nie abgebucht werden. */
    var einkauf = clamp(int(opts.buyIn) || t.minBuy * 2,
                        t.minBuy, Math.min(t.maxBuy, p.balance));

    p.balance -= einkauf;
    p.wagered += einkauf;
    t.seats[frei] = {
      id: id, name: p.name, avatar: p.avatar,
      stack: einkauf, buyIn: einkauf,
      at: now(), bereit: true, weg: 0
    };
    t.stillSeit = now();
    touch(id);
    log(t, p.name + ' setzt sich mit ' + einkauf + ' Chips an den Tisch' +
        (t.hand && !t.hand.ende ? ' — ab der nächsten Hand dabei' : ''));
    deps.save();
    /* Der freie Platz kann derselbe sein, den eben jemand geraeumt hat. Stand
       der Zug dort, zeigt er jetzt auf einen Spieler ohne Karten. */
    zugPruefen(t);
    starteWennMoeglich(t);
    bump(t);
    return { ok: true, table: t.id };
  }

  /* ── Bots ─────────────────────────────────────────────────────────────
     Ein Bot fuellt einen freien Platz, damit man nicht auf Mitspieler warten
     muss. Seine Chips kommen nicht von einem Konto, sondern aus der Bank —
     wie bei den Einzelspielen, wo man auch gegen das Haus gewinnt. Wer gegen
     Bots spielt, spielt also gegen das Casino, nicht gegen jemanden, dem die
     Chips gehoeren. Deshalb taucht so ein Gewinn auch nicht im Feed auf. */

  var BOT_NAMEN = ['Grimbart', 'Ulla', 'Knut', 'Sieglinde', 'Bertram', 'Hedda',
                   'Ottokar', 'Rosalind', 'Falk', 'Wilma'];
  var BOT_AVATARE = ['🤖', '🐙', '👻', '🦊', '🐼', '🦁', '🧙', '🐝', '🦖', '🍄'];

  /* Drei Spielweisen. Die Zahlen sind keine Kosmetik — sie aendern, wann ein
     Bot aussteigt und wann er erhoeht:

       laune        Zufall auf die eingeschaetzte Handstaerke. Viel Laune
                    heisst: er spielt auch mal Unsinn und ist schwer zu lesen,
                    verschenkt dabei aber Chips.
       foldAb       Um wieviel seine Hand ueber oder unter den Pot Odds liegen
                    darf, bevor er passt. Negativ = er geht auch mit, wenn es
                    sich rechnerisch nicht lohnt.
       raiseAb      Ab welcher Handstaerke er ueberhaupt an Erhoehen denkt.
       raiseWie     Wie oft er es dann wirklich tut.
       potAnteil    Wie gross er setzt, gemessen am Pot.
       bluff        Wie oft er ohne Hand Druck macht.

     Der Anfaenger geht fast immer mit und erhoeht kaum — die klassische
     Mitgeh-Maschine. Der Hai passt, sobald sich das Mitgehen nicht rechnet,
     setzt gross und blufft. */
  var BOT_STUFEN = {
    leicht: { name: 'Anfänger', laune: 0.30, foldAb: -0.18, raiseAb: 0.88,
              raiseWie: 0.20, potAnteil: 0.35, bluff: 0, denk: [900, 1700] },
    mittel: { name: 'Solide',   laune: 0.16, foldAb: -0.06, raiseAb: 0.80,
              raiseWie: 0.45, potAnteil: 0.60, bluff: 0.05, denk: [650, 1500] },
    schwer: { name: 'Hai',      laune: 0.07, foldAb: 0.02,  raiseAb: 0.66,
              raiseWie: 0.70, potAnteil: 0.85, bluff: 0.14, denk: [500, 1100] }
  };
  function stufeVon(s) { return BOT_STUFEN[s && s.level] || BOT_STUFEN.mittel; }

  function addBot(t, opts) {
    t.stillSeit = now();
    var frei = t.seats.indexOf(null);
    if (frei < 0) return { error: 'Der Tisch ist voll', code: 409 };
    if (t.game === 'coinflip') return { error: 'Beim Münzduell spielst du gegen echte Leute', code: 400 };

    var genutzt = t.seats.filter(Boolean).map(function (s) { return s.name; });
    var frei2 = BOT_NAMEN.filter(function (n) { return genutzt.indexOf(n) < 0; });
    var name = frei2.length ? frei2[Math.floor(Math.random() * frei2.length)] : 'Bot ' + frei;

    var einkauf = clamp(int(opts && opts.buyIn) || t.minBuy * 2, t.minBuy, t.maxBuy);
    var nr = BOT_NAMEN.indexOf(name);
    var stufe = BOT_STUFEN[opts && opts.level] ? opts.level : 'mittel';
    t.seats[frei] = {
      id: 'bot:' + newId(''), name: name,
      avatar: BOT_AVATARE[nr >= 0 ? nr : 0],
      stack: einkauf, buyIn: einkauf,
      at: now(), bot: true, level: stufe, weg: 0, denktBis: 0
    };
    log(t, name + ' setzt sich dazu (Bot, ' + BOT_STUFEN[stufe].name + ')');
    starteWennMoeglich(t);
    bump(t);
    return { ok: true };
  }

  function removeBot(t, platz) {
    var s = t.seats[platz];
    if (!s || !s.bot) return { error: 'Da sitzt kein Bot', code: 400 };
    if (t.hand && s.h && !s.h.folded) s.h.folded = true;
    t.seats[platz] = null;
    log(t, s.name + ' geht wieder');
    if (t.hand) weiter(t);
    if (besetzt(t) === 0) tables.delete(t.id);
    bump(t);
    return { ok: true };
  }

  /**
   * Wie stark ist die Hand gerade? Ergibt 0 bis 1.
   * Vor dem Flop zaehlen Hoehe, Paar, gleiche Farbe und Abstand; danach die
   * tatsaechlich beste Fuenf. Das reicht fuer einen Gegner, der nicht
   * durchschaubar ist, ohne dass er rechnen muesste wie ein Solver.
   */
  function botStaerke(s, board) {
    var a = s.h.cards[0], b = s.h.cards[1];
    if (!board.length) {
      var hi = Math.max(a.v, b.v), lo = Math.min(a.v, b.v);
      if (a.v === b.v) return clamp(0.5 + (a.v - 2) / 12 * 0.5, 0, 1);
      var w = (hi - 2) / 12 * 0.42 + (lo - 2) / 12 * 0.18;
      if (a.s === b.s) w += 0.09;
      var luecke = hi - lo - 1;
      if (luecke === 0) w += 0.07;
      else if (luecke === 1) w += 0.04;
      else w -= luecke * 0.02;
      return clamp(w, 0.02, 0.99);
    }
    var beste = holdem.bestHand(s.h.cards.concat(board));
    /* Kategorie 0..8 auf 0..1 ziehen. Ein Paar allein ist noch nichts, ab
       zwei Paaren wird es ernst. */
    var basis = [0.18, 0.38, 0.6, 0.74, 0.85, 0.9, 0.95, 0.98, 1][beste.cat];
    // hohe Beikarten heben die schwachen Kategorien leicht an
    return clamp(basis + (beste.score % 1000000) / 1e6 * 0.06, 0, 1);
  }

  function botZug(t, jetzt) {
    if (t.game === 'watten') return wattenBotZug(t, jetzt);
    if (t.game !== 'poker') return false;
    var h = t.hand;
    if (!h || h.ende || h.turn < 0) return false;
    var s = t.seats[h.turn];
    if (!s || !s.bot) return false;

    var L = stufeVon(s);

    /* Kurz "nachdenken", sonst knallen die Zuege im selben Takt durch und
       man sieht am Tisch gar nicht, was passiert ist. Der Anfaenger braucht
       laenger, der Hai entscheidet schnell. Kurz gehalten, weil an einem
       vollen Tisch fuenf Bots nacheinander dran sind — mit zwei Sekunden je
       Zug wartet der Mensch eine halbe Minute pro Setzrunde. */
    if (!s.denktBis) {
      s.denktBis = jetzt + L.denk[0] + Math.random() * (L.denk[1] - L.denk[0]);
      return false;
    }
    if (jetzt < s.denktBis) return false;
    s.denktBis = 0;

    var staerke = botStaerke(s, h.board);
    var fehlt = h.toCall - s.h.bet;
    var potOdds = fehlt > 0 ? fehlt / (h.pot + fehlt) : 0;
    var laune = (Math.random() - 0.5) * L.laune;      // nicht ganz berechenbar
    var wert = staerke + laune;
    var einsatz = Math.max(h.minRaise, Math.floor((h.pot || t.bb) * L.potAnteil));

    if (fehlt <= 0) {
      // nichts zu zahlen: mit starker Hand setzen, sonst klopfen
      if (wert > L.raiseAb - 0.08 && Math.random() < L.raiseWie) {
        return !botAction(t, s, 'raise', h.toCall + einsatz);
      }
      /* Bluff ohne Hand: nur wenn schon Karten liegen — vor dem Flop weiss
         er zu wenig, um Druck zu machen. */
      if (L.bluff && h.board.length >= 3 && wert < 0.4 && Math.random() < L.bluff) {
        return !botAction(t, s, 'raise', h.toCall + einsatz);
      }
      return !botAction(t, s, 'check');
    }
    if (wert < potOdds + L.foldAb) return !botAction(t, s, 'fold');
    if (wert > L.raiseAb && Math.random() < L.raiseWie) {
      return !botAction(t, s, 'raise', h.toCall + einsatz);
    }
    return !botAction(t, s, 'call');
  }

  /** Zug eines Bots ausfuehren; faellt auf das Einfachste zurueck. */
  function botAction(t, s, was, betrag) {
    var i = seatOf(t, s.id);
    var out = handleAction(t, i, { action: was, amount: betrag });
    if (out.error) {
      var fehlt = t.hand.toCall - s.h.bet;
      out = handleAction(t, i, { action: fehlt > 0 ? 'call' : 'check' });
    }
    return out.error;
  }

  /* ── Aufloesen ──────────────────────────────────────────────────────
     Ein Tisch oder eine Party wird abgeraeumt und alle gehen leer aus — mit
     ihren Chips, versteht sich. Zwei Wege fuehren hierher: der Admin raeumt
     von Hand auf, oder eine Runde kommt gar nicht erst in Gang. */

  /* So lange darf eine Lobby stehen, ohne dass etwas passiert. Gemessen wird
     ab der letzten Aenderung, nicht ab dem Aufmachen: wer nach zwei Minuten
     dazukommt, verlaengert die Frist fuer alle. Sonst loeste sich ein Tisch
     genau in dem Moment auf, in dem er endlich voll wird. */
  var LEER_MS = 3 * 60000;

  /**
   * Tisch oder Party aufloesen.
   *
   * Bei einem Tisch muss jeder Stapel zurueck aufs Konto — deshalb geht das
   * ueber leave() je Platz und nicht ueber ein blosses Loeschen aus der
   * Sammlung. Bots haben kein Konto, die fallen einfach weg.
   */
  function aufloesen(id, grund) {
    var t = tables.get(String(id || ''));
    if (t) {
      log(t, grund || 'Tisch aufgelöst');
      t.seats.slice().forEach(function (sitz) {
        if (sitz && !sitz.bot) leave(sitz.id, grund || 'Tisch aufgelöst');
      });
      tables.delete(t.id);
      deps.save();
      bump(null);
      return { ok: true, art: 'tisch', name: t.name };
    }
    var pa = partys.get(String(id || ''));
    if (pa) {
      /* In einer Gratis-Party liegen keine Chips vom Konto — die Partykasse
         gehoert der Party. Es reicht, sie wegzunehmen; die Browser merken es
         an der 404 und raeumen ihre Kasse selbst ab. Bei einer Buy-in-Party
         steht dagegen echtes Guthaben drin: das wird vorher abgerechnet. */
      partyAbrechnen(pa);
      partys.delete(pa.id);
      bump(null);
      return { ok: true, art: 'party', name: pa.name };
    }
    return { error: 'Diesen Tisch gibt es nicht mehr', code: 404 };
  }

  /** Wann hat sich an dieser Lobby zuletzt etwas getan? */
  function ruehrung(t) {
    return t.stillSeit || t.createdAt || now();
  }

  /**
   * Lobbys aufraeumen, in denen nichts in Gang kommt.
   *
   * Ein Tisch, an dem seit drei Minuten niemand mehr dazugekommen ist und
   * der immer noch keine Hand gespielt hat, steht nur im Weg — er belegt
   * einen Platz in der Uebersicht und haelt die Chips seiner Wartenden fest.
   * Dasselbe gilt fuer eine Party, die nie gestartet wird.
   */
  function leerlauf(jetzt) {
    tables.forEach(function (t) {
      if (t.hand) return;                       // laeuft, oder lief schon
      if (jetzt - ruehrung(t) < LEER_MS) return;
      aufloesen(t.id, 'Niemand hat gespielt — Tisch aufgelöst');
    });
    partys.forEach(function (pa) {
      if (pa.status !== 'lobby') return;
      if (jetzt - ruehrung(pa) < LEER_MS) return;
      aufloesen(pa.id, 'Party nicht gestartet');
    });
  }

  /** Aufstehen. Der Stapel geht zurueck aufs Konto. */
  function leave(id, grund) {
    var raus = leaveParty(id);
    if (raus) return raus;
    var t = tableOf(id);
    if (!t) return { ok: true };
    t.stillSeit = now();
    var i = seatOf(t, id);
    var s = t.seats[i];
    var p = deps.players()[id];

    /* Mitten in einer Hand zaehlt das Aufstehen wie aufgeben: der bereits
       gesetzte Teil bleibt im Pot, der Rest kommt zurueck. */
    if (t.hand && s.h && !s.h.folded) {
      s.h.folded = true;
      log(t, s.name + ' verlässt den Tisch und gibt auf');
    }
    /* Was schon im Pot liegt, gehoert nicht mehr ihm — es bleibt drin und
       geht an den Gewinner. Der Platz wird gleich geleert, deshalb muss der
       Betrag hier gemerkt werden: sonst faellt er beim Abrechnen unter den
       Tisch und die Chips sind schlicht weg. Genau das ist passiert. */
    var extra = 0;
    if (t.hand && !t.hand.ende && s.h) {
      if (s.h.gesamt > 0) t.hand.tot = (t.hand.tot || 0) + s.h.gesamt;

      var restlich = imSpiel(t);          // er selbst ist eben rausgeflogen
      if (!restlich.length) {
        /* Er war der Letzte, der die Hand noch haette gewinnen koennen — alle
           anderen hatten schon gepasst. Damit haette ihm der Pot ohnehin
           gehoert, und ohne diese Rueckgabe verschwaende er mit dem Tisch. */
        extra = t.hand.pot;
        t.hand.pot = 0;
        t.hand.tot = 0;
        t.hand.turn = -1;
        t.hand.deadline = 0;
        t.hand.ende = now();
        if (extra) log(t, s.name + ' nimmt den Pot mit (' + extra + ') — sonst war niemand mehr drin');
      } else if (restlich.length === 1) {
        /* Nur noch einer uebrig: die Hand ist entschieden. */
        beende(t, restlich);
      }
    }
    /* Watten braucht zwei feste Mannschaften. Faellt einer aus, laesst sich
       die Hand nicht sinnvoll zu Ende spielen — sie wird abgebrochen, es hat
       ja noch niemand gezahlt. */
    if (t.game === 'watten' && t.hand && !t.hand.ende) {
      t.hand = null;
      t.naechste = 0;
      log(t, 'Hand abgebrochen — es fehlt ein Spieler');
    }

    if (p) {
      s.stack += extra;
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

    /* Weiterschalten nur, wenn der Aufstehende auch am Zug war — sonst
       ueberspringt sein Weggang den Zug von jemand anderem. */
    if (t.hand && !t.hand.ende && t.hand.turn === i) weiter(t);
    zugPruefen(t);
    /* Ein Tisch, an dem nur noch Bots sitzen, spielt gegen sich selbst —
       der wird abgeraeumt. */
    if (!t.seats.some(function (x) { return x && !x.bot; })) tables.delete(t.id);
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

    partyTick(jetzt);
    leerlauf(jetzt);

    tables.forEach(function (t) {
      // wer lange nicht mehr da war, wird vom Tisch genommen
      t.seats.forEach(function (s) {
        if (!s) return;
        if (s.bot || isOnline(s.id)) { s.weg = 0; return; }
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
        return;
      }
      if (botZug(t, jetzt)) etwas = true;
    });

    // abgelaufene Anwesenheit aufraeumen
    online.forEach(function (o, id) { if (jetzt - o.at > DROP_MS) online.delete(id); });

    if (etwas) bump(null);
  }

  function starteHand(t) {
    if (t.game === 'coinflip') return starteFlip(t);
    if (t.game === 'watten') return starteWatten(t);
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

  /**
   * Kann dieser Platz gerade einen Zug machen?
   *
   * Ein besetzter Platz heisst nicht, dass der Spieler auch in der Hand ist:
   * wer sich mitten in eine laufende Hand setzt, bekommt keine Karten und
   * damit kein h. Genau das ist passiert, als jemand aufstand und ein Neuer
   * auf denselben Platz nachrueckte — der Zug zeigte dann auf einen Spieler,
   * der gar nicht mitspielte.
   */
  function kannZiehen(s) {
    return !!(s && s.h && !s.h.folded && !s.h.allIn);
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

  /* ── Partymodus ────────────────────────────────────────────────────
     Eine Party ist kein Tisch: es gibt keine Plaetze, keine Karten und
     keine Runden, an denen alle gemeinsam haengen. Jeder spielt fuer sich
     die gewohnten Einzelspiele — nur eben mit demselben Startguthaben,
     derselben Spielauswahl und derselben Uhr. Verglichen wird am Ende der
     Gewinn.

     Deshalb liegt das hier neben den Tischen und nicht in ihnen: die ganze
     Tischmaschinerie (Einkauf, Blinds, Zugfristen, Bots) waere hier nur im
     Weg. Gemeinsam benutzt werden nur die Langabfrage und die Praesenz. */

  var P_MAX = 8;              // mehr Namen passen nicht mehr ins Leaderboard
  var P_COUNTDOWN = 8000;     // Vorlauf, damit alle die Uhr sehen
  var P_MELDUNGEN = 8;        // so viele Grossgewinne bleiben stehen
  /* Nach dem Abpfiff bleibt der Kasse kurz Zeit, ihren Schlussstand zu
     melden — erst danach wird eine Buy-in-Party ausgezahlt. */
  var P_SCHLUSSFRIST = 2500;

  function partyOf(id) {
    var gefunden = null;
    partys.forEach(function (pa) {
      if (pa.spieler.some(function (s) { return s.id === id; })) gefunden = pa;
    });
    return gefunden;
  }

  function partySpieler(pa, id) {
    for (var i = 0; i < pa.spieler.length; i++) if (pa.spieler[i].id === id) return pa.spieler[i];
    return null;
  }

  function createParty(id, opts) {
    var p = deps.players()[id];
    if (!p) return { error: 'Spieler nicht gefunden', code: 404 };
    if (tableOf(id)) return { error: 'Du sitzt schon an einem Tisch', code: 409 };
    if (partyOf(id)) return { error: 'Du bist schon in einer Party', code: 409 };
    if (partys.size >= 20) return { error: 'Gerade laufen zu viele Partys', code: 429 };

    var pa = {
      id: newId('p'),
      name: String(opts.name || (p.name + 's Party')).slice(0, 24),
      host: id,
      status: 'lobby',
      startChips: clamp(int(opts.startChips) || 1000, 100, 100000),
      dauer: clamp(int(opts.dauer) || 600, 60, 3600),
      spiele: reinigeSpiele(opts.spiele),
      /* Alle Spiele offen, auch die, die ein Teilnehmer noch nicht
         freigespielt hat. Sonst sitzt in einer Party mit acht Leuten die
         Haelfte vor verschlossenen Kacheln, weil der Gastgeber ein Spiel
         ausgesucht hat, das erst ab Stufe sieben aufgeht. */
      alleFrei: opts.alleFrei !== false,
      /* Nachschub: wer alles verspielt hat, bekommt diesen Betrag geschenkt
         und spielt weiter. 0 heisst aus — dann sitzt der Pleitegeier bis zum
         Ende daneben. Der Nachschub zaehlt gegen den Gewinn (siehe
         sichtParty), sonst gewaenne die Rangliste, wer am oeftesten pleite
         geht. */
      nachschub: opts.nachschub === undefined ? 250 : clamp(int(opts.nachschub), 0, 100000),
      /* Zwei Arten von Party:
         aus = Gratis-Chips. Die Party bekommt eigene Chips geschenkt, das
               Konto bleibt unberuehrt. So war es bisher immer.
         an  = eigene Chips. Jeder zahlt sein Startguthaben vom Konto ein und
               bekommt am Ende das heraus, was noch in der Kasse liegt.
         Nachschub und Buy-in schliessen sich aus: geschenkte Chips waeren
         hier echtes Geld aus dem Nichts. */
      eigeneChips: !!opts.eigeneChips,
      /* Liegengebliebene Gewinne vorzeitiger Aussteiger — gehen an den Sieger. */
      topf: 0,
      spieler: [],
      startAt: 0,
      endeAt: 0,
      meldungen: [],
      createdAt: now(),
      stillSeit: now(),
      v: seq + 1
    };
    if (pa.eigeneChips) pa.nachschub = 0;
    partys.set(pa.id, pa);
    var ein = joinParty(id, { party: pa.id });
    if (ein.error) { partys.delete(pa.id); return ein; }
    return { ok: true, party: pa.id };
  }

  /** Nur Spiele, die es wirklich gibt — die Liste kommt aus dem Browser. */
  function reinigeSpiele(liste) {
    if (!Array.isArray(liste)) return [];
    var raus = [];
    liste.forEach(function (g) {
      var s = String(g || '').slice(0, 24);
      if (s && raus.indexOf(s) < 0 && raus.length < 40) raus.push(s);
    });
    return raus;
  }

  function joinParty(id, opts) {
    var pa = partys.get(String(opts.party || ''));
    if (!pa) return { error: 'Diese Party gibt es nicht mehr', code: 404 };
    if (partySpieler(pa, id)) return { ok: true, party: pa.id };
    if (partyOf(id)) return { error: 'Du bist schon in einer Party', code: 409 };
    if (tableOf(id)) return { error: 'Du sitzt schon an einem Tisch', code: 409 };
    if (pa.status !== 'lobby') return { error: 'Die Party laeuft schon', code: 409 };
    if (pa.spieler.length >= P_MAX) return { error: 'Die Party ist voll', code: 409 };

    var p = deps.players()[id];
    if (!p) return { error: 'Spieler nicht gefunden', code: 404 };
    /* Bei einer Buy-in-Party wird schon hier geprueft: abgebucht wird erst
       beim Start, aber niemand soll in einer Lobby sitzen, aus der er beim
       Start wieder herausfliegt. */
    if (pa.eigeneChips && p.balance < pa.startChips) {
      return { error: 'Dafür reichen deine Chips nicht — nötig sind ' + pa.startChips, code: 400 };
    }
    pa.spieler.push({
      id: id, name: p.name, avatar: p.avatar,
      chips: pa.startChips, start: pa.startChips,
      nachschub: 0, besterWin: 0, runden: 0, at: now(),
      /* Was diese Person vom Konto eingezahlt hat und noch zurueckbekommt.
         0 heisst: nichts offen (Gratis-Party oder schon abgerechnet). */
      bezahlt: 0
    });
    pa.stillSeit = now();
    touch(id);
    bumpParty(pa);
    return { ok: true, party: pa.id };
  }

  /** Einen Anteil aufs Konto zurueckbuchen. `bezahlt` ist danach zu. */
  function partyAuszahlen(pa, s, betrag) {
    var p = deps.players()[s.id];
    var raus = clamp(int(betrag), 0, pa.startChips * 1000);
    s.bezahlt = 0;
    s.ausgezahlt = raus;
    if (!p) return 0;
    p.balance += raus;
    p.returned = (p.returned || 0) + raus;
    p.plays = (p.plays || 0) + 1;
    if (raus > pa.startChips) {
      p.wins = (p.wins || 0) + 1;
      p.biggestWin = Math.max(p.biggestWin || 0, raus - pa.startChips);
      p.peak = Math.max(p.peak || 0, p.balance);
    } else if (raus < pa.startChips) {
      p.losses = (p.losses || 0) + 1;
    }
    return raus;
  }

  /**
   * Buy-in-Party abrechnen — der Sieger nimmt die Gewinne.
   *
   * Die Regel der Party: wer am Ende vorn liegt, bekommt seinen eigenen Stand
   * *und* den Gewinn aller anderen dazu. Wer im Plus war, aber nicht Erster,
   * bekommt nur seinen Einsatz zurueck. Verluste wandern nirgendwohin — wer
   * im Minus steht, behaelt den Rest seiner Kasse und mehr passiert nicht.
   *
   * Wer vorzeitig geht, nimmt hoechstens seinen Einsatz mit; sein Gewinn
   * bleibt als Topf liegen und geht an den spaeteren Sieger. Sonst koennte
   * man mit einem Gluecksgriff aussteigen und die Regel umgehen.
   *
   * Einmal je Person — `bezahlt` ist der Merker. Deshalb laeuft jeder Ausgang
   * hierher: Zeit abgelaufen, Gastgeber beendet, jemand geht vorzeitig, Party
   * wird aufgeloest. Bei einer Gratis-Party tut das hier nichts.
   */
  function partyAbrechnen(pa, nurId) {
    if (!pa.eigeneChips) return 0;
    var summe = 0;

    if (nurId) {
      var einer = partySpieler(pa, nurId);
      if (!einer || einer.bezahlt <= 0) return 0;
      pa.topf = (pa.topf || 0) + Math.max(0, int(einer.chips) - pa.startChips);
      summe = partyAuszahlen(pa, einer, Math.min(int(einer.chips), pa.startChips));
      deps.save();
      return summe;
    }

    var drin = pa.spieler.filter(function (s) { return s.bezahlt > 0; });
    if (!drin.length) return 0;
    var sieger = drin.reduce(function (a, b) { return int(b.chips) > int(a.chips) ? b : a; });
    var topf = pa.topf || 0;
    drin.forEach(function (s) {
      if (s !== sieger) topf += Math.max(0, int(s.chips) - pa.startChips);
    });
    drin.forEach(function (s) {
      summe += partyAuszahlen(pa, s,
        s === sieger ? int(s.chips) + topf : Math.min(int(s.chips), pa.startChips));
    });
    pa.topf = 0;
    deps.save();
    return summe;
  }

  function leaveParty(id) {
    var pa = partyOf(id);
    if (!pa) return null;
    /* Wer vorzeitig geht, nimmt bei einer Buy-in-Party mit, was gerade in
       seiner Kasse liegt — verfallen wuerde echtes Kontoguthaben. */
    partyAbrechnen(pa, id);
    pa.spieler = pa.spieler.filter(function (s) { return s.id !== id; });
    if (!pa.spieler.length) {
      partys.delete(pa.id);
      bump(null);
      return { ok: true };
    }
    /* Geht der Gastgeber, uebernimmt der Naechste — sonst haengt eine Party
       ohne jemanden, der sie starten darf. */
    if (pa.host === id) pa.host = pa.spieler[0].id;
    pa.stillSeit = now();
    bumpParty(pa);
    return { ok: true };
  }

  /**
   * Aenderung an einer Party bekanntgeben.
   *
   * Mit Bedacht gedrosselt: acht Spieler melden ihren Stand mehrmals je
   * Sekunde, und jede Meldung weckt saemtliche offenen Langabfragen. Ohne
   * Bremse fragte jeder Browser danach sofort wieder an — aus der
   * Langabfrage wuerde ein Rundlauf mit siebzig Anfragen je Sekunde.
   *
   * Wichtiges (Beitritt, Start, Ende, Grossgewinn) geht sofort raus. Der
   * blosse Zwischenstand wartet auf den naechsten Sekundentakt; so schnell
   * muss eine Rangliste nicht sein.
   */
  function bumpParty(pa, eilig) {
    pa.v = ++seq;
    if (eilig === false) { pa.schuldet = true; return; }
    pa.schuldet = false;
    pa.zuletztGeweckt = now();
    weckAlle();
  }

  function partyAction(pa, id, op) {
    var mich = partySpieler(pa, id);
    if (!mich) return { error: 'Du bist nicht in dieser Party', code: 409 };

    if (op.action === 'partyset') {
      if (pa.host !== id) return { error: 'Das darf nur der Gastgeber', code: 403 };
      if (pa.status !== 'lobby') return { error: 'Die Party laeuft schon', code: 409 };
      if (op.startChips !== undefined) pa.startChips = clamp(int(op.startChips), 100, 100000);
      if (op.dauer !== undefined) pa.dauer = clamp(int(op.dauer), 60, 3600);
      if (op.spiele !== undefined) pa.spiele = reinigeSpiele(op.spiele);
      if (op.alleFrei !== undefined) pa.alleFrei = !!op.alleFrei;
      if (op.nachschub !== undefined) pa.nachschub = clamp(int(op.nachschub), 0, 100000);
      if (op.eigeneChips !== undefined) pa.eigeneChips = !!op.eigeneChips;
      /* Buy-in und Nachschub zusammen hiesse: geschenkte Chips landen als
         echtes Guthaben auf dem Konto. Also schliesst das eine das andere aus. */
      if (pa.eigeneChips) pa.nachschub = 0;
      if (op.name !== undefined) pa.name = String(op.name).slice(0, 24) || pa.name;
      /* Das Startguthaben gilt fuer alle, auch fuer die, die schon da sind. */
      pa.spieler.forEach(function (s) {
        s.chips = pa.startChips; s.start = pa.startChips; s.nachschub = 0;
      });
      pa.stillSeit = now();
      bumpParty(pa);
      return { ok: true };
    }

    if (op.action === 'partystart') {
      if (pa.host !== id) return { error: 'Das darf nur der Gastgeber', code: 403 };
      if (pa.status !== 'lobby') return { error: 'Die Party laeuft schon', code: 409 };
      if (!pa.spiele.length) return { error: 'Waehle mindestens ein Spiel aus', code: 400 };
      /* Buy-in: erst pruefen, dann abbuchen. Beides in einem Rutsch, damit
         niemand einzahlt, waehrend ein anderer den Start scheitern laesst. */
      if (pa.eigeneChips) {
        var leute = deps.players();
        var fehlt = null;
        pa.spieler.forEach(function (s) {
          var p = leute[s.id];
          if (!p || p.balance < pa.startChips) fehlt = fehlt || s.name;
        });
        if (fehlt) {
          return { error: fehlt + ' hat keine ' + pa.startChips + ' Chips für den Einsatz', code: 400 };
        }
        pa.spieler.forEach(function (s) {
          var p = leute[s.id];
          p.balance -= pa.startChips;
          p.wagered = (p.wagered || 0) + pa.startChips;
          s.bezahlt = pa.startChips;
        });
        deps.save();
      }
      pa.status = 'countdown';
      pa.startAt = now() + P_COUNTDOWN;
      pa.endeAt = pa.startAt + pa.dauer * 1000;
      pa.spieler.forEach(function (s) {
        s.chips = pa.startChips; s.start = pa.startChips;
        s.nachschub = 0; s.besterWin = 0; s.runden = 0; s.ausgezahlt = 0;
      });
      pa.meldungen = [];
      bumpParty(pa);
      return { ok: true };
    }

    if (op.action === 'partystand') {
      /* Nach dem Abpfiff wird noch kurz zugehoert: der Browser meldet seinen
         Schlussstand, und bei einer Buy-in-Party haengt daran, was aufs Konto
         zurueckgeht. Sobald abgerechnet ist (bezahlt = 0), ist Schluss. */
      var nochOffen = pa.status === 'ende' && pa.eigeneChips && mich.bezahlt > 0;
      if (pa.status !== 'laeuft' && !nochOffen) return { ok: true };
      /* Der Browser meldet seinen Stand. Das ist die eine Stelle, an der
         der Server dem Client glauben muss: die Einzelspiele laufen dort.
         Begrenzt wird trotzdem — ein Stand ausserhalb jeder Vernunft waere
         ein offensichtlicher Eingriff und wird gekappt. */
      var hoechst = pa.startChips * 1000;
      mich.chips = clamp(int(op.chips), 0, hoechst);
      mich.runden = clamp(int(op.runden), 0, 1000000);
      /* Wieviel geschenkter Nachschub bisher drinsteckt. Der Browser zaehlt
         mit, der Server nimmt es entgegen — und zieht es vom Gewinn ab. */
      if (op.nachschub !== undefined) mich.nachschub = clamp(int(op.nachschub), 0, hoechst);
      mich.at = now();
      if (int(op.besterWin) > mich.besterWin) {
        mich.besterWin = clamp(int(op.besterWin), 0, hoechst);
      }
      /* Ein Grossgewinn wird allen gemeldet — er bleibt im Leaderboard
         stehen, damit ihn auch sieht, wer gerade woanders hinschaut. */
      var betrag = clamp(int(op.win), 0, hoechst);
      if (betrag > 0) {
        pa.meldungen.unshift({
          at: now(), id: id, name: mich.name, avatar: mich.avatar,
          betrag: betrag, spiel: String(op.spiel || '').slice(0, 24)
        });
        if (pa.meldungen.length > P_MELDUNGEN) pa.meldungen.length = P_MELDUNGEN;
      }
      /* Ein Grossgewinn soll sofort bei allen ankommen, ein blosser
         Zwischenstand darf bis zum naechsten Sekundentakt warten. */
      bumpParty(pa, betrag > 0);
      return { ok: true };
    }

    if (op.action === 'partyende') {
      if (pa.host !== id) return { error: 'Das darf nur der Gastgeber', code: 403 };
      pa.status = 'ende';
      pa.endeAt = now();
      pa.abrechnenAb = now() + P_SCHLUSSFRIST;
      bumpParty(pa);
      return { ok: true };
    }

    if (op.action === 'partyneu') {
      if (pa.host !== id) return { error: 'Das darf nur der Gastgeber', code: 403 };
      /* Noch eine Runde heisst bei Buy-in: erst die alte auszahlen, dann
         beim naechsten Start neu einzahlen. */
      partyAbrechnen(pa);
      pa.status = 'lobby';
      pa.startAt = 0; pa.endeAt = 0; pa.meldungen = []; pa.topf = 0;
      pa.spieler.forEach(function (s) {
        s.chips = pa.startChips; s.start = pa.startChips;
        s.nachschub = 0; s.besterWin = 0; s.runden = 0; s.ausgezahlt = 0;
      });
      bumpParty(pa);
      return { ok: true };
    }

    return { error: 'Unbekannte Party-Aktion', code: 400 };
  }

  /** Countdown und Spielzeit weiterdrehen — laeuft im selben Sekundentakt. */
  function partyTick(jetzt) {
    partys.forEach(function (pa) {
      /* Aufgeschobene Zwischenstaende jetzt bekanntgeben. */
      if (pa.schuldet) bumpParty(pa);
      if (pa.status === 'countdown' && jetzt >= pa.startAt) {
        pa.status = 'laeuft';
        bumpParty(pa);
      } else if (pa.status === 'laeuft' && jetzt >= pa.endeAt) {
        pa.status = 'ende';
        pa.abrechnenAb = jetzt + P_SCHLUSSFRIST;
        bumpParty(pa);
      }
      /* Buy-in auszahlen, sobald die Schlussfrist um ist. */
      if (pa.status === 'ende' && pa.eigeneChips && jetzt >= (pa.abrechnenAb || 0)) {
        if (partyAbrechnen(pa)) bumpParty(pa);
      }
      /* Eine Party, in der seit einer Viertelstunde niemand mehr war,
         raeumt sich selbst weg. */
      var letzte = 0;
      pa.spieler.forEach(function (s) {
        var o = online.get(s.id);
        if (o && o.at > letzte) letzte = o.at;
      });
      if (letzte && jetzt - letzte > 15 * 60000) {
        partyAbrechnen(pa);
        partys.delete(pa.id);
        bump(null);
      }
    });
  }

  function sichtParty(pa, viewer) {
    /* Gewinn heisst: was am Ende dasteht, minus Startguthaben, minus allem
       geschenkten Nachschub. Ohne den Abzug fuehrte die Rangliste an, wer am
       oeftesten pleite ging — jede Gratisgabe wuerde als Gewinn zaehlen. */
    function gewinn(s) { return s.chips - s.start - (s.nachschub || 0); }
    var rang = pa.spieler.slice().sort(function (a, b) {
      return gewinn(b) - gewinn(a) || b.chips - a.chips;
    });
    return {
      art: 'party',
      id: pa.id,
      /* Ohne diese Nummer zeichnet der Browser die Ansicht nie neu: er
         vergleicht sie mit der zuletzt gezeichneten. Fehlt sie, steht der
         Countdown still und die Teilnehmerliste veraltet. */
      v: pa.v,
      name: pa.name,
      host: pa.host,
      ichBinHost: pa.host === viewer,
      status: pa.status,
      startChips: pa.startChips,
      dauer: pa.dauer,
      spiele: pa.spiele.slice(),
      alleFrei: !!pa.alleFrei,
      nachschub: pa.nachschub || 0,
      eigeneChips: !!pa.eigeneChips,
      topf: pa.topf || 0,
      max: P_MAX,
      startAt: pa.startAt,
      endeAt: pa.endeAt,
      jetzt: now(),
      meldungen: pa.meldungen.slice(),
      spieler: rang.map(function (s) {
        return {
          id: s.id, name: s.name, avatar: s.avatar,
          chips: s.chips, gewinn: gewinn(s), runden: s.runden,
          nachschub: s.nachschub || 0,
          /* Was nach der Regel wirklich aufs Konto ging — erst nach der
             Abrechnung gesetzt, vorher 0. */
          ausgezahlt: s.ausgezahlt || 0,
          offen: (s.bezahlt || 0) > 0,
          besterWin: s.besterWin, online: isOnline(s.id), ich: s.id === viewer
        };
      })
    };
  }

  function action(id, op) {
    var pa = partyOf(id);
    if (pa) return partyAction(pa, id, op);
    var t = tableOf(id);
    if (!t) return { error: 'Du sitzt an keinem Tisch', code: 409 };
    touch(id);
    if (op.action === 'rebuy') return rebuy(t, id, op);
    if (op.action === 'addbot') return addBot(t, op);
    if (op.action === 'kickbot') return removeBot(t, int(op.seat));
    if (t.game === 'coinflip') return flipAction(t, id, op);
    if (t.game === 'watten') return wattenAction(t, id, op);
    return handleAction(t, seatOf(t, id), op);
  }

  /** Der eigentliche Pokerzug — von Menschen wie von Bots benutzt. */
  function handleAction(t, i, op) {
    var h = t.hand;
    if (!h || h.ende) return { error: 'Gerade läuft keine Hand', code: 409 };
    if (h.turn !== i) return { error: 'Du bist nicht dran', code: 409 };

    var s = t.seats[i];
    if (!kannZiehen(s)) {
      /* Kann eigentlich nicht sein, weil der Zug nur auf ziehbaren Plaetzen
         steht — aber wenn doch, soll der Spieler eine Meldung sehen statt
         eines Serverfehlers, und der Tisch soll weiterlaufen. */
      weiter(t);
      bump(t);
      return { error: 'Du bist in dieser Hand nicht dabei — warte auf die nächste', code: 409 };
    }
    var was = String(op.action || '');
    var fehlt = h.toCall - s.h.bet;

    if (was === 'fold') {
      s.h.folded = true;
      s.h.tag = 'PASST';
      log(t, s.name + ' passt');
    } else if (was === 'check') {
      if (fehlt > 0) return { error: 'Da steht noch ein Einsatz', code: 400 };
      s.h.tag = 'KLOPFT';
      log(t, s.name + ' klopft');
    } else if (was === 'call') {
      var b = Math.min(fehlt, s.stack);
      zahl(t, i, b);
      s.h.tag = b < fehlt ? 'ALL-IN' : 'GEHT MIT';
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
      s.h.tag = s.stack === 0 ? 'ALL-IN' : 'ERHÖHT';
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
    if (t.game === 'watten') { wattenTimeout(t); return; }
    var h = t.hand;
    if (!h || h.ende) return;

    var s = h.turn >= 0 ? t.seats[h.turn] : null;
    if (!kannZiehen(s)) {
      /* Der Zug zeigt ins Leere. Frueher wurde hier einfach nichts getan —
         die Frist blieb in der Vergangenheit, jeder Takt versuchte dasselbe
         erneut und der Tisch stand still. Jetzt geht es weiter. */
      log(t, 'Der Zug lag auf einem leeren Platz — es geht weiter');
      weiter(t);
      /* Falls weiter() nichts bewegen konnte, ist die Hand hier zu Ende;
         sonst haengt der Tisch beim naechsten Takt wieder an derselben
         Stelle. */
      if (t.hand && !t.hand.ende && !kannZiehen(t.seats[t.hand.turn])) {
        beende(t, imSpiel(t));
      }
      return;
    }

    var fehlt = h.toCall - s.h.bet;
    if (fehlt <= 0) { s.h.dran = true; s.h.tag = 'KLOPFT'; log(t, s.name + ' klopft (Zeit)'); }
    else { s.h.folded = true; s.h.tag = 'PASST'; log(t, s.name + ' passt (Zeit)'); }
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
    var naechster = naechsterPlatz(t, von, kannZiehen);
    /* Findet sich niemand mehr, der ziehen kann, ist die Setzrunde vorbei.
       Ohne diese Pruefung stand h.turn auf -1, die Frist lief trotzdem weiter
       und der Tisch haengte: alle 30 Sekunden gab es neue 30 Sekunden, ohne
       dass irgendetwas passierte. */
    if (naechster < 0) return naechsteStrasse(t);
    h.turn = naechster;
    h.deadline = now() + TURN_MS;
  }

  function neueStrasseVorbereiten(t) {
    var h = t.hand;
    t.seats.forEach(function (s) {
      if (!s || !s.h) return;
      s.h.bet = 0;
      s.h.dran = false;
      /* Die Marke der letzten Aktion gilt nur fuer die laufende Setzrunde —
         wer noch dabei ist, faengt bei der naechsten wieder bei null an.
         "Passt" bleibt stehen, das gilt fuer die ganze Hand. */
      if (!s.h.folded) s.h.tag = '';
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

    /* Der Einsatz von Weggegangenen liegt noch im Pot, ihr Platz aber nicht
       mehr am Tisch. Er kommt in den untersten Topf — da waren sie von Anfang
       an dabei, und mehr als bis dorthin haetten sie ohnehin nicht gewonnen. */
    var tot = (t.hand && t.hand.tot) || 0;
    if (tot > 0) {
      if (out.length) out[0].betrag += tot;
      else out.push({ betrag: tot, spieler: imSpiel(t) });
    }
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

  /* ═══════════════ WATTEN ═══════════════ */

  function wDeck() {
    var d = [];
    W_FARBEN.forEach(function (f) {
      W_RANG.forEach(function (r) {
        d.push({ r: r.r, v: r.v, s: f.s, red: f.s === '♥' || f.s === '♦' });
      });
    });
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  function kritisch(c) {
    for (var i = 0; i < W_KRITISCH.length; i++) {
      if (W_KRITISCH[i].r === c.r && W_KRITISCH[i].s === c.s) return i;   // 0 = Max
    }
    return -1;
  }

  /** Wie stark ist die Karte? 0 heisst: zaehlt nur in der angespielten Farbe. */
  function wWert(c, h) {
    var k = kritisch(c);
    if (k >= 0) return 1000 - k;                       // Max 1000, Belli 999, Spitz 998
    if (c.r === h.schlag && c.s === h.trumpf) return 900;   // der Rechte
    if (c.r === h.schlag) return 800;                      // Blinde, alle gleich
    if (c.s === h.trumpf) return 700 + c.v;
    return 0;
  }

  /** Wer holt den Stich? Gibt den Platz zurueck. */
  function wStich(karten, h) {
    var farbe = karten[0].card.s;
    var besterWert = -1, bester = karten[0].platz;
    karten.forEach(function (x) {
      var w = wWert(x.card, h);
      if (w === 0) w = x.card.s === farbe ? x.card.v : -1;
      /* Strikt groesser: bei den gleichwertigen Blinden bleibt damit die
         zuerst gelegte Karte vorn — genau so wird gewattet. */
      if (w > besterWert) { besterWert = w; bester = x.platz; }
    });
    return bester;
  }

  function team(platz) { return platz % 2; }

  function starteWatten(t) {
    var dabei = t.seats.filter(Boolean);
    if (dabei.length < 4) return;

    var deck = wDeck();
    t.dealer = naechsterPlatz(t, t.dealer, function (s) { return !!s; });
    var vorhand = naechsterPlatz(t, t.dealer, function (s) { return !!s; });

    t.seats.forEach(function (s) {
      if (!s) return;
      s.h = { cards: deck.splice(0, 5), gelegt: null };
    });

    t.hand = {
      nr: (t.handNr = (t.handNr || 0) + 1),
      phase: 'schlag',                 // schlag → trumpf → spiel → ende
      schlag: null, trumpf: null,
      vorhand: vorhand,
      stich: [],                        // die Karten des laufenden Stichs
      stichNr: 1,
      gewonnen: [0, 0],                 // Stiche je Mannschaft
      anspiel: vorhand,
      turn: vorhand,                    // Vorhand sagt den Schlag an
      punkte: 2,
      gehenVon: null,                   // Mannschaft, die erhoeht hat
      deadline: now() + TURN_MS,
      ende: 0,
      ergebnis: null
    };
    log(t, 'Hand ' + t.hand.nr + ' — ' + t.seats[vorhand].name + ' sagt den Schlag an');
    bump(t);
  }

  function wattenAction(t, id, op) {
    var h = t.hand;
    if (!h || h.ende) return { error: 'Gerade läuft keine Hand', code: 409 };
    var i = seatOf(t, id);
    var was = String(op.action || '');

    /* Erhoehen und Antworten laufen quer zur Reihenfolge — deshalb zuerst. */
    if (was === 'gehen') return wGehen(t, i);
    if (was === 'dabei' || was === 'aus') return wAntwort(t, i, was);
    if (h.antwortVon !== undefined && h.antwortVon !== null) {
      return { error: 'Erst muss die Erhöhung beantwortet werden', code: 409 };
    }
    if (h.turn !== i) return { error: 'Du bist nicht dran', code: 409 };

    if (h.phase === 'schlag') {
      var r = W_RANG.filter(function (x) { return x.r === String(op.schlag); })[0];
      if (!r) return { error: 'Diesen Schlag gibt es nicht', code: 400 };
      h.schlag = r.r;
      h.phase = 'trumpf';
      h.turn = t.dealer;                // der Geber sagt die Farbe an
      h.deadline = now() + TURN_MS;
      log(t, t.seats[i].name + ' sagt Schlag ' + r.name);
      bump(t);
      return { ok: true };
    }

    if (h.phase === 'trumpf') {
      var f = W_FARBEN.filter(function (x) { return x.s === String(op.trumpf); })[0];
      if (!f) return { error: 'Diese Farbe gibt es nicht', code: 400 };
      h.trumpf = f.s;
      h.phase = 'spiel';
      h.turn = h.vorhand;
      h.anspiel = h.vorhand;
      h.deadline = now() + TURN_MS;
      log(t, t.seats[i].name + ' sagt Trumpf ' + f.name);
      bump(t);
      return { ok: true };
    }

    if (h.phase === 'spiel') {
      var s = t.seats[i];
      var k = int(op.karte);
      if (!(k >= 0 && k < s.h.cards.length)) return { error: 'Diese Karte hast du nicht', code: 400 };
      var karte = s.h.cards.splice(k, 1)[0];
      h.stich.push({ platz: i, card: karte });
      log(t, s.name + ' legt ' + kartenName(karte));

      if (h.stich.length >= 4) return wStichFertig(t);
      h.turn = naechsterPlatz(t, i, function (x) { return !!x; });
      h.deadline = now() + TURN_MS;
      bump(t);
      return { ok: true };
    }
    return { error: 'Gerade ist nichts zu tun', code: 409 };
  }

  function kartenName(c) {
    var k = kritisch(c);
    var farbe = W_FARBEN.filter(function (f) { return f.s === c.s; })[0];
    var rang = W_RANG.filter(function (r) { return r.r === c.r; })[0];
    var name = (farbe ? farbe.name : c.s) + '-' + (rang ? rang.name : c.r);
    return k >= 0 ? name + ' (' + W_KRITISCH[k].name + ')' : name;
  }

  function wStichFertig(t) {
    var h = t.hand;
    var sieger = wStich(h.stich, h);
    h.gewonnen[team(sieger)]++;
    h.letzterStich = { karten: h.stich.slice(), sieger: sieger };
    log(t, t.seats[sieger].name + ' holt den Stich (' +
        h.gewonnen[0] + ':' + h.gewonnen[1] + ')');
    h.stich = [];
    h.stichNr++;

    if (h.gewonnen[0] >= 3 || h.gewonnen[1] >= 3) {
      return wEnde(t, h.gewonnen[0] >= 3 ? 0 : 1);
    }
    h.turn = sieger;
    h.anspiel = sieger;
    h.deadline = now() + TURN_MS;
    bump(t);
    return { ok: true };
  }

  /* ── Gehen: den Wert der Hand erhoehen ── */

  function wGehen(t, i) {
    var h = t.hand;
    if (h.phase !== 'spiel') return { error: 'Erst wird angesagt', code: 409 };
    if (h.antwortVon !== undefined && h.antwortVon !== null) {
      return { error: 'Es steht schon eine Erhöhung offen', code: 409 };
    }
    if (h.gehenVon === team(i)) return { error: 'Ihr habt zuletzt erhöht', code: 409 };

    h.gehenVon = team(i);
    h.geboten = h.punkte + 1;
    /* Antworten darf die Gegenmannschaft; gefragt wird der Naechste von
       ihnen in der Reihenfolge. */
    h.antwortVon = naechsterPlatz(t, i, function (s, k) { return s && team(k) !== team(i); });
    h.deadline = now() + TURN_MS;
    log(t, t.seats[i].name + ' geht auf ' + h.geboten);
    bump(t);
    return { ok: true };
  }

  function wAntwort(t, i, was) {
    var h = t.hand;
    if (h.antwortVon === undefined || h.antwortVon === null) {
      return { error: 'Es steht keine Erhöhung offen', code: 409 };
    }
    if (h.antwortVon !== i) return { error: 'Du bist nicht gefragt', code: 409 };

    if (was === 'dabei') {
      h.punkte = h.geboten;
      h.antwortVon = null;
      h.deadline = now() + TURN_MS;
      log(t, t.seats[i].name + ' ist dabei — es geht um ' + h.punkte);
      bump(t);
      return { ok: true };
    }
    /* "Aus": die Mannschaft steigt aus und zahlt den bisherigen Wert. */
    log(t, t.seats[i].name + ' geht aus — ' + h.punkte + ' für die Gegenseite');
    return wEnde(t, h.gehenVon, true);
  }

  /* ── Abrechnen ── */

  function wEnde(t, siegerTeam, aufgegeben) {
    var h = t.hand;
    var betrag = h.punkte * t.bb;

    /* Erst einsammeln, was die Verlierer wirklich haben, dann verteilen —
       so kann nie mehr ausgezahlt werden, als am Tisch liegt. */
    var topf = 0;
    t.seats.forEach(function (s, i) {
      if (!s || team(i) === siegerTeam) return;
      var b = Math.min(betrag, s.stack);
      s.stack -= b;
      topf += b;
    });
    var gewinner = [];
    t.seats.forEach(function (s, i) { if (s && team(i) === siegerTeam) gewinner.push(i); });
    var anteil = gewinner.length ? Math.floor(topf / gewinner.length) : 0;
    var rest = topf - anteil * gewinner.length;
    var gewinne = {};
    gewinner.forEach(function (i, n) {
      var g = anteil + (n < rest ? 1 : 0);
      t.seats[i].stack += g;
      gewinne[i] = g;
    });

    t.punkte = t.punkte || [0, 0];
    t.punkte[siegerTeam] += h.punkte;

    h.ergebnis = {
      team: siegerTeam,
      punkte: h.punkte,
      aufgegeben: !!aufgegeben,
      gewinne: gewinne,
      stand: t.punkte.slice(),
      /* Am Ende darf jeder sehen, was die anderen hatten. */
      haende: t.seats.map(function (s) { return s ? s.h.cards.slice() : null; })
    };
    h.phase = 'ende';
    h.turn = -1;
    h.deadline = 0;
    h.ende = now() + BREAK_MS;

    log(t, 'Mannschaft ' + (siegerTeam + 1) + ' gewinnt die Hand (' + h.punkte +
        ') — Stand ' + t.punkte[0] + ':' + t.punkte[1]);

    if (t.punkte[siegerTeam] >= W_ZIEL) {
      log(t, 'Partie gewonnen! Der Stand beginnt von vorn.');
      t.punkte = [0, 0];
    }
    deps.save();
    bump(t);
    return { ok: true };
  }

  function wattenTimeout(t) {
    var h = t.hand;
    if (!h || h.ende) return;

    if (h.antwortVon !== undefined && h.antwortVon !== null) {
      // keine Antwort heisst mitgehen — sonst koennte man durch Wegsehen gewinnen
      return wAntwort(t, h.antwortVon, 'dabei');
    }
    var i = h.turn;
    var s = t.seats[i];
    if (!s) {
      /* Platz leer — die Hand kann nicht weiterlaufen. Ohne diesen Abbruch
         blieb die Frist in der Vergangenheit stehen und der Tisch haengte. */
      t.hand = null;
      t.naechste = 0;
      log(t, 'Hand abgebrochen — es fehlt ein Spieler');
      bump(t);
      return;
    }
    if (h.phase === 'schlag') {
      return wattenAction(t, s.id, { action: 'schlag', schlag: GK_pick(W_RANG).r });
    }
    if (h.phase === 'trumpf') {
      return wattenAction(t, s.id, { action: 'trumpf', trumpf: GK_pick(W_FARBEN).s });
    }
    if (h.phase === 'spiel') {
      return wattenAction(t, s.id, { action: 'karte', karte: 0 });
    }
  }

  function GK_pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /**
   * Watten-Bot. Er sagt an, was er selbst am haeufigsten hat, sticht wenn er
   * kann und wirft sonst die niedrigste Karte weg. Auf eine Erhoehung geht er
   * mit, wenn sein Blatt etwas hergibt.
   */
  function wattenBotZug(t, jetzt) {
    var h = t.hand;
    if (!h || h.ende) return false;

    var i = (h.antwortVon !== undefined && h.antwortVon !== null) ? h.antwortVon : h.turn;
    var s = t.seats[i];
    if (!s || !s.bot) return false;
    if (!s.denktBis) { s.denktBis = jetzt + 800 + Math.random() * 1200; return false; }
    if (jetzt < s.denktBis) return false;
    s.denktBis = 0;

    if (h.antwortVon !== undefined && h.antwortVon !== null && h.antwortVon === i) {
      var stark = s.h.cards.filter(function (c) {
        return kritisch(c) >= 0 || c.r === h.schlag || c.s === h.trumpf;
      }).length;
      wattenAction(t, s.id, { action: stark >= 2 ? 'dabei' : 'aus' });
      return true;
    }

    if (h.phase === 'schlag') {
      var proRang = {};
      s.h.cards.forEach(function (c) { proRang[c.r] = (proRang[c.r] || 0) + 1; });
      var bester = s.h.cards[0].r, best = 0;
      Object.keys(proRang).forEach(function (r) {
        var w = proRang[r] * 10 + (W_RANG.filter(function (x) { return x.r === r; })[0] || { v: 0 }).v;
        if (w > best) { best = w; bester = r; }
      });
      wattenAction(t, s.id, { action: 'schlag', schlag: bester });
      return true;
    }

    if (h.phase === 'trumpf') {
      var proFarbe = {};
      s.h.cards.forEach(function (c) { proFarbe[c.s] = (proFarbe[c.s] || 0) + 1; });
      var beste = s.h.cards[0].s, b2 = 0;
      Object.keys(proFarbe).forEach(function (f) {
        if (proFarbe[f] > b2) { b2 = proFarbe[f]; beste = f; }
      });
      wattenAction(t, s.id, { action: 'trumpf', trumpf: beste });
      return true;
    }

    if (h.phase === 'spiel') {
      var karten = s.h.cards;
      var wahl = 0;
      if (!h.stich.length) {
        // anspielen: die staerkste Karte vorn
        var maxW = -1;
        karten.forEach(function (c, k) {
          var w = wWert(c, h) || c.v;
          if (w > maxW) { maxW = w; wahl = k; }
        });
      } else {
        // koennte ich den Stich holen? Dann mit der billigsten passenden Karte
        var fuehrend = wStich(h.stich, h);
        var fuehrKarte = h.stich.filter(function (x) { return x.platz === fuehrend; })[0].card;
        var farbe = h.stich[0].card.s;
        var fuehrW = wWert(fuehrKarte, h) || (fuehrKarte.s === farbe ? fuehrKarte.v : 0);
        var billigste = -1, billigW = Infinity, schwaechste = 0, schwachW = Infinity;
        karten.forEach(function (c, k) {
          var w = wWert(c, h) || (c.s === farbe ? c.v : 0);
          if (w > fuehrW && w < billigW) { billigW = w; billigste = k; }
          if (w < schwachW) { schwachW = w; schwaechste = k; }
        });
        var partner = team(fuehrend) === team(i);
        wahl = (partner || billigste < 0) ? schwaechste : billigste;
      }
      wattenAction(t, s.id, { action: 'karte', karte: wahl });
      return true;
    }
    return false;
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
        if (t.game === 'watten') {
          /* Beim Watten haelt jeder seine Karten selbst — im Sitz steht nur,
             wieviele noch da sind. Am Ende der Hand darf man alles sehen. */
          var fertig = h && h.ergebnis && h.ergebnis.haende;
          if (eigen && s.h) karten = s.h.cards;
          else if (fertig) karten = h.ergebnis.haende[i];
        } else if (s.h && s.h.cards) {
          if (eigen) karten = s.h.cards;
          else if (zeigen && !s.h.folded) karten = s.h.cards;
        }
        return {
          platz: i, id: s.id, name: s.name, avatar: s.avatar,
          bot: !!s.bot,
          stufe: s.bot ? stufeVon(s).name : null,
          stack: s.stack, buyIn: s.buyIn,
          online: isOnline(s.id),
          bet: s.h ? s.h.bet : 0,
          gesamt: s.h ? s.h.gesamt || 0 : 0,
          tag: s.h ? s.h.tag || '' : '',
          /* Sitzt am Tisch, spielt diese Hand aber nicht mit — entweder
             gerade erst dazugekommen oder ohne Chips. */
          dabei: !!(s.h && s.h.cards),
          folded: s.h ? !!s.h.folded : false,
          allIn: s.h ? !!s.h.allIn : false,
          cards: karten,
          anzahl: s.h && s.h.cards ? s.h.cards.length : 0,
          team: i % 2,
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
    if (t.game === 'watten') {
      var mein = seatOf(t, viewer);
      return {
        nr: h.nr, phase: h.phase,
        schlag: h.schlag, trumpf: h.trumpf,
        vorhand: h.vorhand, anspiel: h.anspiel,
        stich: h.stich, stichNr: h.stichNr,
        letzterStich: h.letzterStich || null,
        gewonnen: h.gewonnen,
        punkte: h.punkte, geboten: h.geboten || 0,
        gehenVon: h.gehenVon, antwortVon: h.antwortVon === undefined ? null : h.antwortVon,
        meineKarten: mein >= 0 && t.seats[mein] && t.seats[mein].h ? t.seats[mein].h.cards : [],
        meinTeam: mein >= 0 ? mein % 2 : -1,
        turn: h.turn, deadline: h.deadline, ende: h.ende,
        ergebnis: h.ergebnis,
        stand: t.punkte || [0, 0]
      };
    }
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
      var menschen = leute.filter(function (s) { return !s.bot; });
      if (g) {
        g.tische++;
        g.spieler += menschen.length;
        menschen.forEach(function (s) { if (g.namen.length < 12) g.namen.push(s.name); });
      }
      liste.push({
        id: t.id, game: t.game, name: t.name,
        sb: t.sb, bb: t.bb, minBuy: t.minBuy, maxBuy: t.maxBuy,
        plaetze: t.seats.length,
        besetzt: leute.length,
        laeuft: !!t.hand,
        spieler: leute.map(function (s) {
          return { name: s.name, avatar: s.avatar, stack: s.stack,
                   bot: !!s.bot, online: isOnline(s.id) };
        })
      });
    });
    liste.sort(function (a, b) { return b.besetzt - a.besetzt || a.name.localeCompare(b.name); });

    var wach = [];
    online.forEach(function (o, id) {
      if (now() - o.at < ONLINE_MS) wach.push({ id: id, name: o.name, avatar: o.avatar });
    });

    var partyListe = [];
    partys.forEach(function (pa) {
      partyListe.push({
        id: pa.id, name: pa.name, status: pa.status,
        startChips: pa.startChips, dauer: pa.dauer,
        spiele: pa.spiele.length, max: P_MAX, nachschub: pa.nachschub || 0,
        eigeneChips: !!pa.eigeneChips,
        besetzt: pa.spieler.length,
        spieler: pa.spieler.map(function (s) {
          return { name: s.name, avatar: s.avatar, online: isOnline(s.id) };
        })
      });
    });
    partyListe.sort(function (a, b) { return b.besetzt - a.besetzt || a.name.localeCompare(b.name); });

    var meiner = tableOf(viewer);
    var meineParty = partyOf(viewer);
    return {
      spiele: Object.keys(proSpiel).map(function (g) { return proSpiel[g]; }),
      tische: liste,
      partys: partyListe,
      online: wach,
      meinTisch: meiner ? meiner.id : null,
      meineParty: meineParty ? meineParty.id : null,
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
        /* Auch was gerade im Pot liegt, gehoert dem Spieler zurueck — die
           Hand wird ja nie zu Ende gespielt. */
        var zurueck = s.stack + (s.h && s.h.gesamt ? s.h.gesamt : 0);
        var p = deps.players()[s.id];
        if (p) { p.balance += zurueck; p.returned += zurueck; summe += zurueck; }
        s.stack = 0;
      });
    });
    tables.clear();
    offeneStapel();          // Spiegel leeren, sonst gaebe es beim Start doppelt
    deps.save();
    return summe;
  }

  /**
   * Spiegel der offenen Stapel in der Datenbank.
   *
   * Die Tische leben nur im Speicher. Beim geordneten Herunterfahren bucht
   * shutdown() alles zurueck — bei einem harten Abbruch (Absturz, SIGKILL,
   * Stromausfall) kommt der aber nie dran, und die Chips waeren weg. Deshalb
   * steht neben jedem Konto, was gerade auf einem Tisch liegt. Beim naechsten
   * Start holt sich der Server das zurueck (siehe erholen()).
   */
  function offeneStapel() {
    var db = deps.db && deps.db();
    if (!db) return;
    var offen = {};
    tables.forEach(function (t) {
      t.seats.forEach(function (s) {
        if (!s || s.bot) return;
        var betrag = s.stack + (s.h && s.h.gesamt ? s.h.gesamt : 0);
        if (betrag > 0) offen[s.id] = (offen[s.id] || 0) + betrag;
      });
    });
    db.mpStacks = offen;
  }

  /**
   * Nach einem harten Abbruch: was beim letzten Mal noch auf Tischen lag,
   * kommt zurueck aufs Konto. Die Tische selbst sind ohnehin weg.
   */
  function erholen() {
    var db = deps.db && deps.db();
    if (!db || !db.mpStacks) return 0;
    var summe = 0;
    Object.keys(db.mpStacks).forEach(function (id) {
      var betrag = Math.floor(db.mpStacks[id]) || 0;
      var p = deps.players()[id];
      if (p && betrag > 0) { p.balance += betrag; p.returned += betrag; summe += betrag; }
    });
    db.mpStacks = {};
    if (summe) deps.save();
    return summe;
  }

  return {
    GAMES: GAMES,
    erholen: erholen,
    /* Die Watten-Rangfolge ist die kniffligste Regel im Haus. Sie steht hier
       offen, damit sie sich einzeln pruefen laesst, ohne eine ganze Partie
       durchspielen zu muessen. Reine Funktionen, kein Zustand. */
    wattenRegeln: { wert: wWert, stich: wStich, kritisch: kritisch, name: kartenName },
    shutdown: shutdown,
    touch: touch,
    lobby: lobby,
    aufloesen: aufloesen,
    wait: wait,
    seq: function () { return seq; },
    create: createTable,
    join: join,
    leave: leave,
    action: action,
    tableOf: tableOf,
    view: function (id, viewer) {
      var pa = partys.get(String(id || ''));
      if (pa) return sichtParty(pa, viewer);
      var t = tables.get(String(id || ''));
      if (!t) return null;
      return sichtTisch(t, viewer);
    }
  };
}

module.exports = createMP;
