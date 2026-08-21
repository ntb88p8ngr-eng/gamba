/* ═══════════ 20. FLATTERFLUG ═══════════
   Ein Vogel, zwei Röhren, ein Einsatz.

   Anders als in den Würfelspielen entscheidet hier die Hand: der Vogel fällt,
   ein Tipp lässt ihn steigen, und jede durchflogene Röhre erhöht den
   Multiplikator. Damit das nicht zur Gelddruckmaschine für geübte Daumen
   wird, zieht die Schwierigkeit mit — die Lücke wird enger, das Tempo höher.
   Wer klug ist, steigt aus, bevor die Lücke zu schmal wird.

   Die Bilder kommen aus assets/bird und werden von tools/build-bird.py aus
   der Vorlage geschnitten.
   ═══════════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';
  var el = GK.el;

  /* ── Bilder ──────────────────────────────────────────────────────────
     Einmal geladen, danach von jedem Spielstart wiederverwendet. Fehlt ein
     Bild, zeichnet das Spiel an seiner Stelle einen Ersatz — es soll nicht
     an einer Datei scheitern. */
  var PFAD = 'assets/bird/';
  var BILD = {};
  var geladen = false;
  function bilderLaden() {
    if (geladen) return BILD;
    geladen = true;
    var namen = ['himmel', 'boden', 'rohr-muendung', 'rohr-schaft', 'rohr-moos',
                 'flug-1', 'flug-2', 'flug-3', 'flug-4', 'flug-5', 'flug-6',
                 'sturz-2', 'sturz-4', 'feder-1', 'feder-2', 'feder-3'];
    namen.forEach(function (n) {
      var i = new Image();
      i.src = PFAD + n + '.webp';
      BILD[n] = i;
    });
    return BILD;
  }
  function da(n) { var b = BILD[n]; return b && b.complete && b.naturalWidth ? b : null; }

  /* ── Welt ────────────────────────────────────────────────────────────
     Alles rechnet in dieser festen Größe; die Leinwand wird nur skaliert.
     So fliegt der Vogel auf jedem Bildschirm gleich. */
  var W = 480, H = 640, BODEN = 96;
  var LUFT = H - BODEN;

  var VOGEL_X = 132, VOGEL_R = 21;      // Trefferkreis, kleiner als das Bild
  var SCHWERKRAFT = 1500;               // px/s²
  var FLATTER = -430;                   // px/s beim Tipp
  var ROHR_B = 84;                      // Breite der Mündung
  var ROHR_TREFFER = 76;                // Trefferbreite — etwas gnädiger

  /* Der Zuwachs je Röhre. Klein anfangen und mit jeder Röhre steiler werden:
     die erste bringt 2 %, die zehnte schon 29 %. Der kleine Anfang ist
     Absicht — ein früher Ausstieg soll sich kaum lohnen, sonst wäre das
     Spiel für eine geübte Hand eine Chip-Quelle. Gedeckelt, sonst würde eine
     einzelne Röhre irgendwann den ganzen Gewinn machen. */
  var ZUWACHS_START = 0.02, ZUWACHS_STUFE = 0.03, ZUWACHS_MAX = 0.6;
  function zuwachs(nr) {
    return Math.min(ZUWACHS_MAX, ZUWACHS_START + ZUWACHS_STUFE * (nr - 1));
  }
  function multNach(n) {
    var m = 1;
    for (var i = 1; i <= n; i++) m *= 1 + zuwachs(i);
    return m;
  }
  /* Nach so vielen Röhren ist Schluss — der Flug zahlt von selbst aus. Ohne
     Ende wäre der Multiplikator nach oben offen. */
  var ZIEL = 25;

  /* Schwierigkeit. Beides zieht mit der Zahl der geschafften Röhren an:
     die Lücke wird enger, das Tempo höher, der Abstand kürzer.

     Das Anfangstempo liegt bewusst über dem gemütlichen Bereich: mit 160
     px/s trudelte der Vogel die ersten Röhren so lahm entlang, dass die
     Runde erst nach einer halben Minute interessant wurde. */
  function luecke(n) { return Math.max(110, 205 - 5 * n); }
  /**
   * Tempo der Röhren.
   *
   * Hier hängt der Regler aus "QUOTEN JE SPIEL": er verschiebt das
   * Anfangstempo um bis zu ±20 %. Höher heißt langsamer und damit gnädiger,
   * tiefer heißt schneller. Die Lücke bleibt davon unberührt — sie ist das
   * Maß, an dem der Spieler seine Höhe abliest, und sollte sich nicht
   * heimlich ändern.
   */
  function tempo(n, gluck) {
    var v = Math.min(370, 185 + 6.5 * n);
    return v * (1 - ((gluck - 50) / 50) * 0.2);
  }
  function abstand(n) { return Math.max(196, 272 - 2.4 * n); }

  GK.registerGame({
    id: 'flappy',
    name: 'Flatterflug',
    emoji: '🐦',
    icon: 'vogel',
    blurb: 'Ein Tipp lässt ihn steigen, sonst fällt er. Jede Röhre zahlt mehr — und die Lücke wird enger.',
    badge: 'BIS ' + Math.round(multNach(ZIEL)) + '×',
    color: '#3bc94a',
    minLevel: 30,
    rules: [
      'Setze Chips und starte den Flug. <b>Tippen, klicken oder Leertaste</b> lässt den Vogel flattern — sonst fällt er.',
      'Jede durchflogene Röhre erhöht den Multiplikator. Die erste bringt nur <b>+2 %</b>, danach steigt der Zuwachs mit jeder Röhre: die fünfte bringt <b>+14 %</b>, die zehnte <b>+29 %</b>, ab der 21. sind es <b>+60 %</b>. Früh aussteigen lohnt sich also kaum — das Geld liegt weit hinten.',
      'Mit <b>AUSSTEIGEN</b> sicherst du dir jederzeit Einsatz × Multiplikator — auch mitten in der Luft.',
      'Ein Treffer an Röhre oder Boden kostet den ganzen Einsatz. Die Decke ist weich, dort passiert nichts.',
      'Mit jeder Röhre wird die <b>Lücke enger</b>, das Tempo höher und der Abstand kürzer. Nach <b>' + ZIEL + ' Röhren</b> ist der Flug am Ziel und zahlt von selbst aus — dann stehen <b>' + Math.round(multNach(ZIEL)) + '×</b> auf der Uhr.',
      'Wer mitten im Flug in die Lobby geht, bekommt den Stand von diesem Moment ausgezahlt.'
    ],
    mount: function (root) {
      bilderLaden();

      var stopped = false, laeuft = false, tot = false, sperreBis = 0;
      var raf = null, letzteZeit = 0;
      var stake = 0, mult = 1, geschafft = 0, ausgestiegen = 0;
      var vy = 0, vogelY = LUFT * 0.42, kippe = 0, flatterAn = 0;
      var rohre = [], teilchen = [], schrift = [];
      var zeitAb = 0, himmelX = 0, bodenX = 0;

      var bet = GK.betPanel({ start: 25 });
      var resultBox = GK.resultBox();

      var canvas = el('canvas', { class: 'fl-canvas', width: String(W), height: String(H) });
      var buehne = el('div', { class: 'fl-screen' }, [canvas]);
      var ctx = canvas.getContext('2d');

      var multBadge = el('div', { class: 'mult-badge center', text: '1.00×' });
      var infoZeile = el('div', { class: 'fl-info', text: 'Noch am Boden' });

      var startBtn = el('button', { class: 'btn btn-gold btn-full', text: '🐦 LOSFLIEGEN' });
      var cashBtn = el('button', { class: 'btn btn-lime btn-full', text: '💰 AUSSTEIGEN' });
      cashBtn.disabled = true;

      /* Automatischer Ausstieg — dieselbe Idee wie bei der Rakete: eine Zahl
         vorher festlegen und sich nicht auf die eigenen Nerven verlassen. */
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
          el('div', { style: 'height:10px' }),
          infoZeile
        ]),
        GK.panel([
          bet.el,
          el('div', { style: 'height:12px' }),
          el('div', { class: 'bet-label', text: 'AUTOMATISCH AUSSTEIGEN NACH' }),
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
          el('p', { class: 'hint', html: '💡 <b>Tippen oder Leertaste</b> — auch zum Starten. Der Zuwachs je Röhre wächst mit, dafür wird die Lücke enger und das Tempo höher. Nach <b>' + ZIEL + ' Röhren</b> zahlt der Flug von selbst aus.' })
        ])
      ]);
      root.appendChild(stage);

      /* ── Auflösung ──
         Die Leinwand rechnet immer in 480×640, das Bildpunktraster richtet
         sich aber nach dem Gerät: ohne den Faktor sieht alles auf einem
         Handy weich aus. */
      function skalieren() {
        var dpr = Math.min(2.5, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      skalieren();
      window.addEventListener('resize', skalieren);

      /* ── Zeichnen ─────────────────────────────────────────────────── */

      function kachelnX(bild, y, h, versatz) {
        if (!bild) return;
        var b = Math.max(1, Math.round(bild.width * (h / bild.height)));
        var x = -(versatz % b);
        while (x < W) { ctx.drawImage(bild, x, y, b, h); x += b; }
      }

      /**
       * Eine Röhre zeichnen.
       *
       * Zwei Teile: die breite Mündung an der Lücke und der schmalere Schaft
       * dahinter. Der Schaft ist ein kurzes Stück aus der Bildmitte, das auf
       * die gebrauchte Länge gezogen wird — gekachelt sähe die Röhre aus wie
       * ein Stapel Ringe, weil jedes Stück seinen eigenen Rand mitbringt.
       *
       * Oben sitzt die glatte Mündung (gespiegelt), unten die bemooste: so
       * hängen die Schlieren nach unten, wie es sich für Moos gehört.
       */
      function schaft(x, y, hoehe) {
        if (hoehe <= 0) return;
        var b = da('rohr-schaft'), m = da('rohr-muendung');
        var breite = (b && m) ? ROHR_B * (b.width / m.width) : ROHR_B * 0.79;
        var links = x + (ROHR_B - breite) / 2;
        if (b) ctx.drawImage(b, links, y, breite, hoehe);
        else { ctx.fillStyle = '#3bc94a'; ctx.fillRect(links, y, breite, hoehe); }
      }

      function rohrZeichnen(x, oben, unten) {
        var kopf = da('rohr-muendung'), moos = da('rohr-moos');
        var kopfH = kopf ? ROHR_B * (kopf.height / kopf.width) : 40;
        var moosH = moos ? ROHR_B * (moos.height / moos.width) : 44;

        // Obere Röhre: hängt von der Decke, Mündung zeigt nach unten
        if (oben > 0) {
          schaft(x, 0, oben - kopfH + 2);
          if (kopf) {
            ctx.save();
            ctx.translate(x + ROHR_B / 2, oben - kopfH / 2);
            ctx.scale(1, -1);
            ctx.drawImage(kopf, -ROHR_B / 2, -kopfH / 2, ROHR_B, kopfH);
            ctx.restore();
          } else { ctx.fillStyle = '#2ea83c'; ctx.fillRect(x, oben - 20, ROHR_B, 20); }
        }

        // Untere Röhre: steht auf dem Boden, bemooste Mündung oben
        var hoehe = LUFT - unten;
        if (hoehe > 0) {
          /* Der Schaft beginnt schon unter der halben Mündung: so schaut
             zwischen beiden kein Streifen Himmel durch. */
          schaft(x, unten + moosH * 0.55, hoehe - moosH * 0.55);
          if (moos) ctx.drawImage(moos, x, unten, ROHR_B, moosH);
          else { ctx.fillStyle = '#2ea83c'; ctx.fillRect(x, unten, ROHR_B, 20); }
        }
      }

      function vogelBild() {
        if (tot) return da('sturz-2') || da('sturz-4');
        /* Sechs Bilder im Wechsel; nach einem Tipp läuft der Schlag schneller. */
        var takt = flatterAn > 0 ? 22 : 9;
        var i = Math.floor(zeitAb * takt) % 6 + 1;
        return da('flug-' + i);
      }

      function zeichnen() {
        ctx.clearRect(0, 0, W, H);

        // Himmel: zieht langsamer als der Boden, das gibt Tiefe
        var himmel = da('himmel');
        if (himmel) kachelnX(himmel, 0, LUFT, himmelX);
        else { ctx.fillStyle = '#59c6ff'; ctx.fillRect(0, 0, W, LUFT); }

        rohre.forEach(function (r) { rohrZeichnen(r.x, r.oben, r.unten); });

        var boden = da('boden');
        if (boden) kachelnX(boden, LUFT, BODEN, bodenX);
        else { ctx.fillStyle = '#c98a4b'; ctx.fillRect(0, LUFT, W, BODEN); }

        // Federn und Zahlen
        teilchen.forEach(function (t) {
          var f = da(t.bild);
          ctx.save();
          ctx.globalAlpha = Math.max(0, t.leben);
          ctx.translate(t.x, t.y);
          ctx.rotate(t.dreh);
          if (f) ctx.drawImage(f, -t.gr / 2, -t.gr / 2, t.gr, t.gr);
          else { ctx.fillStyle = '#ffb340'; ctx.fillRect(-3, -3, 6, 6); }
          ctx.restore();
        });
        schrift.forEach(function (s) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, s.leben);
          ctx.font = 'bold 26px Bungee, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(0,0,0,.55)';
          ctx.strokeText(s.text, s.x, s.y);
          ctx.fillStyle = s.farbe;
          ctx.fillText(s.text, s.x, s.y);
          ctx.restore();
        });

        // Vogel
        var vb = vogelBild();
        var breite = 62, hoehe = 54;
        ctx.save();
        ctx.translate(VOGEL_X, vogelY);
        ctx.rotate(kippe);
        if (vb) ctx.drawImage(vb, -breite / 2, -hoehe / 2, breite, hoehe);
        else {
          ctx.fillStyle = '#ffd12e';
          ctx.beginPath(); ctx.arc(0, 0, VOGEL_R, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Anzeige im Bild: Multiplikator und Röhren
        ctx.save();
        ctx.font = 'bold 34px Bungee, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 7;
        ctx.strokeStyle = 'rgba(0,0,0,.5)';
        ctx.fillStyle = '#fff';
        var txt = GK.fmtX(mult);
        ctx.strokeText(txt, W / 2, 56);
        ctx.fillText(txt, W / 2, 56);
        ctx.font = 'bold 18px Bungee, system-ui, sans-serif';
        var unten = geschafft + ' / ' + ZIEL + ' RÖHREN';
        ctx.strokeText(unten, W / 2, 84);
        ctx.fillStyle = '#ffd12e';
        ctx.fillText(unten, W / 2, 84);
        ctx.restore();

        if (!laeuft) {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,.42)';
          ctx.fillRect(0, LUFT / 2 - 46, W, 92);
          ctx.font = 'bold 24px Bungee, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.fillText(tot ? 'ABGESTÜRZT' : 'TIPPEN ZUM FLATTERN', W / 2, LUFT / 2 - 8);
          ctx.font = 'bold 15px system-ui, sans-serif';
          ctx.fillStyle = '#ffd12e';
          ctx.fillText(tot ? 'Tippen oder Leertaste für den nächsten Versuch'
                           : 'Tippen, Leertaste oder LOSFLIEGEN drücken',
                       W / 2, LUFT / 2 + 24);
          ctx.restore();
        }
      }

      /* ── Teilchen ─────────────────────────────────────────────────── */

      function feder(x, y, wucht) {
        teilchen.push({
          x: x, y: y, gr: 20 + Math.random() * 14,
          vx: -60 - Math.random() * 90 - (wucht || 0),
          vy: -40 + Math.random() * 120,
          dreh: Math.random() * Math.PI, dv: (Math.random() - 0.5) * 6,
          leben: 1, bild: 'feder-' + (1 + Math.floor(Math.random() * 3))
        });
        if (teilchen.length > 40) teilchen.shift();
      }

      function zahlZeigen(text, farbe) {
        schrift.push({ text: text, farbe: farbe || '#7cff3b', x: VOGEL_X + 60, y: vogelY - 26, leben: 1 });
        if (schrift.length > 6) schrift.shift();
      }

      /* ── Ablauf ───────────────────────────────────────────────────── */

      function neueRohre() {
        var g = luecke(geschafft);
        /* Die Lücke sitzt nie ganz oben oder unten — sonst wäre sie ohne
           Vorwarnung nicht mehr erreichbar. */
        var mitte = 90 + Math.random() * (LUFT - 180);
        mitte = Math.max(g / 2 + 40, Math.min(LUFT - g / 2 - 40, mitte));
        rohre.push({ x: W + 20, oben: mitte - g / 2, unten: mitte + g / 2, durch: false });
      }

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
        /* Kurze Sperre nach einem Absturz: wer in dem Moment noch auf die
           Taste haut, würde sonst sofort einen neuen Einsatz verlieren. */
        if (performance.now() < sperreBis) return;
        stake = bet.value();
        if (!GK.wager(stake, 'Flatterflug')) return;
        /* Der Einsatz gilt zunächst als verloren. Das ist die Rückfallebene,
           falls der Browser mitten im Flug zugeht; wer selbst in die Lobby
           geht, bekommt beim Aufräumen den aktuellen Stand ausgezahlt. */
        GK.commitResult(0, stake);

        laeuft = true; tot = false;
        mult = 1; geschafft = 0; ausgestiegen = 0;
        vogelY = LUFT * 0.42; vy = FLATTER * 0.5; kippe = 0;
        rohre = []; teilchen = []; schrift = [];
        neueRohre();
        rohre[0].x = W + 40;
        GK.setResult(resultBox, 'Flügel raus — tippen zum Steigen!', '');
        infoZeile.textContent = 'Der Flug läuft. Aussteigen geht jederzeit.';
        GK.sfx('whoosh');
        sync();
        letzteZeit = 0;
        if (!raf) raf = requestAnimationFrame(schleife);
      }

      function flattern() {
        if (!laeuft || stopped) return;
        vy = FLATTER;
        flatterAn = 0.22;
        feder(VOGEL_X - 18, vogelY + 6, 0);
        GK.sfx('waddle');
      }

      function rohrGeschafft() {
        geschafft++;
        var p = zuwachs(geschafft);
        mult *= 1 + p;
        zahlZeigen('+' + (Math.round(p * 1000) / 10).toString().replace('.', ',') + ' %');
        GK.sfx('coin');
        infoZeile.textContent = geschafft + ' Röhren · ' + GK.fmtX(mult) +
          ' · nächste bringt +' + (Math.round(zuwachs(geschafft + 1) * 1000) / 10).toString().replace('.', ',') + ' %';
        sync();
        if (geschafft >= ZIEL) { aussteigen(true); return; }
        if (autoAn) {
          var ziel = Math.max(1, Math.min(ZIEL, Math.floor(Number(autoFeld.value) || 0)));
          if (geschafft >= ziel) aussteigen(false, true);
        }
      }

      function aussteigen(amZiel, auto) {
        if (!laeuft || stopped) return;
        laeuft = false;
        ausgestiegen = mult;
        var win = Math.floor(stake * mult);
        GK.payout(win, { stake: stake });
        GK.logPlay('Flatterflug', stake, win);
        GK.setResult(resultBox,
          (amZiel ? '🏁 Am Ziel! ' : (auto ? '🤖 Automatisch ausgestiegen: ' : 'Ausgestiegen bei ')) +
          geschafft + ' Röhren · ' + GK.fmtX(mult) + ' → ' + GK.fmtSigned(win - stake), 'win');
        infoZeile.textContent = amZiel
          ? 'Alle ' + ZIEL + ' Röhren geschafft — mehr geht nicht.'
          : 'Rechtzeitig ausgestiegen.';
        GK.celebrate(win - stake, mult);
        if (amZiel) GK.emojiRain(['🐦', '🏁', '🎉'], 26);
        sync();
      }

      function absturz(woran) {
        if (!laeuft || stopped) return;
        laeuft = false; tot = true;
        sperreBis = performance.now() + 900;
        for (var i = 0; i < 14; i++) feder(VOGEL_X, vogelY, 40);
        GK.payout(0, { stake: stake });
        GK.logPlay('Flatterflug', stake, 0);
        GK.setResult(resultBox,
          woran + ' bei ' + geschafft + ' Röhren — ' + GK.fmt(stake) + ' Chips futsch', 'lose');
        infoZeile.textContent = geschafft > 0
          ? 'Bei ' + GK.fmtX(mult) + ' wäre der Ausstieg noch möglich gewesen.'
          : 'Keine einzige Röhre geschafft.';
        GK.sfx('boom');
        GK.shake(buehne);
        sync();
      }

      /* ── Schleife ─────────────────────────────────────────────────── */

      function schritt(dt) {
        zeitAb += dt;
        if (flatterAn > 0) flatterAn -= dt;

        var v = laeuft ? tempo(geschafft, GK.luckOf('flappy')) : 46;   // im Stillstand zieht nur die Kulisse
        himmelX += v * 0.28 * dt;
        bodenX += v * dt;

        if (!laeuft) {
          /* Nach dem Absturz fällt der Vogel noch auf den Boden. */
          if (tot && vogelY < LUFT - VOGEL_R) {
            vy += SCHWERKRAFT * dt;
            vogelY = Math.min(LUFT - VOGEL_R, vogelY + vy * dt);
            kippe = Math.min(1.4, kippe + dt * 3);
          }
        } else {
          vy += SCHWERKRAFT * dt;
          vogelY += vy * dt;
          /* Die Decke ist weich: dort bleibt der Vogel hängen, statt zu
             sterben. Ein Tod an der Decke fühlt sich immer ungerecht an. */
          if (vogelY < VOGEL_R) { vogelY = VOGEL_R; vy = Math.max(vy, 0); }
          kippe = Math.max(-0.5, Math.min(1.25, vy / 620));

          rohre.forEach(function (r) { r.x -= v * dt; });
          var letzte = rohre[rohre.length - 1];
          if (!letzte || letzte.x < W - abstand(geschafft)) neueRohre();
          rohre = rohre.filter(function (r) { return r.x > -ROHR_B - 10; });

          rohre.forEach(function (r) {
            var mitteR = r.x + ROHR_B / 2;
            var halb = ROHR_TREFFER / 2;
            var trifft = VOGEL_X + VOGEL_R > mitteR - halb && VOGEL_X - VOGEL_R < mitteR + halb;
            if (trifft && (vogelY - VOGEL_R < r.oben || vogelY + VOGEL_R > r.unten)) {
              absturz('Voll in die Röhre');
            }
            if (!r.durch && mitteR + halb < VOGEL_X - VOGEL_R) { r.durch = true; rohrGeschafft(); }
          });

          if (laeuft && vogelY + VOGEL_R >= LUFT) {
            vogelY = LUFT - VOGEL_R;
            absturz('Im Boden gelandet');
          }
        }

        teilchen.forEach(function (t) {
          t.x += t.vx * dt; t.y += t.vy * dt;
          t.vy += 260 * dt; t.dreh += t.dv * dt; t.leben -= dt * 0.75;
        });
        teilchen = teilchen.filter(function (t) { return t.leben > 0 && t.y < H + 40; });
        schrift.forEach(function (s) { s.y -= 42 * dt; s.leben -= dt * 0.9; });
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

      /* Ein Tipp aufs Spielfeld startet den Flug, jeder weitere lässt den
         Vogel flattern. Auf dem Handy ist das der einzige Weg, der sich
         richtig anfühlt — den Knopf drücken und dann sofort ans Spielfeld
         wechseln kostet die erste Röhre. */
      function tipp(ev) {
        if (ev) ev.preventDefault();
        if (laeuft) { flattern(); return; }
        if (!startBtn.disabled) {
          start();
          /* Der erste Tipp zählt gleich als Flügelschlag — sonst fällt der
             Vogel, während der Finger noch unterwegs ist. */
          if (laeuft) flattern();
        }
      }
      buehne.addEventListener('pointerdown', tipp);
      function taste(ev) {
        if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.key === ' ') {
          /* Nur solange dieses Spiel offen ist und niemand in ein Feld tippt. */
          var z = document.activeElement;
          if (z && /input|textarea|select/i.test(z.tagName)) return;
          ev.preventDefault();
          if (laeuft) flattern(); else if (!startBtn.disabled) start();
        }
      }
      window.addEventListener('keydown', taste);

      startBtn.addEventListener('click', function () { GK.sfx('click'); start(); });
      cashBtn.addEventListener('click', function () { GK.sfx('cash'); aussteigen(false); });

      sync();
      raf = requestAnimationFrame(schleife);

      return function () {
        /* Wer mitten im Flug in die Lobby geht, bekommt den Stand von jetzt
           ausgezahlt — als hätte er im letzten Moment AUSSTEIGEN gedrückt.
           Fortsetzen ginge nicht: der Flug lebt vom Takt, ein eingefrorener
           Vogel wäre kein gerechter Weiterflug. */
        if (laeuft && !stopped) {
          var win = Math.floor(stake * mult);
          laeuft = false;
          GK.payout(win, { stake: stake });
          GK.logPlay('Flatterflug', stake, win);
          GK.toast('Flug beendet bei ' + GK.fmtX(mult) + ' — ' + GK.fmt(win) + ' Chips gesichert',
                   'gold', '🐦');
        }
        stopped = true;
        laeuft = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', skalieren);
        window.removeEventListener('keydown', taste);
      };
    }
  });
})(window.GK);
