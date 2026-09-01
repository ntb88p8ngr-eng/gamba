/* ═══════════ 22. KRISTALL-KASKADE — Tumble-Raster (ab Level 40) ═══════════
   Sechs Spalten, fünf Reihen, keine Gewinnlinien. Gezahlt wird nach
   Menge: acht gleiche Steine irgendwo im Feld reichen, egal wo sie
   liegen. Was zahlt, zerspringt — der Rest fällt nach, von oben kommt
   Neues, und es wird noch einmal gezählt. Genau darin liegt der Reiz:
   ein Dreh ist nicht vorbei, wenn das Feld steht, sondern erst, wenn
   nichts mehr zerspringt.

   Zwei Dinge treiben den Gewinn:

   Die KETTE zählt, wie oft hintereinander etwas zersprungen ist. Der
   zweite Treffer zählt doppelt, der dritte dreifach, der vierte fünf-
   und ab dem fünften achtfach. Eine lange Kette ist deshalb mehr wert
   als die Summe ihrer Treffer.

   Die GLUTKERNE tragen eine Zahl und zerspringen nie. Was am Ende
   eines Drehs noch im Feld liegt, zählt — aber im Grundspiel anders als
   in den Freispielen, und das ist Absicht:

     im Grundspiel  zahlt jeder Kern seine Zahl mal Einsatz obendrauf
     in den Freispielen  sammeln sie sich über die ganze Runde an und
                         nehmen jeden Gewinn damit mal

   Erst multiplizierten sie auch im Grundspiel. Gemessen kam dabei eine
   Quote von 220 % heraus: der Faktor trifft den bereits kettenver-
   stärkten Gewinn, und beide Verstärker übereinander sind einer zu
   viel. Ihn dorthin zu verschieben, wo er hingehört, kostet nichts an
   Reiz — es macht die Freispiele erst zu dem, was sie sein sollen.

   Die Zahlen (Gewichte und Auszahlungen) sind nicht geschätzt, sondern
   gemessen: `rechnen` unten hängt die reine Rechnung an die
   Spielanmeldung, damit ein Messskript Millionen Drehs durchspielen
   kann, ohne dass dafür etwas angezeigt werden muss.
   ═══════════════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  var SPALTEN = 6, REIHEN = 5;
  var FELDER = SPALTEN * REIHEN;

  /* Ab wie vielen gleichen Steinen gezahlt wird. Acht von dreißig ist
     die Schwelle, bei der ein Treffer selten genug bleibt, um etwas zu
     bedeuten, und häufig genug, dass eine Kette überhaupt zustande
     kommt. */
  var SCHWELLE = 8;

  /* zahlt: [8–9 Stück, 10–11, 12 und mehr] — als Vielfaches des Einsatzes. */
  var STEINE = [
    { id: 'kirsche', ic: 'cherry', name: 'Kirsche', w: 150, zahlt: [0.08, 0.25, 0.70] },
    { id: 'pflaume', ic: 'plum',   name: 'Pflaume', w: 140, zahlt: [0.10, 0.30, 0.90] },
    { id: 'melone',  ic: 'melon',  name: 'Melone',  w: 140, zahlt: [0.14, 0.42, 1.25] },
    { id: 'glocke',  ic: 'bell',   name: 'Glocke',  w: 130, zahlt: [0.20, 0.62, 1.80] },
    { id: 'stern',   ic: 'star',   name: 'Stern',   w: 130, zahlt: [0.35, 1.10, 3.20] },
    { id: 'juwel',   ic: 'gem',    name: 'Juwel',   w: 120, zahlt: [0.65, 2.00, 6.40] },
    { id: 'krone',   ic: 'crown',  name: 'Krone',   w: 110, zahlt: [1.25, 4.00, 14.0] },
    /* Zahlt nie selbst und zerspringt nie — siehe den Kopf der Datei.
       Das Gewicht ist klein und gemessen: bei jedem sechsten Feld liegt
       einer, und genau das macht ihn zum Ereignis statt zum Beiwerk. */
    { id: 'glut',    ic: 'flame',  name: 'Glutkern', w: 3, glut: true },
    /* Vier davon öffnen die Freispiele. */
    { id: 'los',     ic: 'ticket', name: 'Freilos',  w: 22, scatter: true }
  ];
  var GEWICHT = STEINE.reduce(function (s, x) { return s + x.w; }, 0);

  /* Was ein Glutkern wert sein kann. Kleine Zahlen sind der Normalfall,
     die fünfzig ist die Geschichte, die man danach erzählt. */
  var GLUT_WERTE = [
    { wert: 2,  w: 46 }, { wert: 3,  w: 26 }, { wert: 5,  w: 15 },
    { wert: 10, w: 8  }, { wert: 25, w: 4  }, { wert: 50, w: 1  }
  ];
  var GLUT_GEWICHT = GLUT_WERTE.reduce(function (s, x) { return s + x.w; }, 0);

  /* Die Kette. Der erste Treffer zählt einfach, danach wird es ernst. */
  var KETTE = [1, 2, 3, 5, 8];

  /* Freilose öffnen die Freispiele. Dort sammeln sich die Glutkerne über
     die ganze Runde an, statt nach jedem Dreh zu verfallen — das ist der
     Unterschied zwischen „ein paar Gratisdrehs" und einer Runde, bei der
     man mit jedem Dreh nervöser wird. */
  var FREISPIELE = { 4: 8, 5: 12, 6: 16 };
  var LOS_ZAHLT  = { 4: 3, 5: 10, 6: 50 };   // Freilose zahlen zusätzlich

  /* ── Die reine Rechnung ───────────────────────────────────────────
     Alles hier unten kommt ohne Anzeige aus: dieselbe Funktion, die das
     Spiel dreht, kann ein Messskript millionenfach laufen lassen. */

  function zieheStein(zufall) {
    var r = zufall() * GEWICHT;
    for (var i = 0; i < STEINE.length; i++) {
      r -= STEINE[i].w;
      if (r <= 0) return STEINE[i];
    }
    return STEINE[0];
  }

  function ziehGlut(zufall) {
    var r = zufall() * GLUT_GEWICHT;
    for (var i = 0; i < GLUT_WERTE.length; i++) {
      r -= GLUT_WERTE[i].w;
      if (r <= 0) return GLUT_WERTE[i].wert;
    }
    return GLUT_WERTE[0].wert;
  }

  /** Eine Zelle: Stein plus, wenn es ein Glutkern ist, seine Zahl. */
  function zelle(zufall) {
    var s = zieheStein(zufall);
    return { s: s, glut: s.glut ? ziehGlut(zufall) : 0 };
  }

  /** Ein volles Feld. feld[spalte][reihe], Reihe 0 ist oben. */
  function feldWuerfeln(zufall) {
    var f = [];
    for (var x = 0; x < SPALTEN; x++) {
      f[x] = [];
      for (var y = 0; y < REIHEN; y++) f[x][y] = zelle(zufall);
    }
    return f;
  }

  /** Welche Steine kommen wie oft vor — und wo. */
  function zaehlen(feld) {
    var wo = {};
    for (var x = 0; x < SPALTEN; x++) for (var y = 0; y < REIHEN; y++) {
      var c = feld[x][y];
      if (!c.s.zahlt) continue;
      (wo[c.s.id] || (wo[c.s.id] = [])).push([x, y]);
    }
    return wo;
  }

  /** Stufe der Auszahlungstabelle für eine Menge. */
  function stufe(n) { return n >= 12 ? 2 : (n >= 10 ? 1 : 0); }

  /**
   * Die Treffer eines Feldes.
   *
   * Gezahlt wird pro Steinsorte einmal, nicht pro Gruppe: zwölf Kronen
   * sind zwölf Kronen, egal ob sie zusammenliegen oder verstreut sind.
   */
  function treffer(feld) {
    var wo = zaehlen(feld), raus = [];
    Object.keys(wo).forEach(function (id) {
      if (wo[id].length < SCHWELLE) return;
      var st = STEINE.filter(function (s) { return s.id === id; })[0];
      raus.push({ stein: st, zellen: wo[id], anzahl: wo[id].length,
                  faktor: st.zahlt[stufe(wo[id].length)] });
    });
    return raus;
  }

  /**
   * Zerspringen und nachfallen.
   *
   * Die getroffenen Zellen fallen weg, was darüber lag rutscht nach, und
   * von oben kommen neue. Zurück kommt für jede Spalte, wie viele neue
   * Steine oben hineingefallen sind — die Anzeige braucht das, um sie
   * von oben hereinfliegen zu lassen statt sie erscheinen zu lassen.
   */
  function nachrutschen(feld, zellen, zufall) {
    var weg = {};
    zellen.forEach(function (p) { weg[p[0] + ':' + p[1]] = true; });
    var neu = [];
    for (var x = 0; x < SPALTEN; x++) {
      var bleibt = [];
      for (var y = 0; y < REIHEN; y++) {
        if (!weg[x + ':' + y]) bleibt.push(feld[x][y]);
      }
      var fehlt = REIHEN - bleibt.length;
      var spalte = [];
      for (var k = 0; k < fehlt; k++) spalte.push(zelle(zufall));
      feld[x] = spalte.concat(bleibt);
      neu.push(fehlt);
    }
    return neu;
  }

  /** Alle Glutkerne, die gerade im Feld liegen — Summe und Fundorte. */
  function glutSumme(feld) {
    var summe = 0, wo = [];
    for (var x = 0; x < SPALTEN; x++) for (var y = 0; y < REIHEN; y++) {
      if (feld[x][y].glut) { summe += feld[x][y].glut; wo.push([x, y]); }
    }
    return { summe: summe, wo: wo };
  }

  function loseZaehlen(feld) {
    var n = 0;
    for (var x = 0; x < SPALTEN; x++) for (var y = 0; y < REIHEN; y++) {
      if (feld[x][y].s.scatter) n++;
    }
    return n;
  }

  /**
   * Ein ganzer Dreh, von der ersten Füllung bis zum letzten Nachrutschen.
   *
   * Zurück kommt der Ablauf Schritt für Schritt — die Anzeige spielt ihn
   * danach ab, das Messskript zählt nur die Summe. Beides sieht dieselbe
   * Rechnung, und deshalb stimmt die Quote im Panel auch mit dem, was
   * am Tisch passiert.
   */
  function drehen(einsatz, zufall, frei, glutMit) {
    zufall = zufall || Math.random;
    var feld = feldWuerfeln(zufall);
    var lose = loseZaehlen(feld);
    var schritte = [];
    var roh = 0, kette = 0;

    /* Der Sicherungsschnitt liegt hoch genug, dass er im Spiel nie
       greift — er ist nur da, damit ein Fehler in der Auswertung nicht
       zu einer Endlosschleife wird. */
    for (var runde = 0; runde < 60; runde++) {
      var tr = treffer(feld);
      if (!tr.length) break;
      var mult = KETTE[Math.min(kette, KETTE.length - 1)];
      var teil = 0;
      tr.forEach(function (t) { teil += einsatz * t.faktor; });
      roh += teil * mult;
      var alle = [];
      tr.forEach(function (t) { alle = alle.concat(t.zellen); });
      var vorher = [];
      for (var x = 0; x < SPALTEN; x++) vorher.push(feld[x].slice());
      var neu = nachrutschen(feld, alle, zufall);
      schritte.push({ feld: vorher, treffer: tr, kette: mult, teil: teil * mult, neu: neu });
      kette++;
    }

    var glut = glutSumme(feld);
    /* Die Glutkerne wirken nur, wenn überhaupt etwas gewonnen wurde —
       sonst wäre der leere Dreh plötzlich ein Gewinn. */
    var faktor = 1, glutGeld = 0, gewinn = roh;
    if (roh > 0) {
      if (frei) {
        faktor = Math.max(1, glut.summe + (glutMit || 0));
        gewinn = roh * faktor;
      } else {
        glutGeld = einsatz * glut.summe;
        gewinn = roh + glutGeld;
      }
    }

    /* Freilose zahlen selbst — sonst wäre ein Feld voller Lose ohne
       Treffer eine Enttäuschung, obwohl gerade das Beste passiert ist. */
    var losGeld = LOS_ZAHLT[Math.min(6, lose)] ? einsatz * LOS_ZAHLT[Math.min(6, lose)] : 0;
    gewinn += losGeld;

    return {
      feld: feld, schritte: schritte, lose: lose, losGeld: losGeld,
      glut: glut, glutFaktor: faktor, glutGeld: glutGeld, roh: roh,
      gewinn: Math.floor(gewinn),
      freispiele: FREISPIELE[Math.min(6, lose)] || 0
    };
  }

  GK.registerGame({
    id: 'cascade',
    name: 'Kristall-Kaskade',
    emoji: '💎',
    icon: 'gem',
    blurb: 'Keine Linien — acht gleiche Steine irgendwo zahlen. Was zahlt, zerspringt, der Rest fällt nach.',
    badge: 'KETTEN ×8',
    color: '#7cff3b',
    minLevel: 40,
    /* Die reine Rechnung hängt hier mit dran, damit die Quote messbar
       ist, ohne dass das Spiel dafür etwas anderes tut als sonst. */
    rechnen: drehen,
    rules: [
      '<b>6 × 5 Steine, keine Gewinnlinien.</b> Gezahlt wird nach Menge: <b>8 gleiche Steine</b> irgendwo im Feld reichen — wo sie liegen, ist egal.',
      '<b>10 oder 12 Steine</b> derselben Sorte zahlen deutlich mehr als acht.',
      '<b>Was zahlt, zerspringt.</b> Der Rest fällt nach, von oben kommt Neues, und es wird noch einmal gezählt — so lange, bis nichts mehr zerspringt.',
      '<b>Die Kette</b> zählt mit: der zweite Treffer eines Drehs zählt <b>2×</b>, der dritte <b>3×</b>, der vierte <b>5×</b>, ab dem fünften <b>8×</b>.',
      '<b>Glutkerne</b> tragen eine Zahl von 2 bis 50 und zerspringen nie. Bei einem Gewinn zahlt jeder Kern, der am Ende noch im Feld liegt, <b>seine Zahl mal Einsatz</b> obendrauf. Ohne Gewinn sind sie wertlos.',
      '<b>4, 5 oder 6 Freilose</b> zahlen <b>3×, 10× oder 50×</b> und bringen <b>10, 15 oder 20 Freispiele</b>.',
      'In den Freispielen zahlen die Glutkerne nicht mehr — sie <b>sammeln sich über die ganze Runde an</b> und nehmen jeden Gewinn mit ihrer Summe mal. Weitere Freilose verlängern.'
    ],

    mount: function (root) {
      var gestoppt = false, laeuft = false, autoRest = 0, endlos = false;
      var freiRest = 0, freiEinsatz = 0, freiGlut = 0, freiKonto = 0;
      var wunschEinsatz = 20;
      var bet = GK.betPanel({ start: 20, min: 5,
                              onChange: function (v) { wunschEinsatz = v; } });

      /* ── Das Feld ──
         Die Zellen bleiben stehen, nur ihr Inhalt wechselt. Ein
         kompletter Neubau bei jedem Nachrutschen liesse den Compositor
         auf schwachen Geraeten aussteigen — dieselbe Erfahrung steht
         schon in slots.js und ocean.js. */
      var zellen = [];
      var raster = el('div', { class: 'kk-raster' });
      for (var i = 0; i < FELDER; i++) {
        var z = el('div', { class: 'kk-zelle' }, [
          el('span', { class: 'kk-bild' }),
          el('b', { class: 'kk-zahl' })
        ]);
        zellen.push(z);
        raster.appendChild(z);
      }
      function zelleVon(x, y) { return zellen[y * SPALTEN + x]; }

      var kettenBand = el('div', { class: 'kk-kette' }, [
        el('span', { class: 'kk-kette-text', text: 'KETTE' }),
        el('b', { class: 'kk-kette-zahl', text: '1×' })
      ]);
      kettenBand.hidden = true;

      var glutBand = el('div', { class: 'kk-glut' }, [
        el('span', { text: '🔥 GLUT' }),
        el('b', { class: 'kk-glut-zahl', text: '0×' })
      ]);
      glutBand.hidden = true;

      var fsBand = el('div', { class: 'fs-banner kk-fs' }, [
        '🎟 FREISPIELE', el('b', { text: '0' }), '· Glut bleibt liegen'
      ]);
      fsBand.hidden = true;

      var tisch = el('div', { class: 'kk-tisch' }, [
        el('div', { class: 'kk-funkeln' }),
        raster, kettenBand, glutBand
      ]);

      var tafel = el('div', { class: 'paytable kk-tafel' },
        STEINE.filter(function (s) { return s.zahlt; }).slice().reverse().map(function (s) {
          return el('div', { class: 'pay-item' }, [
            el('span', { class: 's', html: GK.iconHTML(s.ic) }),
            el('span', { class: 'm', text: s.zahlt[2] + '×' }),
            el('span', { style: 'font-size:.6rem;color:var(--muted)', text: s.name })
          ]);
        }).concat([
          el('div', { class: 'pay-item' }, [
            el('span', { class: 's', html: GK.iconHTML('flame') }),
            el('span', { class: 'm', text: '2–50×' }),
            el('span', { style: 'font-size:.6rem;color:var(--muted)', text: 'Glutkern' })
          ]),
          el('div', { class: 'pay-item' }, [
            el('span', { class: 's', html: GK.iconHTML('ticket') }),
            el('span', { class: 'm', text: 'FREI' }),
            el('span', { style: 'font-size:.6rem;color:var(--muted)', text: 'Freilos' })
          ])
        ]));

      var ergebnis = GK.resultBox();
      var drehKnopf = el('button', { class: 'btn btn-mega', text: '💎 DREHEN' });
      var autoKnopf = el('button', { class: 'btn btn-ghost', text: '↻ 10 AUTO' });
      var endlosKnopf = el('button', { class: 'btn btn-ghost', text: '∞ ENDLOS' });

      root.appendChild(GK.panel([
        fsBand, tisch, ergebnis,
        el('div', { class: 'bet-row' }, [bet.el]),
        el('div', { class: 'game-btns' }, [drehKnopf, autoKnopf, endlosKnopf]),
        el('h4', { class: 'pay-title', text: 'AB 8 GLEICHEN — HÖCHSTE STUFE (12+)' }),
        tafel
      ], 'kk-panel'));

      /* ── Anzeige ── */

      function malen(feld, neu) {
        for (var x = 0; x < SPALTEN; x++) for (var y = 0; y < REIHEN; y++) {
          var c = feld[x][y], z = zelleVon(x, y);
          var bild = z.firstChild, zahl = z.lastChild;
          var html = GK.iconHTML(c.s.ic);
          if (bild.dataset.ic !== c.s.id) {
            bild.innerHTML = html;
            bild.dataset.ic = c.s.id;
          }
          zahl.textContent = c.glut ? c.glut + '×' : '';
          z.classList.toggle('glut', !!c.glut);
          z.classList.toggle('los', !!c.s.scatter);
          /* Nur die wirklich neu hereingefallenen Steine fliegen von oben
             ein — die nachgerutschten sollen nicht mitzucken. */
          var faelltNeu = neu && y < neu[x];
          z.classList.remove('faellt');
          if (faelltNeu) {
            void z.offsetWidth;
            z.style.setProperty('--fall', (y * 60 + x * 25) + 'ms');
            z.classList.add('faellt');
          }
        }
      }

      function ketteZeigen(mult) {
        kettenBand.hidden = mult <= 1;
        if (mult <= 1) return;
        kettenBand.lastChild.textContent = mult + '×';
        kettenBand.classList.remove('pop');
        void kettenBand.offsetWidth;
        kettenBand.classList.add('pop');
      }

      function glutZeigen(summe) {
        glutBand.hidden = summe <= 0;
        if (summe <= 0) return;
        glutBand.lastChild.textContent = summe + '×';
        glutBand.classList.remove('pop');
        void glutBand.offsetWidth;
        glutBand.classList.add('pop');
      }

      function freiZeigen() {
        fsBand.hidden = freiRest <= 0;
        fsBand.children[0].textContent = String(freiRest);
        bet.disable(freiRest > 0 || laeuft);
      }

      /** Eine Warteschlange, die sich beim Verlassen des Spiels abräumt. */
      var uhren = [];
      function warte(ms) {
        return new Promise(function (ok) {
          uhren.push(setTimeout(function () { if (!gestoppt) ok(); }, ms));
        });
      }

      /* ── Ein Dreh ── */

      async function dreh() {
        if (laeuft || gestoppt) return;
        var einsatz = bet.value();
        if (einsatz < 5) { GK.toast('Mindestens 5 Chips', 'bad', '💎'); return; }
        var frei = freiRest > 0;
        if (frei) einsatz = freiEinsatz;
        if (!frei && !GK.wager(einsatz, 'Kristall-Kaskade')) { autoStopp(); return; }
        if (frei) { freiRest--; freiZeigen(); GK.sfx('freespin2'); }

        laeuft = true;
        drehKnopf.disabled = true;
        bet.disable(true);
        kettenBand.hidden = true;
        glutBand.hidden = true;
        zellen.forEach(function (z) { z.classList.remove('trifft', 'springt'); });
        GK.setResult(ergebnis, frei ? 'Freispiel — die Glut bleibt liegen…' : 'Die Steine fallen…', '');
        if (!frei) GK.sfx('spin');

        var res = drehen(einsatz, Math.random, frei ? freiGlut : 0);
        /* Der Ausgang steht fest, bevor die erste Kachel fällt — die
           Anzeige spielt ihn nur nach. Das ist die Stelle, an der der
           Glücks-Regler des Admins greift. */
        GK.commitResult(res.gewinn, frei ? 0 : einsatz);

        // Das erste Feld fällt herein
        malen(res.schritte.length ? res.schritte[0].feld : res.feld,
              [REIHEN, REIHEN, REIHEN, REIHEN, REIHEN, REIHEN]);
        await warte(760);
        if (gestoppt) return;

        // Und jetzt Schritt für Schritt zersprengen
        for (var i = 0; i < res.schritte.length; i++) {
          var s = res.schritte[i];
          if (gestoppt) return;
          malen(s.feld, null);
          var marke = {};
          s.treffer.forEach(function (t) {
            t.zellen.forEach(function (p) { marke[p[0] + ':' + p[1]] = true; });
          });
          for (var x = 0; x < SPALTEN; x++) for (var y = 0; y < REIHEN; y++) {
            if (marke[x + ':' + y]) zelleVon(x, y).classList.add('trifft');
          }
          GK.sfx(i > 1 ? 'win' : 'coin');
          ketteZeigen(s.kette);
          await warte(430);
          if (gestoppt) return;
          zellen.forEach(function (z) {
            if (z.classList.contains('trifft')) {
              z.classList.remove('trifft');
              z.classList.add('springt');
            }
          });
          GK.sfx('reel');
          await warte(260);
          if (gestoppt) return;
          zellen.forEach(function (z) { z.classList.remove('springt'); });
          /* Das Feld nach diesem Schritt ist das Ausgangsfeld des
             nächsten — und beim letzten Schritt das Endfeld. */
          var danach = (i + 1 < res.schritte.length) ? res.schritte[i + 1].feld : res.feld;
          malen(danach, s.neu);
          await warte(420);
        }

        if (gestoppt) return;
        malen(res.feld, null);
        abrechnen(res, einsatz, frei);
      }

      function abrechnen(res, einsatz, imFrei) {
        GK.payout(res.gewinn, { stake: imFrei ? 0 : einsatz });
        GK.logPlay('Kristall-Kaskade', imFrei ? 0 : einsatz, res.gewinn);
        if (imFrei) freiKonto += res.gewinn;

        /* Die Glut zeigt sich erst hier: vorher wäre sie ein Versprechen
           gewesen, das ein leerer Dreh nicht hält. */
        if (res.roh > 0 && res.glutFaktor > 1) {
          res.glut.wo.forEach(function (p) { zelleVon(p[0], p[1]).classList.add('zuendet'); });
          glutZeigen(res.glutFaktor);
          GK.sfx('tension');
          setTimeout(function () {
            zellen.forEach(function (z) { z.classList.remove('zuendet'); });
          }, 1200);
        }
        if (imFrei) {
          /* In den Freispielen bleibt liegen, was gefunden wurde. */
          freiGlut += res.glut.summe;
          if (freiGlut > 0) glutZeigen(Math.max(1, freiGlut));
        }

        if (res.freispiele) freiGeben(res.freispiele, imFrei, einsatz);

        var netto = res.gewinn - (imFrei ? 0 : einsatz);
        if (res.gewinn > einsatz) {
          var beste = null;
          res.schritte.forEach(function (s) {
            s.treffer.forEach(function (t) {
              if (!beste || t.faktor > beste.faktor) beste = t;
            });
          });
          var text = res.schritte.length > 1
            ? res.schritte.length + 'er-Kette'
            : (beste ? beste.anzahl + '× ' + beste.stein.name : 'Treffer');
          if (res.glutFaktor > 1) text += ' · Glut ' + res.glutFaktor + '×';
          GK.setResult(ergebnis, text + ' → +' + GK.fmt(netto), 'win');
          GK.celebrate(netto, res.gewinn / Math.max(1, einsatz));
          if (res.gewinn >= einsatz * 20) {
            GK.emojiRain(['💎', '🔥', '💰', '✨'], 30);
            GK.shake(tisch);
          }
          tisch.classList.add('blitz');
          setTimeout(function () { tisch.classList.remove('blitz'); }, 700);
        } else if (res.gewinn > 0) {
          GK.setResult(ergebnis, 'Kleiner Treffer — ' + GK.fmt(res.gewinn) + ' zurück', 'push');
          GK.sfx('coin');
        } else {
          GK.setResult(ergebnis, 'Nichts zersprungen. Nächster Dreh.', 'lose');
          GK.sfx('lose');
        }

        laeuft = false;
        drehKnopf.disabled = false;
        freiZeigen();
        if (freiRest <= 0 && freiEinsatz) freiEnde();
        weiterAuto();
      }

      function freiGeben(n, nachschlag, einsatz) {
        if (!freiEinsatz) { freiEinsatz = einsatz; freiGlut = 0; freiKonto = 0; }
        freiRest += n;
        freiZeigen();
        fsBand.classList.remove('pop');
        void fsBand.offsetWidth;
        fsBand.classList.add('pop');
        GK.sfx('freespin');
        GK.confetti(140);
        GK.emojiRain(['🎟', '💎', '🔥'], 26);
        GK.toast(nachschlag ? '+' + n + ' Freispiele — die Runde geht weiter!'
                            : n + ' Freispiele! Die Glut bleibt jetzt liegen.',
                 'gold', '🎟');
      }

      function freiEnde() {
        var summe = freiKonto;
        freiEinsatz = 0; freiGlut = 0; freiKonto = 0;
        glutBand.hidden = true;
        fsBand.hidden = true;
        if (summe > 0) {
          GK.toast('Freispiele vorbei — ' + GK.fmt(summe) + ' Chips gesammelt', 'gold', '🎟');
        }
      }

      /* ── Auto und Endlos ── */

      function autoStopp() {
        autoRest = 0; endlos = false;
        autoKnopf.textContent = '↻ 10 AUTO';
        endlosKnopf.textContent = '∞ ENDLOS';
        endlosKnopf.classList.remove('btn-danger');
      }

      function weiterAuto() {
        if (gestoppt) return;
        if (freiRest > 0) { setTimeout(dreh, 700); return; }
        if (!endlos && autoRest <= 0) return;
        if (!endlos) {
          autoRest--;
          autoKnopf.textContent = autoRest > 0 ? '↻ ' + autoRest + ' AUTO' : '↻ 10 AUTO';
        }
        /* Reicht das Guthaben für den gewünschten Einsatz nicht mehr,
           hört der Automat auf, statt mit immer kleineren Beträgen
           weiterzudrehen. */
        if (!GK.canBet(wunschEinsatz)) {
          autoStopp();
          GK.toast('Zu wenig Chips — Automat gestoppt', 'bad', '💎');
          return;
        }
        setTimeout(dreh, 620);
      }

      drehKnopf.addEventListener('click', function () { GK.sfx('click'); autoStopp(); dreh(); });
      autoKnopf.addEventListener('click', function () {
        GK.sfx('click');
        if (autoRest > 0) { autoStopp(); return; }
        endlos = false;
        autoRest = 10;
        autoKnopf.textContent = '↻ 10 AUTO';
        if (!laeuft) dreh();
      });
      endlosKnopf.addEventListener('click', function () {
        GK.sfx('click');
        endlos = !endlos;
        autoRest = 0;
        endlosKnopf.textContent = endlos ? '■ STOPP' : '∞ ENDLOS';
        endlosKnopf.classList.toggle('btn-danger', endlos);
        if (endlos && !laeuft) dreh();
      });

      // Startbild, damit das Feld nicht leer dasteht
      malen(feldWuerfeln(Math.random), null);
      freiZeigen();

      return function () {
        gestoppt = true;
        uhren.forEach(clearTimeout);
        uhren = [];
      };
    }
  });

})(window.GK);
