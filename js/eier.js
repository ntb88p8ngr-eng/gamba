/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Ostereier

   Was ein Aktionscode freischalten kann, ohne dass es Chips oder XP
   sind: ein versteckter Sender, eine Animation, eine Kleinigkeit, die
   sonst niemand sieht.

   Freigeschaltet wird auf dem Server (siehe die Operation `code` in
   server.js) — dort haengt die Kennung am Konto und ueberlebt jeden
   Neustart. Hier steht nur, was sie bewirkt.

   Neues Osterei anlegen: Kennung in OSTEREIER in server.js eintragen
   (sonst laesst sich kein Code dafuer bauen) und hier einen Eintrag in
   EIER dazu. Ein Eintrag braucht:
     name, emoji, was   — was im Konto-Fenster steht
     zeigen(an)         — schaltet die Spielerei an oder aus
     schalter           — was der Schalter im Konto-Fenster abschaltet
                          (fehlt er, laesst sich das Ei nicht abschalten)
     sender             — optional: true, wenn ein Webradio dazugehoert
                          (der Sender selbst liegt in den Einstellungen)
     jubel              — optional: die einmalige Geste beim Einloesen
   Mehr braucht es nicht.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  /* Ob eine Spielerei laeuft, gehoert zum Geraet und nicht zum Konto: wer
     sie stoerend findet, schaltet sie aus, ohne das Osterei zu verlieren.
     Gespeichert wird nur die Abweichung — wer nichts angefasst hat, sieht
     alles, was er freigeschaltet hat. */
  var SCHALTER_KEY = 'gambaking:ei:';

  /* ── Die Kartei ──────────────────────────────────────────────────── */
  var EIER = {
    '420': {
      name: 'Reggae & Rauch',
      emoji: '🌿',
      was: 'Versteckter Sender, Rauch, ein rauchender Pepe zum Verschieben, ' +
           'segelnde Blätter — und die Krone heißt anders.',
      schalter: 'Rauch, Pepe & Ganja-Krone',
      /* Der Sender dazu ist ein ganz normales Webradio aus dem Panel, nur
         mit der Kennung dieses Eis daran — der Server legt ihn beim
         ersten Start an (eierSenderAnlegen), danach gehoert er dem Admin.
         Deshalb steht er hier nicht mehr: sonst gaebe es zwei Wahrheiten,
         und die im Code waere die falsche. */
      sender: true,
      /* Ohne Emoji-Regen: fuer 420 gibt es echten Rauch aus der Zigarre,
         und schwebende Wolken-Zeichen daneben sahen aus wie Aufkleber. */
      jubel: { text: '🌿 Pepe ist da — und er raucht' },
      zeigen: function (an) {
        rauchZeigen(an); markeSetzen(an); pepeZeigen(an); blaetterZeigen(an);
      }
    },

    'matrix': {
      name: 'Digitaler Regen',
      emoji: '🟩',
      was: 'Grüne Zeichen rieseln hinter dem Casino herunter.',
      schalter: 'Zeichenregen',
      jubel: { text: '🟩 Folge dem weißen Kaninchen', emojis: ['🟩', '💚', '🖥'] },
      zeigen: function (an) { matrixZeigen(an); }
    },

    'disco': {
      name: 'Discokugel',
      emoji: '🪩',
      was: 'Eine Kugel hängt über der Seite und wirft wandernde Lichtkegel.',
      schalter: 'Discokugel',
      jubel: { text: '🪩 Die Kugel hängt', emojis: ['🪩', '🕺', '💃'] },
      zeigen: function (an) { discoZeigen(an); }
    },

    'katze': {
      name: 'Casinokatze',
      emoji: '🐈',
      was: 'Ab und zu spaziert eine Katze unten durchs Bild. Sie tut nichts.',
      schalter: 'Katze',
      jubel: { text: '🐈 Da ist eine Katze reingelaufen', emojis: ['🐈', '🐾', '🐟'] },
      zeigen: function (an) { katzeZeigen(an); }
    },

    'glitzer': {
      name: 'Sternenstaub',
      emoji: '✨',
      was: 'Der Mauszeiger zieht eine Spur aus Funken hinter sich her.',
      schalter: 'Funkenspur',
      jubel: { text: '✨ Der Zeiger funkelt jetzt', emojis: ['✨', '⭐', '💫'] },
      zeigen: function (an) { glitzerZeigen(an); }
    }
  };

  /* ── Besitz und Schalter ─────────────────────────────────────────── */

  /** Hat dieser Spieler das Ei? */
  function hat(id) {
    var p = GK.player && GK.player();
    var liste = (p && p.eier) || [];
    return liste.indexOf(id) >= 0;
  }
  GK.hatOsterei = hat;

  /** Laeuft die Spielerei auf diesem Geraet? (Ohne Ei nie.) */
  function laeuft(id) {
    if (!hat(id)) return false;
    try { return localStorage.getItem(SCHALTER_KEY + id) !== 'aus'; } catch (e) { return true; }
  }
  GK.eiLaeuft = laeuft;

  /** An/aus schalten. Gilt fuer dieses Geraet und bleibt gespeichert. */
  GK.eiSchalten = function (id, an) {
    try { localStorage.setItem(SCHALTER_KEY + id, an ? 'an' : 'aus'); } catch (e) {}
    var e = EIER[id];
    if (e && e.zeigen) e.zeigen(!!an && hat(id));
    return !!an;
  };

  /** Alle freigeschalteten Eier, als Einträge fuer das Konto-Fenster. */
  GK.eierListe = function () {
    var p = GK.player && GK.player();
    return ((p && p.eier) || []).map(function (k) {
      var e = EIER[k];
      if (!e) return null;
      return { id: k, name: e.name, emoji: e.emoji, was: e.was,
               schalter: e.schalter || '', an: laeuft(k) };
    }).filter(Boolean);
  };

  /**
   * Alle Ostereier, die es gibt — nicht nur die eigenen.
   *
   * Das Admin-Panel braucht die Liste, um einem Webradio ein Ei zuordnen
   * zu koennen. Sie verraet nichts: was es zu finden gibt, steht ohnehin
   * in dieser Datei, und das Panel sieht nur der Admin.
   */
  GK.eierAlle = function () {
    return Object.keys(EIER).map(function (k) {
      return { id: k, name: EIER[k].name, emoji: EIER[k].emoji };
    });
  };

  /* ── 420: der Rauchstau ──────────────────────────────────────────
     Der Rauch kommt aus Pepes Zigarre und steigt bis an den oberen
     Rand. Dort geht er nicht weg: er staut sich, und je laenger geraucht
     wird, desto dichter haengt er und desto weiter reicht er nach unten.

     Fruehere Fassung: fuenf Schwaden, die quer durchs Bild zogen. Die
     kamen aus dem Nichts und sahen aus wie Flecken — mit dem, was auf
     dem Bildschirm zu sehen war, hatten sie nichts zu tun. */
  var STAU_VOLL = 420000;      // nach sieben Minuten haengt er am dichtesten
  var STAU_TAKT = 3500;        // so oft wird nachgestellt (wie die CSS-Blende)
  var stauAb = 0;
  var stauUhr = null;

  function stauStellen() {
    var box = document.getElementById('rauch');
    if (!box) return;
    var f = Math.min(1, (Date.now() - stauAb) / STAU_VOLL);
    /* Von Anfang an ein Hauch, damit sofort etwas zu sehen ist — und
       gedeckelt, damit das Casino auch nach einer Stunde noch bedienbar
       bleibt. Voller als das waere kein Spass mehr, sondern Nebel. */
    box.style.setProperty('--stau', (0.12 + f * 0.5).toFixed(3));
    box.style.setProperty('--tief', (18 + f * 82).toFixed(1) + '%');
  }

  function rauchZeigen(an) {
    var box = document.getElementById('rauch');
    if (!an) {
      if (stauUhr) { clearInterval(stauUhr); stauUhr = null; }
      if (box) box.classList.remove('an');
      document.documentElement.classList.remove('raucht');
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'rauch';
      box.className = 'rauch';
      box.setAttribute('aria-hidden', 'true');
      box.appendChild(Object.assign(document.createElement('i'),
                                    { className: 'rauch-stau' }));
      document.body.appendChild(box);
      /* Ein Bild erzwingen, bevor die Klasse faellt — sonst springt die
         Deckung von 0 auf 1, statt aufzublenden. */
      void box.offsetWidth;
    }
    /* Der Stau faengt bei jedem Einschalten von vorn an. Ihn ueber das
       Neuladen zu retten hiesse, dass man irgendwann in einen fertigen
       Nebel zurueckkehrt, ohne je geraucht zu haben. */
    if (!stauUhr) {
      stauAb = Date.now();
      stauStellen();
      stauUhr = setInterval(stauStellen, STAU_TAKT);
    }
    box.classList.add('an');
    document.documentElement.classList.add('raucht');
  }

  /* Alte Namen: das Konto-Fenster hiess frueher direkt nach dem Rauch.
     Sie bleiben, damit nichts bricht, was sie noch ruft. */
  GK.rauchSchalten = function (an) { return GK.eiSchalten('420', an); };
  GK.rauchLaeuft = function () { return laeuft('420'); };

  /* ── 420: Pepe mit Zigarre ────────────────────────────────────────
     Sitzt unten rechts, raucht vor sich hin und laesst sich mit der
     Maus (oder dem Finger) verschieben. Wo er zuletzt stand, gehoert
     zum Geraet — nicht zum Konto. */
  var PEPE_KEY = 'gambaking:pepe';
  /* Die Glut sitzt nicht in der Mitte des Bildes, sondern am Ende der
     Zigarre. Ausgemessen an assets/eier/pepe.webp — dort liegen die
     roten Punkte bei 96,8 % Breite und 62,4 % Hoehe. Daran haengt der
     Rauch, sonst qualmt er dem Frosch aus der Stirn. */
  var GLUT_X = 96.8;
  var GLUT_Y = 62.4;
  var PEPE_BREIT = 190;             // Anzeigebreite in Pixeln

  function pepePlatz() {
    try {
      var d = JSON.parse(localStorage.getItem(PEPE_KEY) || 'null');
      if (d && typeof d.x === 'number' && typeof d.y === 'number') return d;
    } catch (e) {}
    return null;
  }

  /** In den sichtbaren Bereich zwingen — auch nach einem Fensterwechsel. */
  function pepeSetzen(box, x, y) {
    var b = box.getBoundingClientRect();
    var maxX = Math.max(0, window.innerWidth - (b.width || PEPE_BREIT));
    var maxY = Math.max(0, window.innerHeight - (b.height || PEPE_BREIT));
    box.style.left = Math.min(Math.max(0, x), maxX) + 'px';
    box.style.top = Math.min(Math.max(0, y), maxY) + 'px';
  }

  function pepeMerken(box) {
    try {
      localStorage.setItem(PEPE_KEY, JSON.stringify({
        x: parseInt(box.style.left, 10) || 0,
        y: parseInt(box.style.top, 10) || 0
      }));
    } catch (e) {}
  }

  function pepeBauen() {
    var box = document.createElement('div');
    box.id = 'pepe';
    box.className = 'pepe';
    box.title = GK.txt ? GK.txt('Zieh mich hin, wo du willst', 'Drag me wherever you like')
                       : 'Zieh mich hin, wo du willst';

    var bild = document.createElement('img');
    bild.className = 'pepe-bild';
    bild.src = 'assets/eier/pepe.webp';
    bild.alt = '';
    bild.draggable = false;          // sonst greift das Ziehen des Browsers
    box.appendChild(bild);

    /* Der Qualm aus der Zigarre: feste Woelkchen mit versetztem Takt
       statt neu erzeugter — das laeuft ohne Uhr und kostet nichts. */
    var qualm = document.createElement('span');
    qualm.className = 'pepe-qualm';
    qualm.style.left = GLUT_X + '%';
    qualm.style.top = GLUT_Y + '%';
    for (var i = 1; i <= 5; i++) {
      var w = document.createElement('i');
      w.className = 'pepe-wolke w' + i;
      qualm.appendChild(w);
    }
    /* Und vier grosse, die nicht nach einem halben Meter aufgeben,
       sondern bis an den oberen Rand steigen. Sie sind es, die den Stau
       da oben speisen — ohne sie haenge der Dunst da, ohne dass je
       jemand gesehen haette, wie er dorthin kommt. */
    for (var j = 1; j <= 4; j++) {
      var st = document.createElement('i');
      st.className = 'pepe-steiger s' + j;
      qualm.appendChild(st);
    }
    box.appendChild(qualm);

    /* ── Verschieben ──
       Zeigerereignisse statt Maus und Finger getrennt: damit gilt
       derselbe Weg fuer Maus, Touch und Stift. Der Zeiger wird
       eingefangen, sonst bleibt der Frosch haengen, sobald man beim
       Ziehen zu schnell wird. */
    var zieht = false, dx = 0, dy = 0, weit = 0;
    box.addEventListener('pointerdown', function (e) {
      zieht = true; weit = 0;
      var b = box.getBoundingClientRect();
      dx = e.clientX - b.left;
      dy = e.clientY - b.top;
      box.setPointerCapture(e.pointerId);
      box.classList.add('zieht');
      e.preventDefault();
    });
    box.addEventListener('pointermove', function (e) {
      if (!zieht) return;
      weit++;
      pepeSetzen(box, e.clientX - dx, e.clientY - dy);
    });
    function loslassen(e) {
      if (!zieht) return;
      zieht = false;
      box.classList.remove('zieht');
      try { box.releasePointerCapture(e.pointerId); } catch (x) {}
      pepeMerken(box);
      /* Ein Klick ohne Weg ist kein Ziehen, sondern ein Antippen — dann
         gibt es einen Zug an der Zigarre. */
      if (weit < 3) {
        box.classList.remove('zug');
        void box.offsetWidth;
        box.classList.add('zug');
        if (GK.sfx) GK.sfx('chip');
      }
    }
    /* Die Marke muss wieder weg, sonst qualmt er nach dem ersten
       Antippen für immer schneller. */
    box.addEventListener('animationend', function (e) {
      if (e.animationName === 'pepeZug') box.classList.remove('zug');
    });
    box.addEventListener('pointerup', loslassen);
    box.addEventListener('pointercancel', loslassen);

    document.body.appendChild(box);
    var platz = pepePlatz();
    if (platz) pepeSetzen(box, platz.x, platz.y);
    else pepeSetzen(box, window.innerWidth - PEPE_BREIT - 18, window.innerHeight - 250);
    return box;
  }

  function pepeRuecken() {
    var box = document.getElementById('pepe');
    if (box) pepeSetzen(box, parseInt(box.style.left, 10) || 0, parseInt(box.style.top, 10) || 0);
  }

  function pepeZeigen(an) {
    var box = document.getElementById('pepe');
    if (!an) {
      if (box) box.remove();
      window.removeEventListener('resize', pepeRuecken);
      return;
    }
    if (box) return;
    box = pepeBauen();
    window.addEventListener('resize', pepeRuecken);
    requestAnimationFrame(function () { box.classList.add('da'); });
  }

  /* ── 420: Blätter ─────────────────────────────────────────────────
     Kleine Blaetter, die langsam nach unten segeln — hinter dem Inhalt,
     wie der digitale Regen. Jedes bekommt eigene Bahn, Groesse und
     Dauer, sonst fallen sie wie ein Vorhang statt wie Blaetter. */
  var BLAETTER = 16;

  function blaetterZeigen(an) {
    var box = document.getElementById('blaetter');
    if (!an) { if (box) box.remove(); return; }
    if (box) return;
    box = document.createElement('div');
    box.id = 'blaetter';
    box.className = 'blaetter';
    box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < BLAETTER; i++) {
      var b = document.createElement('i');
      b.className = 'blatt';
      var gr = 16 + Math.random() * 22;
      b.style.left = (Math.random() * 100).toFixed(2) + '%';
      b.style.width = gr.toFixed(0) + 'px';
      b.style.height = gr.toFixed(0) + 'px';
      /* Langsam heisst langsam: eine halbe bis anderthalb Minuten von
         oben nach unten. Die negative Verzoegerung verteilt sie gleich
         beim Einschalten ueber die ganze Hoehe, statt sie erst oben
         sammeln zu lassen. */
      var dauer = 34 + Math.random() * 52;
      b.style.animationDuration = dauer.toFixed(1) + 's, ' + (5 + Math.random() * 7).toFixed(1) + 's';
      b.style.animationDelay = '-' + (Math.random() * dauer).toFixed(1) + 's, ' +
                               '-' + (Math.random() * 9).toFixed(1) + 's';
      b.style.opacity = (0.3 + Math.random() * 0.4).toFixed(2);
      box.appendChild(b);
    }
    document.body.appendChild(box);
  }

  /* ── 420: die Krone heisst anders ─────────────────────────────────
     Wer das Ei hat, spielt nicht mehr im GambaKing, sondern im
     GanjaKing. Geaendert wird nur das Wort davor — Schriftzug, Titel,
     Fusszeile und Laufband. Alles andere bleibt, wie es ist. */
  var MARKE_AUS = 'GAMBA';
  var MARKE_AN = 'GANJA';
  var markeLaeuft = false;

  /** Der Wortstamm, wie er gerade heisst. js/app.js baut daraus das Laufband. */
  GK.marke = function () { return markeLaeuft ? MARKE_AN : MARKE_AUS; };
  GK.markeVoll = function () { return GK.marke() + 'KING'; };

  function markeSetzen(an) {
    markeLaeuft = !!an;
    var wort = GK.marke();
    var voll = wort + 'KING';

    /* Kopfzeile: der zweite Teil steckt in einem eigenen Element mit
       Neonfuellung — angefasst wird nur der Textknoten davor. */
    var bn = document.querySelector('.brand-name');
    if (bn && bn.firstChild && bn.firstChild.nodeType === 3) bn.firstChild.nodeValue = wort;

    /* Der Riesenschriftzug in der Lobby. data-text traegt die beiden
       versetzten Glitch-Ebenen — ohne das bliebe der alte Name als
       Schatten stehen. */
    var ht = document.querySelector('.hero-title');
    if (ht) { ht.textContent = voll; ht.setAttribute('data-text', voll); }

    /* Fusszeile und Reiter des Browsers. */
    document.querySelectorAll('.footer b').forEach(function (b) {
      if (b.textContent === MARKE_AUS + 'KING' || b.textContent === MARKE_AN + 'KING') b.textContent = voll;
    });
    document.title = document.title.replace(/GAMBAKING|GANJAKING/, voll);

    /* Das Laufband wird nur beim naechsten Anstrich neu gebaut — hier
       anstossen, sonst steht der alte Name bis zum naechsten Gewinn da. */
    if (GK.emit) GK.emit('marke');
  }

  /* ── Digitaler Regen ──────────────────────────────────────────────
     Ein Schleier hinter dem Inhalt. Die Spur entsteht nicht durch
     Uebermalen mit Schwarz (das machte die Seite blind), sondern durch
     Wegradieren: `destination-out` frisst jedes Bild ein Stueck des
     Vorherigen weg, der Rest bleibt durchsichtig. */
  var ZEICHEN = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789';
  var SPALTE = 16;
  var mx = null;

  function matrixMessen() {
    if (!mx) return;
    mx.b = Math.max(320, window.innerWidth);
    mx.h = Math.max(240, window.innerHeight);
    mx.c.width = mx.b;
    mx.c.height = mx.h;
    var spalten = Math.ceil(mx.b / SPALTE);
    var y = [];
    for (var i = 0; i < spalten; i++) {
      y[i] = mx.y[i] !== undefined ? mx.y[i] : Math.random() * -40;
    }
    mx.y = y;
    mx.ctx.font = (SPALTE - 2) + 'px monospace';
    mx.ctx.textBaseline = 'top';
  }

  function matrixMalen() {
    if (!mx) return;
    var ctx = mx.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.09)';
    ctx.fillRect(0, 0, mx.b, mx.h);
    ctx.globalCompositeOperation = 'source-over';
    for (var i = 0; i < mx.y.length; i++) {
      var z = ZEICHEN.charAt(Math.floor(Math.random() * ZEICHEN.length));
      /* Der Tropfenkopf ist heller als sein Schweif — daran erkennt das
         Auge ueberhaupt erst eine Richtung. */
      ctx.fillStyle = Math.random() < 0.12 ? '#dcffe9' : '#39ff88';
      ctx.fillText(z, i * SPALTE, mx.y[i] * SPALTE);
      mx.y[i]++;
      /* Nicht alle Spalten gleichzeitig zuruecksetzen, sonst rieselt es im
         Takt statt durcheinander. */
      if (mx.y[i] * SPALTE > mx.h && Math.random() > 0.972) mx.y[i] = 0;
    }
  }

  function matrixZeigen(an) {
    if (!an) {
      if (!mx) return;
      clearInterval(mx.t);
      window.removeEventListener('resize', matrixMessen);
      mx.c.remove();
      mx = null;
      return;
    }
    if (mx) return;
    var c = document.createElement('canvas');
    c.className = 'matrix';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    mx = { c: c, ctx: c.getContext('2d'), y: [], b: 0, h: 0, t: 0 };
    matrixMessen();
    window.addEventListener('resize', matrixMessen);
    /* Rund 18 Bilder je Sekunde. Fluessiger muss es nicht sein — der
       Regen ist ohnehin stufig, und alles darueber kostet nur Strom. */
    mx.t = setInterval(matrixMalen, 55);
    requestAnimationFrame(function () { c.classList.add('an'); });
  }

  /* ── Discokugel ───────────────────────────────────────────────────
     Kugel oben an der Schnur, drei Lichtkegel darunter. Alles CSS —
     hier entsteht nur das Gerippe. */
  function discoZeigen(an) {
    var box = document.getElementById('disco');
    if (!an) { if (box) box.remove(); return; }
    if (box) return;
    box = document.createElement('div');
    box.id = 'disco';
    box.className = 'disco';
    box.setAttribute('aria-hidden', 'true');
    for (var i = 1; i <= 3; i++) {
      var k = document.createElement('i');
      k.className = 'disco-kegel k' + i;
      box.appendChild(k);
    }
    var schnur = document.createElement('i');
    schnur.className = 'disco-schnur';
    var kugel = document.createElement('b');
    kugel.className = 'disco-kugel';
    kugel.textContent = '🪩';
    schnur.appendChild(kugel);
    box.appendChild(schnur);
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('an'); });
  }

  /* ── Casinokatze ──────────────────────────────────────────────────
     Aussen laeuft, innen wippt: zwei Elemente, weil ein einzelnes nur
     ein `transform` hat und der Gang sonst den Weg ueberschriebe. */
  function katzeZeigen(an) {
    var k = document.getElementById('katze');
    if (!an) { if (k) k.remove(); return; }
    if (k) return;
    k = document.createElement('i');
    k.id = 'katze';
    k.className = 'katze';
    k.setAttribute('aria-hidden', 'true');
    k.appendChild(Object.assign(document.createElement('b'), { textContent: '🐈' }));
    document.body.appendChild(k);
  }

  /* ── Sternenstaub ─────────────────────────────────────────────────
     Funken am Zeiger. Auf dem Handy passiert nichts — dort gibt es
     keinen Zeiger, und ein Funke bei jeder Beruehrung waere im Weg. */
  var FUNKEN = ['✨', '⭐', '💫', '🌟'];
  var glz = null;

  function funkeStreuen(e) {
    var jetzt = Date.now();
    /* Ohne Bremse haengen bei schneller Maus hundert Funken im Bild. */
    if (jetzt - glz.letzt < 45) return;
    glz.letzt = jetzt;
    var f = document.createElement('i');
    f.className = 'funke';
    f.textContent = FUNKEN[Math.floor(Math.random() * FUNKEN.length)];
    f.style.left = e.clientX + 'px';
    f.style.top = e.clientY + 'px';
    f.style.setProperty('--drift', (Math.random() * 44 - 22).toFixed(0) + 'px');
    f.style.setProperty('--dreh', (Math.random() * 160 - 80).toFixed(0) + 'deg');
    f.style.fontSize = (9 + Math.random() * 7).toFixed(1) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 950);
  }

  function glitzerZeigen(an) {
    if (an) {
      if (glz) return;
      glz = { letzt: 0 };
      document.addEventListener('mousemove', funkeStreuen, { passive: true });
    } else {
      if (glz) document.removeEventListener('mousemove', funkeStreuen);
      glz = null;
      document.querySelectorAll('.funke').forEach(function (f) { f.remove(); });
    }
  }

  /* ── Anwenden ─────────────────────────────────────────────────────── */

  /**
   * Ein Osterei anwenden.
   *
   * `frisch` heisst: gerade eingeloest — dann gibt es einmal die grosse
   * Geste, und der Schalter wird zurueckgesetzt. Wer ein Ei einloest,
   * will es sehen, auch wenn er es vor drei Konten mal abgeschaltet hat.
   */
  GK.osterei = function (id, frisch) {
    var e = EIER[id];
    if (!e) return;
    if (frisch) { try { localStorage.removeItem(SCHALTER_KEY + id); } catch (x) {} }
    if (e.zeigen) e.zeigen(laeuft(id));
    /* Bringt das Ei einen Sender mit, hat sich die Senderliste geaendert —
       das Musikfenster soll es mitbekommen, auch wenn es offen steht. */
    if (e.sender && GK.emit) GK.emit('musik-liste');
    if (frisch && e.jubel) {
      GK.toast(e.jubel.text, 'gold', e.emoji);
      if (GK.emojiRain && e.jubel.emojis) GK.emojiRain(e.jubel.emojis, 30);
    }
  };

  /** Alles anwenden, was dieses Konto hat — und alles andere abraeumen. */
  GK.eierAnwenden = function () {
    Object.keys(EIER).forEach(function (k) {
      /* Auch das Abschalten muss durchlaufen: wer das Konto wechselt, soll
         die Spielereien des anderen nicht behalten. */
      if (EIER[k].zeigen) EIER[k].zeigen(laeuft(k));
    });
  };

  /* Beim Anmelden, beim Kontowechsel und nach jedem Serverstand. */
  if (GK.on) {
    GK.on('player-changed', GK.eierAnwenden);
    GK.on('logged-out', GK.eierAnwenden);
  }

})(window.GK);
