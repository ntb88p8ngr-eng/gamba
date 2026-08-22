/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Sound-Pack
   Laedt assets/sfx/sounds.json und legt eigene Audiodateien ueber die
   eingebauten, synthetisch erzeugten Klaenge aus core.js.

   Nichts hier ist Pflicht: fehlt die Datei, fehlt ein Eintrag oder schlaegt
   das Laden fehl, spielt weiterhin der eingebaute Klang. Man kann also
   einzelne Sounds austauschen und den Rest so lassen.

   GK.sfx() fragt bei jedem Ton hier an — siehe den Aufruf von
   GK.sfxPack.play() in core.js.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var MANIFEST = 'assets/sfx/sounds.json';
  var BASE = 'assets/sfx/';

  var pack = GK.sfxPack = {
    manifest: null,
    loaded: false,
    /* Fehlermeldungen sammeln, statt die Konsole vollzuschreiben — jede
       kaputte Datei genau einmal melden. */
    problems: [],
    /* Eintraege aus sounds.json, die sich nicht lesen liessen. */
    broken: [],
    /* Eintraege mit einem Namen, den es im Spiel nicht gibt. */
    unknown: []
  };

  var buffers = {};        // pfad -> AudioBuffer
  var leads = {};          // pfad -> Sekunden Stille am Dateianfang
  var pending = {};        // pfad -> true, solange dekodiert wird
  var failed = {};         // pfad -> true, nie wieder versuchen
  var lastVariant = {};    // schluessel -> zuletzt gespielter Index
  var queued = [];         // wartet auf den Audio-Kontext

  /* ── Konfiguration einlesen ────────────────────────────────────────── */

  /** Kurzform 'datei.mp3' und Langform { file: … } zur selben Struktur. */
  function normalize(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return { files: [entry] };
    if (Array.isArray(entry)) return { files: entry.slice() };
    if (typeof entry !== 'object') return null;

    var cfg = {};
    for (var k in entry) if (Object.prototype.hasOwnProperty.call(entry, k)) cfg[k] = entry[k];
    if (typeof cfg.file === 'string') cfg.files = [cfg.file];
    if (typeof cfg.files === 'string') cfg.files = [cfg.files];
    if (!Array.isArray(cfg.files)) cfg.files = [];
    return cfg;
  }

  /**
   * Was gilt fuer diesen Ton in diesem Spiel?
   *
   * Reihenfolge, spaeter schlaegt frueher:
   *   1. sounds.<name>          — global
   *   2. games.<spiel>.<name>   — nur in diesem Spiel
   * Ein Spiel-Eintrag ersetzt den globalen nicht komplett, sondern
   * ueberschreibt nur die Felder, die er selbst setzt. So kann man etwa nur
   * die Lautstaerke eines Tons in einem Spiel anheben.
   */
  function resolve(name, gameId) {
    var m = pack.manifest;
    if (!m || !name || isNote(name)) return null;

    var base = normalize(m.sounds && m.sounds[name]);
    var over = null;
    var game = gameId || GK.currentGame;
    if (game && m.games && m.games[game]) over = normalize(m.games[game][name]);
    if (!base && !over) return null;

    var cfg = {};
    var src, k;
    for (var i = 0; i < 2; i++) {
      src = i ? over : base;
      if (!src) continue;
      for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) {
        /* Eine leere Dateiliste im Spiel-Eintrag soll die globale nicht
           loeschen — sonst kann man dort nicht nur die Lautstaerke drehen. */
        if (k === 'files' && (!src[k] || !src[k].length)) continue;
        cfg[k] = src[k];
      }
    }
    if (cfg.enabled === false) return { muted: true };
    if (!cfg.files || !cfg.files.length) return null;
    return cfg;
  }

  /* ── Dateien holen ─────────────────────────────────────────────────── */

  function url(file) {
    if (/^(https?:)?\/\//.test(file) || file.charAt(0) === '/') return file;
    /* Dateien kommen so, wie sie auf der Platte heissen — und Musikstuecke
       heissen nun einmal „Fly Me To The Moon (2008 Remastered).mp3". Ein
       Leerzeichen im src bricht die Adresse, deshalb hier einmal durch
       encodeURI. Das laesst bereits kodierte Pfade in Ruhe (%20 bleibt %20)
       und ruehrt / ( ) ' nicht an — nur das, was wirklich stoert. */
    return encodeURI(BASE + file);
  }

  /** Pfad im Pack aufloesen — auch fuer andere Module (Musik). */
  pack.url = url;

  /**
   * Musikstuecke aus dem Pack.
   *
   * Anders als die Klaenge werden sie nicht in den Audio-Kontext geladen,
   * sondern von js/music.js als ganze Datei abgespielt — ein Stueck dauert
   * Minuten, das gehoert nicht in einen dekodierten Puffer.
   *
   * Zurueck kommt eine geputzte Liste: nur Eintraege mit Kennung und Datei,
   * Pfade schon aufgeloest, `skins` immer eine Liste oder null.
   */
  pack.musik = function () {
    var m = pack.manifest;
    var roh = m && Array.isArray(m.music) ? m.music : [];
    var raus = [];
    roh.forEach(function (t) {
      if (!t || typeof t !== 'object') return;
      var datei = t.file || (Array.isArray(t.files) ? t.files[0] : null);
      if (!t.id || !datei) return;
      raus.push({
        id: String(t.id).slice(0, 40),
        name: String(t.name || t.id).slice(0, 60),
        mood: String(t.mood || 'aus dem Sound-Pack').slice(0, 80),
        bpm: Number(t.bpm) || 0,
        url: url(String(datei)),
        volume: t.volume === undefined ? 1 : Number(t.volume) || 0,
        /* Leere Liste hiesse „nirgends" — das ist nie gemeint, also null. */
        skins: Array.isArray(t.skins) && t.skins.length ? t.skins.slice() : null,
        /* Ein Stueck, das nur zum Sender gehoert. Es laeuft im Radio ganz
           normal mit, steht aber nicht in der Stueckauswahl — bei zehn
           Titeln aus einem Sender waere die Liste sonst nur noch Sender. */
        nurRadio: t.nurRadio === true || t.radioOnly === true,
        datei: true
      });
    });
    return raus;
  };

  /**
   * Radiosender aus dem Pack.
   *
   * Ein Sender ist nichts als eine Reihenfolge: welche Stuecke, in welcher
   * Ordnung, wie lange jedes. Ohne `tracks` nimmt er alles, was zum
   * laufenden Anstrich passt — das ist der Normalfall und braucht keinen
   * Eintrag.
   */
  pack.radio = function () {
    var m = pack.manifest;
    var roh = m && Array.isArray(m.radio) ? m.radio : [];
    var raus = [];
    roh.forEach(function (r) {
      if (!r || typeof r !== 'object' || !r.id) return;
      raus.push({
        id: String(r.id).slice(0, 40),
        name: String(r.name || r.id).slice(0, 60),
        was: String(r.was || r.mood || '').slice(0, 90),
        tracks: Array.isArray(r.tracks) && r.tracks.length ? r.tracks.slice() : null,
        mischen: r.mischen !== false,
        /* Sekunden je Stueck — gilt nur fuer die erzeugten Loops, die von
           sich aus endlos laufen. Dateien wechseln, wenn sie zu Ende sind. */
        dauer: Math.max(30, Number(r.dauer) || 210),
        skins: Array.isArray(r.skins) && r.skins.length ? r.skins.slice() : null
      });
    });
    return raus;
  };

  function note(msg) {
    if (pack.problems.indexOf(msg) >= 0) return;
    pack.problems.push(msg);
    if (window.console && console.warn) console.warn('[sfx] ' + msg);
  }

  /**
   * Stille am Anfang einer Datei messen.
   *
   * Beim Schneiden bleibt vorne fast immer etwas Ruhe stehen — bei einer
   * Aufnahme aus einer Bibliothek gern eine halbe Sekunde. Die zaehlt beim
   * Abspielen voll mit: der Ton setzt erst danach ein und wirkt wie eine
   * Verzoegerung zum Bild. Gemessen wird der erste Ausschlag ueber der
   * Schwelle; davor bleiben 8 ms stehen, damit der Anschlag nicht abgehackt
   * klingt. Gesucht wird nur in der ersten Sekunde — was danach kommt, ist
   * eine Pause im Klang und keine Vorlaufstille.
   */
  function leadSilence(buf) {
    var ch = buf.getChannelData(0);
    var grenze = Math.min(ch.length, Math.floor(buf.sampleRate));
    var i = 0;
    while (i < grenze && Math.abs(ch[i]) < 0.02) i++;
    if (i >= grenze) return 0;                       // durchgehend leise: nichts kuerzen
    return Math.max(0, i / buf.sampleRate - 0.008);
  }

  /**
   * Datei laden und dekodieren. Laeuft im Hintergrund: der erste Aufruf
   * eines Tons faellt noch auf den eingebauten Klang zurueck, ab dem zweiten
   * liegt die Datei im Cache. Wer das nicht will, setzt preload.
   */
  function load(file) {
    var u = url(file);
    if (buffers[u] || pending[u] || failed[u]) return;
    var ctx = GK.sound && GK.sound.ctx;
    if (!ctx) {
      /* Beim Seitenstart gibt es noch keinen Audio-Kontext — der entsteht
         erst beim ersten Ton. Vorladen lief deshalb bisher ins Leere, und
         auch mit preload kam der erste Klick noch eingebaut. Gemerkte
         Dateien werden nachgeholt, sobald der Kontext da ist. */
      if (queued.indexOf(file) < 0) queued.push(file);
      return;
    }
    pending[u] = true;
    fetch(u).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      return new Promise(function (res, rej) {
        /* Safari kennt die Promise-Form von decodeAudioData nicht. */
        var p = ctx.decodeAudioData(buf, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    }).then(function (decoded) {
      buffers[u] = decoded;
      leads[u] = leadSilence(decoded);
      delete pending[u];
    }).catch(function (e) {
      failed[u] = true;
      delete pending[u];
      note(u + ' liess sich nicht laden (' + e.message + ') — eingebauter Klang bleibt aktiv');
    });
  }

  /* ── Abspielen ─────────────────────────────────────────────────────── */

  function pickFile(cfg, key) {
    var files = cfg.files;
    if (files.length === 1) return files[0];
    var i;
    if (cfg.pick === 'reihum') {
      i = ((lastVariant[key] === undefined ? -1 : lastVariant[key]) + 1) % files.length;
    } else {
      /* Zufall, aber nie zweimal dieselbe Variante hintereinander — sonst
         faellt bei schnellen Klickfolgen die Wiederholung auf. */
      i = Math.floor(Math.random() * files.length);
      if (files.length > 1 && i === lastVariant[key]) i = (i + 1) % files.length;
    }
    lastVariant[key] = i;
    return files[i];
  }

  function jitter(base, amount) {
    if (!amount) return base;
    return base + (Math.random() * 2 - 1) * amount;
  }

  /**
   * Gibt true zurueck, wenn dieser Ton aus einer Datei kommt — dann laesst
   * core.js den eingebauten Klang aus. Bei false uebernimmt der Synthesizer.
   */
  pack.play = function (name, gameId) {
    if (!pack.loaded || !pack.manifest) return false;
    var snd = GK.sound;
    if (!snd || !snd.ready || !snd.enabled()) return false;

    /* Jetzt steht der Kontext — was beim Start vorgemerkt wurde, kann laden. */
    if (queued.length) { var q = queued; queued = []; q.forEach(load); }

    var cfg = resolve(name, gameId);
    if (!cfg) return false;
    /* Ausdruecklich stummgeschaltet: nichts spielen, aber auch nicht auf den
       eingebauten Klang zurueckfallen. */
    if (cfg.muted) return true;

    var key = (gameId || GK.currentGame || '') + '/' + name;
    var file = pickFile(cfg, key);
    var u = url(file);

    if (!buffers[u]) { load(file); return false; }
    if (failed[u]) return false;

    var ctx = snd.ctx;
    var src = ctx.createBufferSource();
    src.buffer = buffers[u];

    var rate = cfg.rate === undefined ? 1 : cfg.rate;
    rate = jitter(rate, cfg.rateJitter);
    src.playbackRate.value = Math.max(0.05, Math.min(6, rate));
    if (cfg.detune && src.detune) src.detune.value = cfg.detune;

    var g = ctx.createGain();
    var vol = cfg.volume === undefined ? 1 : cfg.volume;
    var globalVol = (pack.manifest.defaults && pack.manifest.defaults.volume);
    vol *= (globalVol === undefined ? 1 : globalVol);
    vol = jitter(vol, cfg.volumeJitter);
    g.gain.value = Math.max(0, Math.min(4, vol));

    src.connect(g);
    /* Ueber den Master, damit der Lautstaerkeregler der Seite auch fuer
       eigene Dateien gilt. */
    g.connect(snd.master);

    var t0 = ctx.currentTime + (cfg.delay || 0);
    /* Stille am Dateianfang ueberspringen, damit der Klang zum Bild passt.
       Ein selbst gesetztes offset hat Vorrang, "trim": false schaltet es ab. */
    var off = cfg.offset;
    if (off === undefined) off = cfg.trim === false ? 0 : (leads[u] || 0);
    if (cfg.duration) src.start(t0, off, cfg.duration);
    else src.start(t0, off);
    return true;
  };

  /* ── Kaputte JSON ueberleben ───────────────────────────────────────── */

  /* Ein einziger Tippfehler in sounds.json machte bisher saemtliche eigenen
     Klaenge aus — JSON.parse bricht beim ersten Fehler ab und wirft das ganze
     Dokument weg. Deshalb wird die Datei in drei Stufen gelesen:
       1. normal,
       2. nach dem Entfernen der ueblichen Kleinigkeiten (Kommentare,
          Komma vor der schliessenden Klammer),
       3. Eintrag fuer Eintrag — dann faellt nur der kaputte Eintrag weg und
          der Rest der Datei klingt weiter. */

  /** Zeile und Spalte zu einer Zeichenposition, plus die betroffene Zeile. */
  function where(text, pos) {
    if (!(pos >= 0)) return null;
    var upto = text.slice(0, pos);
    var line = upto.split('\n').length;
    var col = pos - (upto.lastIndexOf('\n') + 1) + 1;
    var src = text.split('\n')[line - 1] || '';
    return { line: line, col: col, text: src.trim().slice(0, 60) };
  }

  /* Waehrend des Rettens gemerkt, damit Fehler mit Zeilennummer statt mit
     Zeichenposition gemeldet werden — danach sucht man in einem Texteditor. */
  var srcText = '';

  function lenient(text) {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, '')     // /* Kommentar */
      .replace(/^[ \t]*\/\/.*$/gm, '')      // // Kommentar
      .replace(/,(\s*[}\]])/g, '$1');       // Komma vor der Klammer
  }

  /** Ende des Werts, der bei i beginnt — Strings und Verschachtelung zaehlen. */
  function valueEnd(text, i) {
    var c = text.charAt(i);
    var inStr = false, esc = false, ch;
    if (c === '{' || c === '[') {
      var depth = 0;
      for (; i < text.length; i++) {
        ch = text.charAt(i);
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') { depth--; if (depth <= 0) return i + 1; }
      }
      return -1;
    }
    /* Zahl, Text, true/false/null: bis zum naechsten Trenner. */
    for (; i < text.length; i++) {
      ch = text.charAt(i);
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === ',' || ch === '}' || ch === ']') return i;
    }
    return text.length;
  }

  /**
   * Objekt Eintrag fuer Eintrag lesen. Jeder Wert wird einzeln geparst; was
   * sich nicht lesen laesst, landet in bad und wird uebersprungen. Objekte
   * werden bei Bedarf noch eine Ebene tiefer gerettet, damit ein Fehler in
   * sounds.click nicht gleich ganz sounds kostet.
   */
  function salvage(text, path, bad, base) {
    var open = text.indexOf('{');
    var close = text.lastIndexOf('}');
    if (open < 0 || close < open) return null;
    var body = text.slice(open + 1, close);
    var bodyAt = (base || 0) + open + 1;   // Lage von body im Gesamttext
    var out = {};
    var i = 0;

    function melde(key, at) {
      var spot = where(srcText, bodyAt + at);
      bad.push(path + key + (spot ? ' (Zeile ' + spot.line + ')' : ''));
    }

    while (i < body.length) {
      var q = body.indexOf('"', i);
      if (q < 0) break;

      var e = q + 1, esc = false, c;
      while (e < body.length) {
        c = body.charAt(e);
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') break;
        e++;
      }
      var key = body.slice(q + 1, e);

      var colon = e + 1;
      while (colon < body.length && /\s/.test(body.charAt(colon))) colon++;
      if (body.charAt(colon) !== ':') { i = e + 1; continue; }

      var v = colon + 1;
      while (v < body.length && /\s/.test(body.charAt(v))) v++;
      var end = valueEnd(body, v);
      if (end < 0) { melde(key, q); break; }

      var raw = body.slice(v, end);
      try {
        out[key] = JSON.parse(raw);
      } catch (err) {
        var deep = raw.charAt(0) === '{'
          ? salvage(raw, path + key + '.', bad, bodyAt + v)
          : null;
        if (deep) out[key] = deep;
        else melde(key, q);
      }
      i = end;
    }
    return out;
  }

  /** Liefert { data, bad, hint } — data ist null, wenn gar nichts zu holen war. */
  function parseManifest(text) {
    var bad = [];
    try {
      return { data: JSON.parse(text), bad: bad, hint: null };
    } catch (e) { /* weiter */ }

    try {
      return {
        data: JSON.parse(lenient(text)), bad: bad,
        hint: 'Kleinigkeiten (Kommentar oder Komma zu viel) automatisch uebergangen'
      };
    } catch (e) { /* weiter zur Rettung */ }

    srcText = text;
    var data = salvage(text, '', bad, 0);
    srcText = '';
    return {
      data: data,
      bad: bad,
      hint: bad.length
        ? 'fehlerhafte Eintraege uebersprungen, der Rest gilt weiter'
        : 'nicht lesbar'
    };
  }

  /* ── Laden und Nachladen ───────────────────────────────────────────── */

  /* Schluessel, die mit _ beginnen, sind Anmerkungen in der Datei und kein
     Klang. Ohne diese Pruefung hat das Vorladen den Kommentartext als
     Dateipfad genommen — und weil "games._" ebenfalls ein Text ist, lief die
     innere Schleife ueber dessen einzelne Buchstaben. Das ergab dutzende
     erfundene 404er, in denen echte Fehler untergingen. */
  function isNote(key) { return key.charAt(0) === '_'; }

  /**
   * Tippfehler in den Namen finden. Ein Eintrag, den kein Spiel je abruft,
   * bleibt sonst still liegen und man sucht den Fehler bei der Audiodatei —
   * so geschehen mit "loss" unter plinko, wo der Ton "lose" heisst. Auch ein
   * unbekannter Spielname faellt so auf.
   */
  function checkNames() {
    var m = pack.manifest;
    if (!m) return [];
    var bekannt = GK.SFX_NAMES || {};
    var spiele = {};
    (GK.games || []).forEach(function (g) { spiele[g.id] = true; });
    var falsch = [], k, g;

    for (k in m.sounds || {}) {
      if (!isNote(k) && !bekannt[k]) falsch.push('sounds.' + k);
    }
    for (g in m.games || {}) {
      if (isNote(g) || !m.games[g] || typeof m.games[g] !== 'object') continue;
      if (!spiele[g]) { falsch.push('games.' + g + ' (kein Spiel mit dieser id)'); continue; }
      for (k in m.games[g]) {
        if (!isNote(k) && !bekannt[k]) falsch.push('games.' + g + '.' + k);
      }
    }
    return falsch;
  }

  function preloadAll() {
    var m = pack.manifest;
    if (!m) return;
    function maybe(entry) {
      var cfg = normalize(entry);
      if (!cfg || !cfg.files.length) return;
      var always = m.defaults && m.defaults.preload;
      if (cfg.preload || always) cfg.files.forEach(load);
    }
    var k, g;
    for (k in m.sounds || {}) if (!isNote(k)) maybe(m.sounds[k]);
    for (g in m.games || {}) {
      var grp = m.games[g];
      if (isNote(g) || !grp || typeof grp !== 'object') continue;
      for (k in grp) if (!isNote(k)) maybe(grp[k]);
    }
  }

  /**
   * Manifest neu einlesen, ohne die Seite neu zu laden. Praktisch beim
   * Zusammenstellen eines Packs: Datei tauschen, in der Konsole
   * GK.sfxPack.reload() aufrufen, anhoeren.
   */
  pack.reload = function () {
    buffers = {}; leads = {}; pending = {}; failed = {}; pack.problems = [];
    return fetch(MANIFEST + '?t=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var res = parseManifest(text);
        pack.manifest = res.data;
        pack.loaded = true;
        pack.broken = res.bad;

        /* Ohne Hinweis sucht man den Fehler bei den Audiodateien statt in der
           Datei — ein Komma zu viel oder eine falsche Klammer reicht. */
        if (res.hint) {
          note('sounds.json: ' + res.hint);
          if (res.bad.length) note('uebersprungen: ' + res.bad.join(', '));
          if (GK.toast) {
            GK.toast(res.bad.length
              ? 'sounds.json: ' + res.bad.join(', ') + ' übersprungen — ' + res.hint
              : 'sounds.json: ' + res.hint, 'bad', '🔇');
          }
        }
        /* Die Musik im Pack interessiert js/music.js — das erfaehrt hier,
           dass es nachsehen kann. */
        if (GK.emit) GK.emit('sfx-pack');
        if (res.data) {
          var unbekannt = checkNames();
          pack.unknown = unbekannt;
          if (unbekannt.length) {
            note('unbekannte Namen, die nie abgespielt werden: ' + unbekannt.join(', ') +
                 ' — gueltige Tonnamen: GK.sfxPack.names()');
            if (GK.toast) {
              GK.toast('sounds.json: ' + unbekannt.join(', ') + ' — diesen Namen gibt es nicht',
                       'bad', '🔇');
            }
          }
          preloadAll();
        }
        return res.data;
      })
      .catch(function (e) {
        pack.loaded = true;          // nicht bei jedem Ton erneut versuchen
        pack.manifest = null;
        note('sounds.json nicht gelesen (' + e.message + ') — es bleibt bei den eingebauten Klaengen');
        if (GK.toast) {
          GK.toast('sounds.json ist fehlerhaft — eigene Klänge sind aus. ' +
                   String(e.message).slice(0, 90), 'bad', '🔇');
        }
        return null;
      });
  };

  /** Welche Datei wuerde dieser Ton gerade benutzen? Fuer die Fehlersuche. */
  pack.debug = function (name, gameId) {
    var cfg = resolve(name, gameId);
    if (!cfg) return { name: name, quelle: 'eingebaut' };
    if (cfg.muted) return { name: name, quelle: 'stumm' };
    return {
      name: name,
      quelle: 'datei',
      dateien: cfg.files.map(url),
      geladen: cfg.files.map(function (f) { return !!buffers[url(f)]; }),
      /* Uebersprungene Stille am Dateianfang in Millisekunden. */
      vorlauf: cfg.files.map(function (f) { return Math.round((leads[url(f)] || 0) * 1000); }),
      konfiguration: cfg
    };
  };

  /**
   * Kommt dieser Ton aus einer eigenen Datei? Spiele, die einen Klang im
   * schnellen Takt wiederholen, fragen damit nach: der eingebaute Huf ist ein
   * einzelner Schlag und ergibt erst durch die Wiederholung ein Getrappel,
   * eine eigene Datei ist dagegen meist schon die ganze Aufnahme.
   */
  pack.isFile = function (name, gameId) {
    var cfg = resolve(name, gameId);
    return !!(cfg && !cfg.muted && cfg.files && cfg.files.length);
  };

  /** Alle Tonnamen, die das Spiel ueberhaupt kennt. */
  pack.names = function () { return Object.keys(GK.SFX_NAMES || {}); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { pack.reload(); });
  } else {
    pack.reload();
  }
})(window.GK);
