/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Texas Hold'em: Karten und Handbewertung

   Dieselbe Datei laeuft im Browser und im Server. Das ist hier keine
   Bequemlichkeit, sondern Pflicht: beim Mehrspieler-Poker teilt der Server
   die Karten aus und entscheidet, wer gewinnt. Wuerde der Browser mit einer
   zweiten, eigenen Bewertung rechnen, koennten beide zu verschiedenen
   Ergebnissen kommen — und der Spieler saehe etwas anderes, als ausgezahlt
   wird.

   Im Browser haengt alles unter GK.holdem, in Node kommt es aus
   require('./js/holdem.js').
   ═══════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.GK) root.GK.holdem = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var SUITS = [
    { s: '♠', red: false }, { s: '♥', red: true },
    { s: '♦', red: true }, { s: '♣', red: false }
  ];
  var RANKS = [
    ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8],
    ['9', 9], ['10', 10], ['J', 11], ['Q', 12], ['K', 13], ['A', 14]
  ];
  var CATS = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße',
              'Flush', 'Full House', 'Vierling', 'Straight Flush'];

  function newDeck() {
    var d = [];
    SUITS.forEach(function (su) {
      RANKS.forEach(function (r) { d.push({ r: r[0], v: r[1], s: su.s, red: su.red }); });
    });
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }

  /* ─────────────── Handbewertung ───────────────
     score5 gibt eine einzige Zahl zurueck: Kategorie mal eine Million plus die
     Beikarten. Damit lassen sich zwei Haende einfach vergleichen. */

  function score5(cards) {
    var vs = [], suits = {}, cnt = {};
    cards.forEach(function (c) {
      vs.push(c.v);
      suits[c.s] = (suits[c.s] || 0) + 1;
      cnt[c.v] = (cnt[c.v] || 0) + 1;
    });
    var flush = Object.keys(suits).length === 1;

    // erst nach Haeufigkeit sortieren, bei Gleichstand nach Hoehe
    var groups = Object.keys(cnt).map(Number).sort(function (a, b) {
      return cnt[b] - cnt[a] || b - a;
    });

    var uniq = groups.slice().sort(function (a, b) { return b - a; });
    var straight = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straight = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straight = 5;   // A-2-3-4-5
    }

    var pattern = groups.map(function (g) { return cnt[g]; }).join('');
    var cat;
    if (straight && flush) cat = 8;
    else if (pattern === '41') cat = 7;
    else if (pattern === '32') cat = 6;
    else if (flush) cat = 5;
    else if (straight) cat = 4;
    else if (pattern === '311') cat = 3;
    else if (pattern === '221') cat = 2;
    else if (pattern === '2111') cat = 1;
    else cat = 0;

    var order = (cat === 4 || cat === 8) ? [straight] : groups;
    var packed = 0, i;
    for (i = 0; i < 5; i++) packed = packed * 15 + (order[i] || 0);
    return cat * 1000000 + packed;
  }

  /** Beste Fuenf aus beliebig vielen Karten (hier fuenf bis sieben). */
  function bestHand(cards) {
    var best = -1, bestFive = null;
    var n = cards.length, idx = [0, 1, 2, 3, 4];
    if (n < 5) return { score: -1, cat: -1, five: [], name: '—' };
    while (true) {
      var five = idx.map(function (i) { return cards[i]; });
      var sc = score5(five);
      if (sc > best) { best = sc; bestFive = five; }
      // naechste Kombination durchzaehlen
      var k = 4;
      while (k >= 0 && idx[k] === n - 5 + k) k--;
      if (k < 0) break;
      idx[k]++;
      for (var j = k + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
    }
    var cat = Math.floor(best / 1000000);
    var name = CATS[cat];
    if (cat === 8 && best % 1000000 >= 14 * 15 * 15 * 15 * 15) name = 'Royal Flush';
    return { score: best, cat: cat, five: bestFive, name: name };
  }

  return {
    SUITS: SUITS, RANKS: RANKS, CATS: CATS,
    newDeck: newDeck, score5: score5, bestHand: bestHand
  };
});
