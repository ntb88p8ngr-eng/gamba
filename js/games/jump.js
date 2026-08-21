/* ═══════════ 20. ENDLOS-SPRUNG ═══════════
   Von Plattform zu Plattform immer weiter nach oben.

   Der Held springt von allein, gelenkt wird nur nach links und rechts. Je
   höher er kommt, desto mehr zahlt jede Stufe — und desto weiter liegen die
   Plattformen auseinander, desto mehr Fledermäuse hängen in der Luft. Ein
   Feuerball räumt sie weg; wer sie berührt, verliert den Einsatz.

   Wie beim Flatterflug gilt: aussteigen kann man jederzeit, und nach oben ist
   die Leiter gedeckelt — ohne Ende wäre der Multiplikator eine Chip-Quelle.

   Die Bilder kommen aus assets/jump und werden von tools/build-jump.py aus
   den Vorlagen geschnitten.
   ═══════════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* ── Bilder ────────────────────────────────────────────────────────── */
  var PFAD = 'assets/jump/';
  var BILD = {};
  var geladen = false;
  function bilderLaden() {
    if (geladen) return;
    geladen = true;
    var namen = ['himmel', 'feder', 'platte-1', 'platte-2', 'platte-3',
                 'wolke-1', 'wolke-2', 'wolke-3',
                 'feuerball-1', 'feuerball-2', 'feuerball-lila'];
    for (var i = 1; i <= 8; i++) { namen.push('held-' + i); namen.push('maus-' + i); }
    for (var z = 1; z <= 6; z++) namen.push('held-zu-' + z);
    namen.forEach(function (n) {
      var b = new Image();
      b.src = PFAD + n + '.webp';
      BILD[n] = b;
    });
  }
  function da(n) { var b = BILD[n]; return b && b.complete && b.naturalWidth ? b : null; }

  /* ── Welt ──────────────────────────────────────────────────────────── */
  var W = 480, H = 640;
  var HELD_B = 62, HELD_H = 70;         // gezeichnete Größe
  var HELD_R = 22;                      // Trefferkreis, gnädiger als das Bild
  var SCHWERKRAFT = 1750;
  var ABSPRUNG = -740;                  // Absprung von einer Plattform
  var FEDER_ABSPRUNG = -1180;           // von der Sprungfeder
  var LAUF = 330;                       // waagerechtes Tempo
  var PLATTE_B = 96, PLATTE_H = 24;
  var SCHUSS_V = 660, SCHUSS_PAUSE = 320;
  /* Ab dieser Stufe spucken die Fledermäuse lila Feuerbälle. Vorher hängen
     sie nur im Weg — das reicht für die ersten Stufen. */
  var SPUCK_AB = 6, SPUCK_V = 330;

  /* Eine Stufe ist so hoch. Alle STUFE_H Bildpunkte steigt der Multiplikator. */
  var STUFE_H = 340;
  /* Der Zuwachs je Stufe — klein anfangen, dann steiler. Genau wie beim
     Flatterflug soll sich ein früher Ausstieg kaum lohnen. */
  var ZUWACHS_START = 0.03, ZUWACHS_STUFE = 0.022, ZUWACHS_MAX = 0.6;
  function zuwachs(nr) {
    return Math.min(ZUWACHS_MAX, ZUWACHS_START + ZUWACHS_STUFE * (nr - 1));
  }
  function multNach(n) {
    var m = 1;
    for (var i = 1; i <= n; i++) m *= 1 + zuwachs(i);
    return m;
  }
  var ZIEL = 25;                        // danach zahlt der Lauf von selbst aus

  /* Schwierigkeit: mit jeder Stufe liegen die Plattformen weiter auseinander,
     bröckeln öfter und es hängen mehr Fledermäuse in der Luft. Der Absprung
     trägt gut 155 px — der größte Abstand bleibt darunter, sonst wäre eine
     Stelle unpassierbar. */
  function abstand(stufe) { return Math.min(138, 82 + 2.6 * stufe); }
  function broeckelAnteil(stufe) { return Math.min(0.42, 0.04 + 0.022 * stufe); }
  /* So lange hält eine angeknackste Plattform noch, bevor sie zerfällt. */
  var BROECKEL_WARTEN = 1.0;
  function wanderAnteil(stufe) { return Math.min(0.40, 0.05 + 0.02 * stufe); }
  function mausDichte(stufe) { return Math.min(0.55, Math.max(0, (stufe - 1) * 0.05)); }

  GK.registerGame({
    id: 'jump',
    name: 'Endlos-Sprung',
    emoji: '🦘',
    icon: 'held',
    blurb: 'Von Plattform zu Plattform immer höher. Jede Stufe zahlt mehr — und die Fledermäuse werden mehr.',
    badge: 'BIS ' + Math.round(multNach(ZIEL)) + '×',
    color: '#8ce34a',
    minLevel: 35,
    rules: [
      'Der Held springt von allein. Gelenkt wird nur nach links und rechts: am Rechner mit <b>A</b> und <b>D</b> (auch mit den Pfeiltasten), am Handy mit den beiden Knöpfen unter dem Feld.',
      'Am Rand geht es auf der anderen Seite weiter — wie es sich für einen Endlos-Sprung gehört.',
      '<b>Klicken oder tippen</b> schießt einen Feuerball in die Richtung des Zeigers. Er räumt Fledermäuse weg.',
      'Eine <b>Fledermaus zu berühren kostet den Einsatz</b> — außer du landest von oben auf ihr, dann platzt sie und du springst weiter.',
      'Alle <b>' + STUFE_H + ' Höhenmeter</b> steigt der Multiplikator. Die erste Stufe bringt <b>+3 %</b>, die zehnte <b>+23 %</b>, ab der 27. sind es <b>+60 %</b>.',
      'Mit <b>AUSSTEIGEN</b> sicherst du dir jederzeit Einsatz × Multiplikator. Nach <b>' + ZIEL + ' Stufen</b> ist der Himmel erreicht und es wird von selbst ausgezahlt.',
      'Ab <b>Stufe ' + SPUCK_AB + '</b> spucken die Fledermäuse lila Feuerbälle — auch die kosten den Einsatz.',
      'Rote Sprungfedern schleudern dich mehr als doppelt so hoch. Bröckelnde Plattformen tragen genau einen Absprung.',
      'Fällst du unten aus dem Bild, ist der Einsatz weg. Wer mitten im Lauf in die Lobby geht, bekommt den Stand von diesem Moment ausgezahlt.'
    ],
    mount: function (root) {
      bilderLaden();

      var stopped = false, laeuft = false, tot = false, sperreBis = 0;
      var raf = null, letzteZeit = 0, zeitAb = 0;

      var stake = 0, mult = 1, stufe = 0;
      var held = { x: W / 2, y: H - 160, vx: 0, vy: 0, blick: 1, schussAn: 0 };
      var kamera = 0;                    // Weltkoordinate der oberen Bildkante
      var hoehe = 0;                     // geschaffte Höhe in Bildpunkten
      var platten = [], maeuse = [], baelle = [], teilchen = [], schrift = [], wolken = [];
      var links = false, rechts = false, letzterSchuss = 0;

      var bet = GK.betPanel({ start: 25 });
      var resultBox = GK.resultBox();

      var canvas = el('canvas', { class: 'jp-canvas', width: String(W), height: String(H) });
      var buehne = el('div', { class: 'jp-screen' }, [canvas]);
      var ctx = canvas.getContext('2d');

      /* Die beiden Richtungsknöpfe stehen nur auf dem Handy da — am Rechner
         nehmen A und D ihren Platz ein (siehe .jp-tasten in games.css). */
      var linksBtn = el('button', { class: 'jp-taste', text: '◀', 'aria-label': 'nach links' });
      var rechtsBtn = el('button', { class: 'jp-taste', text: '▶', 'aria-label': 'nach rechts' });
      /* Die Knöpfe liegen halbdurchsichtig auf dem Spielfeld: unter dem Feld
         schoben sie auf kleinen Schirmen entweder sich selbst oder das Feld
         aus dem Bild. */
      var tastenReihe = el('div', { class: 'jp-tasten' }, [linksBtn, rechtsBtn]);

      var multBadge = el('div', { class: 'mult-badge center', text: '1.00×' });
      var infoZeile = el('div', { class: 'jp-info', text: 'Noch am Boden' });

      var startBtn = el('button', { class: 'btn btn-gold btn-full', text: '🦘 LOSSPRINGEN' });
      var cashBtn = el('button', { class: 'btn btn-lime btn-full', text: '💰 AUSSTEIGEN' });
      cashBtn.disabled = true;

      var autoFeld = el('input', { class: 'input', type: 'number', min: '1', max: String(ZIEL), step: '1', value: '8' });
      var autoKnopf = el('button', { class: 'chip-btn', text: '🤖 AUTO AUS' });
      var autoAn = false;
      autoKnopf.addEventListener('click', function () {
        autoAn = !autoAn;
        autoKnopf.textContent = autoAn ? '🤖 AUTO AN' : '🤖 AUTO AUS';
        autoKnopf.style.borderColor = autoAn ? 'var(--lime)' : '';
        GK.sfx('chip');
      });

      var stage = el('div', { class: 'stage split' }, [
        el('div', {}, [
          buehne,
          el('div', { style: 'height:8px' }),
          infoZeile
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'bet-label', text: 'AUTOMATISCH AUSSTEIGEN NACH STUFE' }),
          el('div', { style: 'height:6px' }),
          el('div', { class: 'bet-row' }, [autoFeld, autoKnopf]),
          el('div', { style: 'height:12px' }),
          multBadge,
          el('div', { style: 'height:10px' }),
          resultBox,
          el('div', { style: 'height:12px' }),
          startBtn,
          el('div', { style: 'height:8px' }),
          cashBtn,
          el('div', { style: 'height:12px' }),
          el('p', { class: 'hint', html: '💡 <b>A</b>/<b>D</b> bewegen, <b>Klick</b> schießt — am Handy die Knöpfe unter dem Feld und ein Tipp aufs Feld. Ein Tipp startet auch den Lauf.' })
        ])
      ]);
      buehne.appendChild(tastenReihe);
      root.appendChild(stage);

      function skalieren() {
        var dpr = Math.min(2.5, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      skalieren();
      window.addEventListener('resize', skalieren);

      /* ── Welt aufbauen ────────────────────────────────────────────── */

      function neuePlatte(y, erzwingeFest) {
        var st = stufe;
        var art = 'fest';
        if (!erzwingeFest) {
          var w = Math.random();
          if (w < broeckelAnteil(st)) art = 'broeckel';
          else if (w < broeckelAnteil(st) + wanderAnteil(st)) art = 'wander';
        }
        /* Die Sprungfeder ist selten und sitzt nie auf einer bröckelnden
           Plattform — sonst wäre sie im Moment des Absprungs schon weg. */
        var feder = art !== 'broeckel' && Math.random() < 0.09;
        return {
          x: 20 + Math.random() * (W - PLATTE_B - 40),
          y: y, art: art, feder: feder, weg: false, bruch: 0,
          vx: art === 'wander' ? (Math.random() < 0.5 ? -1 : 1) * (44 + Math.random() * 46) : 0
        };
      }

      function neueMaus(y) {
        return {
          x: 40 + Math.random() * (W - 120), y: y,
          vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 70 + stufe * 3),
          tot: 0, phase: Math.random() * 6,
          /* Der erste Spuck kommt frühestens nach dieser Zeit — sonst
             begrüßt eine frisch erschienene Maus den Helden sofort. */
          ladung: 2.2 + Math.random() * 2.6, spuckt: 0
        };
      }

      function weltAufbauen() {
        platten = []; maeuse = []; baelle = []; teilchen = []; schrift = []; wolken = [];
        kamera = 0;
        /* Die unterste Plattform liegt fest unter dem Helden — der erste
           Sprung soll nicht vom Zufall abhängen. */
        platten.push({ x: W / 2 - PLATTE_B / 2, y: H - 90, art: 'fest', feder: false, weg: false, bruch: 0, vx: 0 });
        var y = H - 90;
        while (y > -H) {
          y -= abstand(0) + Math.random() * 26;
          var p = neuePlatte(y, y > H - 300);
          /* Die ersten Plattformen stehen dicht über der Mitte: die ersten
             drei Sprünge sollen von selbst gelingen. Wer gleich am Anfang
             danebengreift, bleibt sonst unten hängen und kommt nie in die
             Höhe, wo es überhaupt etwas zu verdienen gibt. */
          if (y > H - 400) p.x = W / 2 - PLATTE_B / 2 + (Math.random() - 0.5) * 90;
          platten.push(p);
        }
        for (var i = 0; i < 6; i++) {
          wolken.push({ x: Math.random() * W, y: -i * 220 + 200, art: 1 + (i % 3), gr: 0.5 + Math.random() * 0.5 });
        }
      }

      /** Nachschub erzeugen, sobald die Kamera nach oben wandert. */
      function nachfuellen() {
        var oberste = platten.length ? platten[platten.length - 1].y : kamera;
        while (oberste > kamera - H * 0.6) {
          oberste -= abstand(stufe) + Math.random() * 30;
          platten.push(neuePlatte(oberste));
          if (Math.random() < mausDichte(stufe)) maeuse.push(neueMaus(oberste - 60 - Math.random() * 80));
        }
        while (wolken.length && wolken[0].y > kamera + H + 200) wolken.shift();
        var hoechste = wolken.length ? wolken[wolken.length - 1].y : kamera;
        while (hoechste > kamera - 200) {
          hoechste -= 180 + Math.random() * 160;
          wolken.push({ x: Math.random() * W, y: hoechste, art: 1 + Math.floor(Math.random() * 3), gr: 0.5 + Math.random() * 0.5 });
        }
        /* Alles, was unten aus dem Bild gefallen ist, kann weg. */
        platten = platten.filter(function (p) { return p.y < kamera + H + 80; });
        maeuse = maeuse.filter(function (m) { return m.y < kamera + H + 80; });
      }

      /* ── Zeichnen ─────────────────────────────────────────────────── */

      function plattenBild(p) {
        if (p.art !== 'broeckel') return da('platte-1');
        /* Rissig, solange sie noch trägt — zerbrochen erst, wenn sie
           tatsächlich zerfällt. */
        return da(p.bruch > 0.02 ? 'platte-3' : 'platte-2');
      }

      function zeichnen() {
        ctx.clearRect(0, 0, W, H);

        // Himmel: senkrecht gekachelt, zieht langsamer als die Welt
        var him = da('himmel');
        if (him) {
          var hh = W * (him.height / him.width);
          var versatz = ((-kamera * 0.35) % hh + hh) % hh;
          for (var y = versatz - hh; y < H; y += hh) ctx.drawImage(him, 0, y, W, hh);
        } else {
          var g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, '#6fd0ff'); g.addColorStop(1, '#bff0ff');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }

        // Wolken als Zwischenschicht
        wolken.forEach(function (w) {
          var b = da('wolke-' + w.art);
          if (!b) return;
          var br = 150 * w.gr, ho = br * (b.height / b.width);
          ctx.globalAlpha = 0.75;
          ctx.drawImage(b, w.x, w.y - kamera * 0.6, br, ho);
          ctx.globalAlpha = 1;
        });

        // Plattformen
        platten.forEach(function (p) {
          if (p.weg) return;
          var y = p.y - kamera;
          if (y < -60 || y > H + 60) return;
          var b = plattenBild(p);
          if (b) {
            var ho = PLATTE_B * (b.height / b.width);
            ctx.save();
            if (p.bruch) { ctx.globalAlpha = Math.max(0, 1 - p.bruch); ctx.translate(0, p.bruch * 60); }
            ctx.drawImage(b, p.x, y - ho * 0.18, PLATTE_B, ho);
            ctx.restore();
          } else {
            ctx.fillStyle = p.art === 'broeckel' ? '#b08968' : '#7cc36a';
            ctx.fillRect(p.x, y, PLATTE_B, PLATTE_H);
          }
          if (p.feder && !p.bruch) {
            var f = da('feder');
            if (f) {
              var fb = 42, fh = fb * (f.height / f.width);
              ctx.drawImage(f, p.x + PLATTE_B / 2 - fb / 2, y - fh + 14, fb, fh);
            }
          }
        });

        // Fledermäuse
        maeuse.forEach(function (m) {
          var y = m.y - kamera;
          if (y < -80 || y > H + 80) return;
          var bild = m.tot ? da('maus-8')
            : (m.spuckt > 0.18 ? da('maus-6')
              : (m.spuckt > 0 ? da('maus-7')
                : da('maus-' + (2 + Math.floor((zeitAb * 6 + m.phase) % 4)))));
          var br = 74, ho = br * (bild ? bild.height / bild.width : 0.7);
          ctx.save();
          ctx.globalAlpha = m.tot ? Math.max(0, 1 - m.tot) : 1;
          ctx.translate(m.x + br / 2, y + ho / 2 + (m.tot ? m.tot * 90 : 0));
          if (m.vx > 0) ctx.scale(-1, 1);
          if (bild) ctx.drawImage(bild, -br / 2, -ho / 2, br, ho);
          else { ctx.fillStyle = '#8b3bff'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill(); }
          ctx.restore();
        });

        // Feuerbälle — die blauen sind vom Helden, der lila von einer Maus
        baelle.forEach(function (b) {
          var bild = da(b.boese ? 'feuerball-lila' : ('feuerball-' + b.art));
          var y = b.y - kamera;
          ctx.save();
          ctx.translate(b.x, y);
          ctx.rotate(Math.atan2(b.vy, b.vx));
          var bb = b.boese ? 56 : 52;
          if (bild) ctx.drawImage(bild, -bb / 2, -bb * 0.33, bb, bb * 0.66);
          else {
            ctx.fillStyle = b.boese ? '#e05bff' : '#3bd6ff';
            ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
          }
          ctx.restore();
        });

        // Teilchen (Funken beim Treffer)
        teilchen.forEach(function (t) {
          ctx.globalAlpha = Math.max(0, t.leben);
          ctx.fillStyle = t.farbe;
          ctx.beginPath();
          ctx.arc(t.x, t.y - kamera, t.gr, 0, 7);
          ctx.fill();
          ctx.globalAlpha = 1;
        });

        // Held
        /* Beim Schuss und im Steigflug der offene Mund, sonst die ruhigen
           Bilder mit geschlossenem Mund — der Held soll nicht dauerhaft
           dreinschauen wie im Schreck. */
        var hb;
        if (tot) hb = da('held-8');
        else if (held.schussAn > 0) hb = da('held-7');
        else if (held.vy < -60) hb = da('held-3');
        else if (held.vy > 260) hb = da('held-zu-3') || da('held-4');
        else hb = da('held-zu-' + (1 + Math.floor((zeitAb * 4) % 2)));
        ctx.save();
        ctx.translate(held.x, held.y - kamera);
        if (held.blick < 0) ctx.scale(-1, 1);
        if (hb) ctx.drawImage(hb, -HELD_B / 2, -HELD_H / 2, HELD_B, HELD_H);
        else { ctx.fillStyle = '#8ce34a'; ctx.beginPath(); ctx.arc(0, 0, HELD_R, 0, 7); ctx.fill(); }
        ctx.restore();

        // Zahlen über dem Helden
        schrift.forEach(function (s) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, s.leben);
          ctx.font = 'bold 26px Bungee, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(0,0,0,.55)';
          ctx.strokeText(s.text, s.x, s.y - kamera);
          ctx.fillStyle = s.farbe;
          ctx.fillText(s.text, s.x, s.y - kamera);
          ctx.restore();
        });

        // Anzeige
        ctx.save();
        ctx.font = 'bold 34px Bungee, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 7;
        ctx.strokeStyle = 'rgba(0,0,0,.5)';
        ctx.fillStyle = '#fff';
        ctx.strokeText(GK.fmtX(mult), W / 2, 50);
        ctx.fillText(GK.fmtX(mult), W / 2, 50);
        ctx.font = 'bold 18px Bungee, system-ui, sans-serif';
        var zeile = 'STUFE ' + stufe + ' / ' + ZIEL + ' · ' + Math.round(hoehe) + ' M';
        ctx.strokeText(zeile, W / 2, 78);
        ctx.fillStyle = '#ffd12e';
        ctx.fillText(zeile, W / 2, 78);
        ctx.restore();

        if (!laeuft) {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,.42)';
          ctx.fillRect(0, H / 2 - 52, W, 104);
          ctx.font = 'bold 24px Bungee, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.fillText(tot ? 'ABGESTÜRZT' : 'TIPPEN ZUM STARTEN', W / 2, H / 2 - 8);
          ctx.font = 'bold 15px system-ui, sans-serif';
          ctx.fillStyle = '#ffd12e';
          ctx.fillText(tot ? 'Tippen oder Leertaste für den nächsten Lauf'
                           : 'A/D bewegen · Klick schießt · Leertaste startet', W / 2, H / 2 + 22);
          ctx.restore();
        }
      }

      /* ── Wirkung ──────────────────────────────────────────────────── */

      function funken(x, y, farbe) {
        for (var i = 0; i < 10; i++) {
          teilchen.push({
            x: x, y: y, gr: 3 + Math.random() * 5, farbe: farbe,
            vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320, leben: 1
          });
        }
        if (teilchen.length > 90) teilchen.splice(0, teilchen.length - 90);
      }

      function zahlZeigen(text, farbe) {
        schrift.push({ text: text, farbe: farbe || '#7cff3b', x: held.x, y: held.y - 40, leben: 1 });
        if (schrift.length > 5) schrift.shift();
      }

      function stufeGeschafft() {
        stufe++;
        var p = zuwachs(stufe);
        mult *= 1 + p;
        zahlZeigen('+' + (Math.round(p * 1000) / 10).toString().replace('.', ',') + ' %');
        GK.sfx('coin');
        infoZeile.textContent = 'Stufe ' + stufe + ' · ' + GK.fmtX(mult) +
          ' · nächste bringt +' + (Math.round(zuwachs(stufe + 1) * 1000) / 10).toString().replace('.', ',') + ' %';
        sync();
        if (stufe >= ZIEL) { aussteigen(true); return; }
        if (autoAn) {
          var ziel = Math.max(1, Math.min(ZIEL, Math.floor(Number(autoFeld.value) || 0)));
          if (stufe >= ziel) aussteigen(false, true);
        }
      }

      function schiessen(zielX, zielY) {
        if (!laeuft || stopped) return;
        var jetzt = performance.now();
        if (jetzt - letzterSchuss < SCHUSS_PAUSE) return;
        letzterSchuss = jetzt;
        var dx = zielX - held.x, dy = (zielY + kamera) - held.y;
        var len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        baelle.push({ x: held.x, y: held.y - 6, vx: dx / len * SCHUSS_V, vy: dy / len * SCHUSS_V,
                      leben: 1.6, art: 1 + (baelle.length % 2), boese: false });
        held.blick = dx < 0 ? -1 : 1;
        held.schussAn = 0.22;
        GK.sfx('whoosh');
      }

      /* ── Ablauf ───────────────────────────────────────────────────── */

      function sync() {
        startBtn.disabled = laeuft;
        cashBtn.disabled = !laeuft;
        bet.disable(laeuft);
        multBadge.textContent = GK.fmtX(mult);
        cashBtn.textContent = laeuft
          ? '💰 AUSSTEIGEN (' + GK.fmt(Math.floor(stake * mult)) + ')'
          : '💰 AUSSTEIGEN';
      }

      function start() {
        if (laeuft || stopped) return;
        if (performance.now() < sperreBis) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Endlos-Sprung')) return;
        /* Der Einsatz gilt zunächst als verloren — Rückfallebene, falls der
           Browser mitten im Lauf zugeht. Wer selbst in die Lobby geht, bekommt
           beim Aufräumen den aktuellen Stand ausgezahlt. */
        GK.commitResult(0, stake);

        laeuft = true; tot = false;
        mult = 1; stufe = 0; hoehe = 0;
        held.x = W / 2; held.y = H - 160; held.vx = 0; held.vy = ABSPRUNG * 0.6;
        held.blick = 1; held.schussAn = 0;
        weltAufbauen();
        GK.setResult(resultBox, 'Rauf mit dir — aussteigen geht jederzeit!', '');
        infoZeile.textContent = 'Der Lauf läuft. Stufe 0.';
        GK.sfx('whoosh');
        sync();
        letzteZeit = 0;
        if (!raf) raf = requestAnimationFrame(schleife);
      }

      function aussteigen(amZiel, auto) {
        if (!laeuft || stopped) return;
        laeuft = false;
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        GK.logPlay('Endlos-Sprung', stake, win);
        GK.setResult(resultBox,
          (amZiel ? '☁️ Der Himmel ist erreicht! ' : (auto ? '🤖 Automatisch ausgestiegen: ' : 'Ausgestiegen auf Stufe ')) +
          stufe + ' · ' + GK.fmtX(mult) + ' → ' + GK.fmtSigned(win - stake), 'win');
        infoZeile.textContent = amZiel
          ? 'Alle ' + ZIEL + ' Stufen geschafft — höher geht es nicht.'
          : 'Rechtzeitig abgesprungen.';
        GK.celebrate(win - stake, mult);
        if (amZiel) GK.emojiRain(['☁️', '⭐', '🎉'], 26);
        sync();
      }

      function absturz(woran) {
        if (!laeuft || stopped) return;
        laeuft = false; tot = true;
        sperreBis = performance.now() + 900;
        funken(held.x, held.y, '#ffd12e');
        GK.payout(0, { stake: stake });
        GK.logPlay('Endlos-Sprung', stake, 0);
        GK.setResult(resultBox,
          woran + ' auf Stufe ' + stufe + ' — ' + GK.fmt(stake) + ' Chips weg', 'lose');
        infoZeile.textContent = stufe > 0
          ? 'Bei ' + GK.fmtX(mult) + ' wäre der Ausstieg noch möglich gewesen.'
          : 'Keine einzige Stufe geschafft.';
        GK.sfx('boom');
        GK.shake(buehne);
        sync();
      }

      /* ── Schritt ──────────────────────────────────────────────────── */

      function schritt(dt) {
        zeitAb += dt;
        if (held.schussAn > 0) held.schussAn -= dt;

        if (laeuft) {
          // Seitwärts
          var ziel = (links ? -1 : 0) + (rechts ? 1 : 0);
          held.vx = ziel * LAUF;
          if (ziel) held.blick = ziel;
          held.x += held.vx * dt;
          if (held.x < -HELD_B / 2) held.x = W + HELD_B / 2;
          if (held.x > W + HELD_B / 2) held.x = -HELD_B / 2;

          // Fallen und Springen
          held.vy += SCHWERKRAFT * dt;
          held.y += held.vy * dt;

          // Plattformen bewegen und Landung prüfen
          platten.forEach(function (p) {
            if (p.vx) {
              p.x += p.vx * dt;
              if (p.x < 8) { p.x = 8; p.vx = -p.vx; }
              if (p.x > W - PLATTE_B - 8) { p.x = W - PLATTE_B - 8; p.vx = -p.vx; }
            }
            /* Bröckeln mit Verzögerung: erst steht die Plattform noch eine
               Sekunde, dann bricht sie weg. Sofort zu zerfallen sah aus, als
               wäre der Absprung schuld — und man konnte den Sprung nicht mehr
               ansetzen, weil der Boden schon im Fallen war. */
            if (p.bruch) {
              p.warten = (p.warten || 0) + dt;
              if (p.warten > BROECKEL_WARTEN) {
                p.bruch += dt * 1.6;
                if (p.bruch > 1.4) p.weg = true;
              }
            }
            if (p.weg || held.vy <= 0) return;
            var fuesse = held.y + HELD_R;
            var vorher = fuesse - held.vy * dt;
            /* Landung nur, wenn die Füße in diesem Schritt die Oberkante
               überquert haben — sonst hakt der Held an einer Kante fest,
               durch die er eigentlich schon durch ist. */
            if (vorher <= p.y + 6 && fuesse >= p.y - 2 &&
                held.x > p.x - 12 && held.x < p.x + PLATTE_B + 12) {
              held.y = p.y - HELD_R;
              if (p.feder) {
                held.vy = FEDER_ABSPRUNG;
                funken(p.x + PLATTE_B / 2, p.y, '#ff4d6d');
                GK.sfx('jackpot');
              } else {
                held.vy = ABSPRUNG;
                GK.sfx('plop');
              }
              if (p.art === 'broeckel' && !p.bruch) { p.bruch = 0.01; p.warten = 0; }
            }
          });

          // Kamera: der Held bleibt im oberen Drittel
          var grenze = kamera + H * 0.42;
          if (held.y < grenze) {
            var d = grenze - held.y;
            kamera -= d;
            hoehe += d;
            var neueStufe = Math.floor(hoehe / STUFE_H);
            while (stufe < neueStufe && laeuft) stufeGeschafft();
          }
          nachfuellen();

          // Fledermäuse
          maeuse.forEach(function (m) {
            if (m.tot) { m.tot += dt * 1.4; return; }
            m.x += m.vx * dt;
            if (m.x < 10) { m.x = 10; m.vx = -m.vx; }
            if (m.x > W - 84) { m.x = W - 84; m.vx = -m.vx; }

            /* Spucken: erst kurz aufladen (sichtbar am Bild), dann fliegt der
               lila Ball los. Nur was gerade im Bild hängt, schießt auch —
               ein Treffer aus dem Nichts wäre unfair. */
            if (m.spuckt > 0) {
              m.spuckt -= dt;
              if (m.spuckt <= 0.18 && !m.ab) {
                m.ab = true;
                var zx = held.x - (m.x + 37), zy = held.y - (m.y + 26);
                var wl = Math.max(1, Math.sqrt(zx * zx + zy * zy));
                baelle.push({ x: m.x + 37, y: m.y + 26, vx: zx / wl * SPUCK_V, vy: zy / wl * SPUCK_V,
                              leben: 2.4, art: 1, boese: true });
                GK.sfx('whoosh');
              }
            } else if (stufe >= SPUCK_AB) {
              var sichtbar = m.y > kamera - 40 && m.y < kamera + H - 20;
              m.ladung -= sichtbar ? dt : 0;
              if (m.ladung <= 0) { m.spuckt = 0.5; m.ab = false; m.ladung = 2.6 + Math.random() * 2.6; }
            }
            var dx = (m.x + 37) - held.x, dy = (m.y + 26) - held.y;
            if (dx * dx + dy * dy < (HELD_R + 26) * (HELD_R + 26)) {
              /* Von oben draufspringen ist erlaubt — das ist die Belohnung
                 dafür, den Sprung genau zu setzen. */
              if (held.vy > 0 && held.y < m.y + 10) {
                m.tot = 0.01;
                held.vy = ABSPRUNG;
                funken(m.x + 37, m.y + 26, '#c06bff');
                zahlZeigen('PENG!', '#ffd12e');
                GK.sfx('boom');
              } else {
                absturz('Von einer Fledermaus erwischt');
              }
            }
          });
          maeuse = maeuse.filter(function (m) { return m.tot < 1.4; });

          // Feuerbälle
          baelle.forEach(function (b) {
            b.x += b.vx * dt; b.y += b.vy * dt; b.leben -= dt;
            if (b.boese) {
              var hx = held.x - b.x, hy = held.y - b.y;
              if (hx * hx + hy * hy < (HELD_R + 14) * (HELD_R + 14)) {
                b.leben = 0;
                absturz('Von einem Feuerball getroffen');
              }
              return;
            }
            maeuse.forEach(function (m) {
              if (m.tot) return;
              var dx = (m.x + 37) - b.x, dy = (m.y + 26) - b.y;
              if (dx * dx + dy * dy < 34 * 34) {
                m.tot = 0.01; b.leben = 0;
                funken(m.x + 37, m.y + 26, '#3bd6ff');
                GK.sfx('boom');
              }
            });
          });
          baelle = baelle.filter(function (b) {
            return b.leben > 0 && b.x > -40 && b.x < W + 40 && b.y > kamera - 80 && b.y < kamera + H + 80;
          });

          // Unten aus dem Bild
          if (held.y - kamera > H + 40) absturz('Nach unten durchgefallen');
        } else if (tot) {
          held.vy += SCHWERKRAFT * dt;
          held.y += held.vy * dt;
        }

        teilchen.forEach(function (t) {
          t.x += t.vx * dt; t.y += t.vy * dt; t.vy += 420 * dt; t.leben -= dt * 1.1;
        });
        teilchen = teilchen.filter(function (t) { return t.leben > 0; });
        schrift.forEach(function (s) { s.y -= 46 * dt; s.leben -= dt * 0.9; });
        schrift = schrift.filter(function (s) { return s.leben > 0; });
      }

      function schleife(jetzt) {
        if (stopped) return;
        var dt = letzteZeit ? Math.min(0.05, (jetzt - letzteZeit) / 1000) : 0.016;
        letzteZeit = jetzt;
        schritt(dt);
        zeichnen();
        raf = requestAnimationFrame(schleife);
      }

      /* ── Bedienung ────────────────────────────────────────────────── */

      /* Ein Tipp aufs Feld startet den Lauf; danach schießt jeder Tipp einen
         Feuerball dorthin, wo der Finger war. */
      buehne.addEventListener('pointerdown', function (ev) {
        /* Die Richtungsknöpfe liegen im Spielfeld — ein Tipp auf sie ist
           gemeint als "lauf nach links", nicht als "schieß dorthin". Ohne
           diese Zeile feuerte jeder Schritt einen Feuerball ab. */
        if (ev.target.closest && ev.target.closest('.jp-tasten')) return;
        ev.preventDefault();
        if (!laeuft) { if (!startBtn.disabled) start(); return; }
        var r = canvas.getBoundingClientRect();
        schiessen((ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H);
      });

      function halten(knopf, setzen) {
        /* pointerdown/up statt click: der Knopf soll gedrückt bleiben, solange
           der Finger liegt. pointercancel und pointerleave gehören dazu, sonst
           läuft der Held weiter, wenn der Finger vom Knopf rutscht. */
        knopf.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          e.stopPropagation();          // nicht bis zum Spielfeld durchreichen
          setzen(true);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
          knopf.addEventListener(n, function () { setzen(false); });
        });
      }
      halten(linksBtn, function (an) { links = an; });
      halten(rechtsBtn, function (an) { rechts = an; });

      function taste(ev, ab) {
        var z = document.activeElement;
        if (z && /input|textarea|select/i.test(z.tagName)) return;
        var k = ev.code;
        if (k === 'KeyA' || k === 'ArrowLeft') { links = ab; ev.preventDefault(); }
        else if (k === 'KeyD' || k === 'ArrowRight') { rechts = ab; ev.preventDefault(); }
        else if (ab && (k === 'Space' || ev.key === ' ')) {
          ev.preventDefault();
          if (!laeuft && !startBtn.disabled) start();
          else if (laeuft) schiessen(held.x + held.blick * 60, held.y - kamera - 200);
        }
      }
      function runter(ev) { taste(ev, true); }
      function hoch(ev) { taste(ev, false); }
      window.addEventListener('keydown', runter);
      window.addEventListener('keyup', hoch);

      startBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('cash'); aussteigen(false); });

      weltAufbauen();
      sync();
      raf = requestAnimationFrame(schleife);

      return function () {
        /* Wer mitten im Lauf in die Lobby geht, bekommt den Stand von jetzt —
           genau wie beim Flatterflug und bei der Rakete. */
        if (laeuft && !stopped) {
          var win = Math.floor(stake * mult);
          laeuft = false;
          GK.payout(win, { stake: stake });
          GK.logPlay('Endlos-Sprung', stake, win);
          GK.toast('Lauf beendet auf Stufe ' + stufe + ' — ' + GK.fmt(win) + ' Chips gesichert',
                   'gold', '🦘');
        }
        stopped = true;
        laeuft = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', skalieren);
        window.removeEventListener('keydown', runter);
        window.removeEventListener('keyup', hoch);
      };
    }
  });
})(window.GK);
