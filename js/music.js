/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Hintergrundmusik
   Acht Loops, komplett per Web Audio erzeugt. Jeder Track hat seine
   eigene Besetzung, sein eigenes Schlagzeug und sein eigenes Groove-
   Gefühl — vom Jazz-Trio am Roulettetisch bis zum Hardcore-Kick.
   Keine Audio-Dateien, kein Nachladen, jederzeit abschaltbar.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  var NOISE = null;      // ein einziger Rausch-Puffer, für alles wiederverwendet
  var CURVE = null;      // Verzerrerkennlinie für den Gabber-Kick

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function ctx() { return GK.sound.ctx; }

  /* ══════════════ Instrumente ══════════════ */

  /**
   * Universalstimme: ein bis drei verstimmte Oszillatoren, optional mit
   * Vibrato, eigenem Tiefpass (inkl. Filterfahrt) und Stereoposition.
   * o = {type, vol, atk, detune, vib, vibRate, cut, sweep, q, glide, pan}
   */
  function voice(freq, t, dur, o) {
    var c = ctx(), g = c.createGain(), tail = g;
    var vol = Math.max(0.0002, o.vol || 0.08);

    if (o.cut) {
      var f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.cut, t);
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.sweep), t + dur);
      f.Q.value = o.q || 0.7;
      tail.connect(f); tail = f;
    }
    if (o.pan && c.createStereoPanner) {
      var p = c.createStereoPanner();
      p.pan.value = o.pan;
      tail.connect(p); tail = p;
    }
    tail.connect(Music._gain);

    var atk = o.atk === undefined ? Math.min(0.08, dur * 0.25) : o.atk;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.004, atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    var vibGain = null;
    if (o.vib) {
      var lfo = c.createOscillator(); lfo.type = 'sine';
      lfo.frequency.value = o.vibRate || 5;
      vibGain = c.createGain(); vibGain.gain.value = o.vib;   // in Cent
      lfo.connect(vibGain);
      lfo.start(t); lfo.stop(t + dur + 0.06);
    }

    var spread = o.detune ? [-o.detune, 0, o.detune] : [0];
    spread.forEach(function (d) {
      var osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glide), t + dur);
      osc.detune.value = d;
      if (vibGain) vibGain.connect(osc.detune);
      osc.connect(g);
      osc.start(t); osc.stop(t + dur + 0.06);
    });
  }

  /** FM-Stimme: Träger + Modulator — glockig, Rhodes-artig, Vibraphon. */
  function fm(freq, t, dur, o) {
    var c = ctx();
    var car = c.createOscillator(), mod = c.createOscillator();
    var mg = c.createGain(), g = c.createGain(), tail = g;

    car.type = 'sine';
    mod.type = o.modType || 'sine';
    car.frequency.value = freq;
    mod.frequency.value = freq * (o.ratio || 2);
    mg.gain.setValueAtTime(freq * (o.index || 3), t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.04, t + dur * 0.7);
    mod.connect(mg); mg.connect(car.frequency);

    if (o.pan && c.createStereoPanner) {
      var p = c.createStereoPanner();
      p.pan.value = o.pan;
      tail.connect(p); tail = p;
    }
    tail.connect(Music._gain);

    var atk = o.atk === undefined ? 0.006 : o.atk;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);

    car.start(t); mod.start(t);
    car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }

  /** Ganzer Akkord auf einmal — für Stiche und Comping. */
  function chord(t, root, ivs, dur, o) {
    ivs.forEach(function (iv, i) {
      var oo = {}; for (var k in o) oo[k] = o[k];
      oo.vol = o.vol / (i + 1.3);
      voice(midi(root + iv), t, dur, oo);
    });
  }

  function chordFm(t, root, ivs, dur, o) {
    ivs.forEach(function (iv, i) {
      fm(midi(root + iv), t, dur, {
        ratio: o.ratio, index: o.index, pan: o.pan,
        vol: o.vol / (i + 1.3), atk: o.atk
      });
    });
  }

  /** Gefiltertes Rauschen — Basis für Becken, Snares, Riser und Knistern. */
  function noise(t, dur, o) {
    var c = ctx();
    if (!NOISE) {
      NOISE = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
      var d = NOISE.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = NOISE;
    src.loop = true;
    var f = c.createBiquadFilter();
    f.type = o.filter || 'highpass';
    f.frequency.setValueAtTime(o.freq || 6000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.sweep), t + dur);
    f.Q.value = o.q || 0.7;
    var g = c.createGain(), tail = g;
    var atk = o.atk === undefined ? 0.002 : o.atk;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + Math.max(0.002, atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.pan && c.createStereoPanner) {
      var p = c.createStereoPanner(); p.pan.value = o.pan;
      tail.connect(p); tail = p;
    }
    src.connect(f); f.connect(g); tail.connect(Music._gain);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  function shaper() {
    var c = ctx();
    if (!CURVE) {
      CURVE = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) CURVE[i] = Math.tanh((i / 512 - 1) * 4);
    }
    var ws = c.createWaveShaper();
    ws.curve = CURVE;
    return ws;
  }

  /* ── Schlagzeug in fünf Bauarten ── */

  var KICKS = {
    deep:   [140, 45, 0.22],
    punch:  [200, 52, 0.15],
    boom:   [110, 34, 0.34],
    hard:   [320, 48, 0.17],
    gabber: [420, 42, 0.26]
  };

  function kick(t, vol, kind) {
    var c = ctx(), spec = KICKS[kind || 'deep'];
    var o = c.createOscillator(), g = c.createGain();
    o.type = (kind === 'hard' || kind === 'gabber') ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(spec[0], t);
    o.frequency.exponentialRampToValueAtTime(spec[1], t + spec[2] * 0.7);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec[2]);
    o.connect(g);
    if (kind === 'gabber') { var ws = shaper(); g.connect(ws); ws.connect(Music._gain); }
    else g.connect(Music._gain);
    o.start(t); o.stop(t + spec[2] + 0.05);
    if (kind === 'hard' || kind === 'gabber') {
      noise(t, 0.03, { vol: vol * 0.3, filter: 'highpass', freq: 3200 });
    }
  }

  function snare(t, vol, kind) {
    if (kind === 'clap') {
      [0, 0.013, 0.027].forEach(function (d, i) {
        noise(t + d, 0.12, { vol: vol * (i === 2 ? 1 : 0.55), filter: 'bandpass', freq: 1500, q: 1.2 });
      });
      return;
    }
    if (kind === 'rim') {
      noise(t, 0.03, { vol: vol, filter: 'bandpass', freq: 2400, q: 8 });
      voice(880, t, 0.04, { type: 'square', vol: vol * 0.5, atk: 0.002 });
      return;
    }
    var dusty = kind === 'dusty';
    noise(t, dusty ? 0.13 : 0.17, {
      vol: vol, filter: 'bandpass', freq: dusty ? 1400 : 1950,
      q: 0.8, sweep: dusty ? 850 : 0
    });
    voice(dusty ? 165 : 195, t, 0.1, { type: 'triangle', vol: vol * 0.5, atk: 0.002 });
  }

  function hat(t, vol, kind) {
    if (kind === 'open')  return noise(t, 0.26, { vol: vol, filter: 'highpass', freq: 6200 });
    if (kind === 'brush') return noise(t, 0.1, { vol: vol, filter: 'bandpass', freq: 4200, q: 0.6 });
    if (kind === 'tick')  return noise(t, 0.035, { vol: vol, filter: 'bandpass', freq: 2600, q: 7 });
    noise(t, 0.05, { vol: vol, filter: 'highpass', freq: 7400 });
  }

  /* ── Casino-Requisiten ── */

  /** Münze fällt ins Auszahlfach. */
  function coin(t, vol, base) {
    base = base || 1568;
    voice(base, t, 0.09, { type: 'square', vol: vol, atk: 0.002, cut: 6000 });
    voice(base * 1.5, t + 0.055, 0.17, { type: 'square', vol: vol, atk: 0.002, cut: 7000 });
  }

  /** Die Glocke über dem Automaten. */
  function bell(t, freq, vol, dur) {
    fm(freq, t, dur || 0.9, { ratio: 3.4, index: 5, vol: vol, atk: 0.003 });
    fm(freq * 2.01, t, (dur || 0.9) * 0.6, { ratio: 2.7, index: 3, vol: vol * 0.4, atk: 0.003 });
  }

  /** Anschwellendes Rauschen vor dem Drop. */
  function riser(t, dur, vol) {
    noise(t, dur, { vol: vol, filter: 'bandpass', freq: 400, sweep: 9000, q: 2, atk: dur * 0.85 });
  }

  function siren(t, dur, vol, from, to) {
    voice(from, t, dur, { type: 'sawtooth', vol: vol, glide: to, cut: 2800, detune: 12, atk: 0.02 });
  }

  /** Holt die Note, die in dieser Melodietabelle auf diesem Schritt liegt. */
  function melNote(mel, bar, s) {
    var m = mel[bar % mel.length];
    for (var i = 0; i < m.length; i++) if (m[i][0] === s) return m[i];
    return null;
  }

  /* ══════════════ Die acht Tracks ══════════════
     Jeder Track baut seinen Takt selbst zusammen. x liefert dabei:
     s     = Schritt im Takt (0–15, Sechzehntel)
     step  = fortlaufender Schrittzähler seit Start
     bar   = Takt innerhalb der Akkordfolge
     last  = letzter Takt der Phrase (für Fills)
     t     = Startzeit, beat = Länge einer Viertel in Sekunden
     root/ivs = Grundton und Intervalle des aktuellen Akkords
     Längen in den Melodietabellen zählen in Sechzehnteln: [Schritt, Ton, Länge]. */

  var TRACKS = [
    {
      id: 'lounge', name: 'Neon Lounge', mood: 'Jazz-Trio · Rhodes & Besen',
      bpm: 88, swing: 0.3, cut: 3200,
      chords: [[62, [0, 3, 7, 10]], [55, [0, 4, 7, 10]], [60, [0, 4, 7, 11]], [57, [0, 4, 7, 10]]],
      walk: [[0, 7, 10, 12], [0, 7, 10, 11], [0, 7, 11, 12], [0, 4, 7, 10]],
      mel: [
        [[6, 19, 3], [10, 17, 2], [13, 14, 3]],
        [],
        [[2, 16, 2], [5, 14, 2], [8, 12, 6]],
        [[10, 19, 2], [13, 22, 5]]
      ],
      step: function (x) {
        // Rhodes: gezupftes Comping auf der Eins und der „Und" von zwei
        if (x.s === 0 || x.s === 6 || (x.s === 11 && x.bar % 2 === 1)) {
          chordFm(x.t, x.root + 12, x.ivs, x.beat * 1.4, { ratio: 2, index: 1.6, vol: 0.075, atk: 0.01 });
        }
        // Kontrabass läuft in Vierteln durch die Akkorde
        if (x.s % 4 === 0) {
          voice(midi(x.root - 12 + this.walk[x.bar][x.s / 4]), x.t, x.beat * 0.85,
                { type: 'triangle', vol: 0.19, cut: 520 });
        }
        // Besen auf allen Achteln, Ride-Akzent auf zwei und vier
        if (x.s % 2 === 0) hat(x.t, x.s % 8 === 4 ? 0.05 : 0.026, 'brush');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.05, 'rim');
        // Vibraphon spielt die Melodie
        var m = melNote(this.mel, x.bar, x.s);
        if (m) fm(midi(x.root + 12 + m[1]), x.t, x.beat * m[2] * 0.4,
                  { ratio: 4, index: 2.2, vol: 0.09, pan: 0.3 });
        // und ganz zum Schluss klimpert eine Münze ins Fach
        if (x.last && x.s === 14) coin(x.t, 0.045, 2093);
      }
    },
    {
      id: 'deep', name: 'Tiefsee', mood: 'Ambient · Riesenpad & Glockentropfen',
      bpm: 60, swing: 0, cut: 1500,
      chords: [[50, [0, 7, 14, 19]], [53, [0, 7, 12, 17]], [48, [0, 7, 14, 21]], [55, [0, 5, 12, 17]]],
      drops: [[[4, 19]], [[6, 12], [13, 16]], [[2, 24]], [[8, 21], [14, 19]]],
      step: function (x) {
        if (x.s === 0) {
          // Pad: kriecht über den ganzen Takt herein, Stimmen nach links und rechts verteilt
          x.ivs.forEach(function (iv, i) {
            voice(midi(x.root + iv), x.t, x.beat * 4.6, {
              type: 'sine', vol: 0.11 / (i + 1.3), detune: 8,
              atk: x.beat * 1.4, cut: 1200, pan: (i % 2 ? 0.45 : -0.45)
            });
          });
          voice(midi(x.root - 24), x.t, x.beat * 4.4, { type: 'sine', vol: 0.16, atk: 0.6 });
        }
        // Glockentropfen, sparsam über die Phrase verstreut
        var list = this.drops[x.bar];
        for (var i = 0; i < list.length; i++) {
          if (list[i][0] === x.s) {
            fm(midi(x.root + 12 + list[i][1]), x.t, 2.6,
               { ratio: 3.5, index: 4, vol: 0.07, pan: i ? 0.5 : -0.5 });
          }
        }
        // einzelne Wassertropfen — kein Schlagzeug, nur Bewegung
        if (x.s === 7 || x.s === 15) {
          voice(1100 + Math.random() * 500, x.t, 0.11,
                { type: 'sine', vol: 0.035, glide: 420, atk: 0.003, pan: Math.random() * 1.2 - 0.6 });
        }
      }
    },
    {
      id: 'chips', name: 'Retro Chips', mood: 'Chiptune · Pulslead & Münz-Blips',
      bpm: 118, swing: 0, cut: 5200,
      chords: [[57, [0, 3, 7]], [53, [0, 4, 7]], [60, [0, 4, 7]], [55, [0, 4, 7]]],
      mel: [
        [[0, 12, 2], [2, 15, 2], [4, 19, 4], [8, 17, 2], [10, 15, 2], [12, 12, 4]],
        [[0, 16, 2], [4, 19, 2], [6, 21, 2], [8, 24, 6], [14, 19, 2]],
        [[0, 12, 3], [3, 16, 3], [6, 19, 2], [8, 24, 4], [12, 19, 2], [14, 16, 2]],
        [[0, 21, 2], [2, 19, 2], [4, 16, 2], [6, 12, 2], [8, 19, 6], [14, 24, 2]]
      ],
      step: function (x) {
        // NES-Trick: statt eines Akkords rasen die Akkordtöne einzeln durch
        voice(midi(x.root + 12 + x.ivs[x.step % x.ivs.length]), x.t, 0.055,
              { type: 'square', vol: 0.042, atk: 0.002 });
        // Pulsbass mit Oktavsprung
        if (x.s % 2 === 0) {
          voice(midi(x.root - 12 + (x.s % 4 === 2 ? 12 : 0)), x.t, 0.1,
                { type: 'square', vol: 0.16, cut: 1600, atk: 0.003 });
        }
        var m = melNote(this.mel, x.bar, x.s);
        if (m) voice(midi(x.root + 12 + m[1]), x.t, x.beat * m[2] * 0.22,
                     { type: 'square', vol: 0.1, cut: 4800, atk: 0.004 });
        if (x.s === 0 || x.s === 8) kick(x.t, 0.24, 'punch');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.12, 'snare');
        if (x.s % 4 === 2) hat(x.t, 0.045, 'closed');
        if (x.last && x.s === 12) coin(x.t, 0.065, 1976);
      }
    },
    {
      id: 'midnight', name: 'Mitternacht', mood: 'Boom-Bap · Staubdrums & Rauchtrompete',
      bpm: 92, swing: 0.34, cut: 2400,
      chords: [[48, [0, 3, 7, 10, 14]], [48, [0, 3, 7, 10, 14]], [53, [0, 3, 7, 10]], [51, [0, 4, 7, 10]]],
      mel: [[], [[8, 15, 4], [12, 14, 3]], [], [[4, 12, 3], [8, 10, 2], [11, 7, 5]]],
      step: function (x) {
        var boom = (x.s === 0 || x.s === 7 || x.s === 10);
        if (boom) {
          kick(x.t, 0.26, 'boom');
          voice(midi(x.root - 12), x.t, x.beat * 0.6, { type: 'sine', vol: 0.24, cut: 220 });
        }
        if (x.s === 4 || x.s === 12) snare(x.t, 0.15, 'dusty');
        if (x.s % 2 === 0) hat(x.t, x.s % 4 === 0 ? 0.04 : 0.026, x.s === 14 ? 'open' : 'closed');
        // Rhodes-Stiche fallen zwischen die Schläge
        if (x.s === 3 || x.s === 11) {
          chordFm(x.t, x.root + 12, x.ivs, x.beat * 0.5,
                  { ratio: 1.5, index: 2, vol: 0.055, pan: x.s === 3 ? -0.35 : 0.35 });
        }
        // gedämpfte Trompete, weit hinten im Raum
        var m = melNote(this.mel, x.bar, x.s);
        if (m) voice(midi(x.root + 12 + m[1]), x.t, x.beat * m[2] * 0.25,
                     { type: 'sawtooth', vol: 0.07, cut: 1300, vib: 22, vibRate: 5.5, atk: 0.06 });
        // Vinyl-Knistern unter allem
        if (Math.random() < 0.35) {
          noise(x.t + Math.random() * 0.08, 0.012, { vol: 0.012, filter: 'highpass', freq: 4200 });
        }
      }
    },

    /* ── ab hier: schnell und laut ── */

    {
      id: 'turbo', name: 'Turbo-Rausch', mood: 'Acid-Techno · 303-Bass & Kesselklick',
      bpm: 138, swing: 0, cut: 6000,
      chords: [[52, [0, 3, 7]], [52, [0, 3, 7]], [50, [0, 3, 7]], [51, [0, 4, 7]]],
      acc: [0, 3, 4, 6, 7, 10, 11, 14],
      step: function (x) {
        if (x.s % 4 === 0) kick(x.t, 0.3, 'hard');
        if (x.s % 4 === 2) hat(x.t, 0.05, 'open');
        if (x.s % 2 === 1) hat(x.t, 0.018, 'closed');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.13, 'clap');
        // 303-Linie: durchgehende Sechzehntel, das Filter wandert über die Phrase
        var acc = this.acc.indexOf(x.s) >= 0;
        var slide = (x.s === 7 || x.s === 15);
        voice(midi(x.root - 12 + (x.s % 8 === 6 ? 12 : 0) + (x.s % 5 === 3 ? 3 : 0)),
              x.t, x.beat * (slide ? 0.5 : 0.22), {
          type: 'sawtooth', vol: acc ? 0.19 : 0.11, atk: 0.004,
          cut: 320 + x.bar * 260 + (acc ? 900 : 0), sweep: 240 + x.bar * 160, q: 11
        });
        if (slide) chord(x.t, x.root + 12, x.ivs, x.beat * 0.28,
                         { type: 'sawtooth', vol: 0.085, cut: 3400, detune: 9, atk: 0.005 });
        // metallischer Klick wie die Kugel im Roulettekessel
        if (x.s === 3 || x.s === 11) hat(x.t, 0.05, 'tick');
        if (x.last && x.s >= 12) riser(x.t, x.beat, 0.045);
      }
    },
    {
      id: 'jackpot', name: 'Jackpot-Fieber', mood: 'Trance-Hymne · Supersaw & Münzregen',
      bpm: 132, swing: 0, cut: 7000,
      chords: [[53, [0, 4, 7, 11]], [55, [0, 4, 7, 10]], [57, [0, 3, 7, 10]], [60, [0, 4, 7, 11]]],
      mel: [
        [[0, 19, 6], [6, 17, 4], [10, 16, 6]],
        [[0, 17, 4], [4, 19, 8], [12, 21, 4]],
        [[0, 24, 4], [4, 21, 4], [8, 19, 4], [12, 17, 4]],
        [[0, 16, 8], [8, 19, 8]]
      ],
      step: function (x) {
        if (x.s % 4 === 0) {
          kick(x.t, 0.28, 'punch');
          voice(midi(x.root - 24), x.t, x.beat * 0.5, { type: 'sine', vol: 0.16 });
        }
        if (x.s === 4 || x.s === 12) snare(x.t, 0.11, 'clap');
        // Offbeat-Bass und offene Hi-Hat — das Trance-Fundament
        if (x.s % 4 === 2) {
          hat(x.t, 0.045, 'open');
          voice(midi(x.root - 12), x.t, x.beat * 0.22, { type: 'sawtooth', vol: 0.18, cut: 900, atk: 0.004 });
        }
        // Zupf-Arpeggio auf jedem Sechzehntel, oktavweise nach oben
        var n = x.ivs[x.step % x.ivs.length] + 12 * (Math.floor(x.step / x.ivs.length) % 2);
        voice(midi(x.root + 12 + n), x.t, 0.13,
              { type: 'sawtooth', vol: 0.055, detune: 14, cut: 3600, atk: 0.004 });
        // die große Hymne darüber
        var m = melNote(this.mel, x.bar, x.s);
        if (m) voice(midi(x.root + 12 + m[1]), x.t, x.beat * m[2] * 0.24, {
          type: 'sawtooth', vol: 0.085, detune: 11, cut: 5000, vib: 14, vibRate: 5, atk: 0.03
        });
        if (x.bar === 0 && x.s === 0) bell(x.t, 1046, 0.085, 1.1);
        // Snare-Wirbel und Münzregen als Übergang in die nächste Runde
        if (x.last && x.s >= 8) snare(x.t, 0.045 + (x.s - 8) * 0.012, 'snare');
        if (x.last && x.s >= 12) coin(x.t, 0.05, 1200 + (x.s - 12) * 260);
      }
    },
    {
      id: 'adrenalin', name: 'Adrenalin', mood: "Drum'n'Bass · Amen-Break & Reese",
      bpm: 168, swing: 0, cut: 5000,
      chords: [[53, [0, 3, 7, 10]], [53, [0, 3, 7, 10]], [58, [0, 3, 7, 10]], [56, [0, 4, 7, 10]]],
      step: function (x) {
        // gebrochener Break statt Vierviertel
        if (x.s === 0 || x.s === 10 || (x.bar % 2 === 1 && x.s === 6)) kick(x.t, 0.3, 'deep');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.17, 'snare');
        if (x.s === 7 || x.s === 15) snare(x.t, 0.045, 'snare');    // Geisternoten
        if (x.s % 2 === 1) hat(x.t, 0.022, 'closed');
        if (x.s === 14) hat(x.t, 0.045, 'open');
        // Reese-Bass: zwei weit verstimmte Sägezähne, Filter wandert über die Phrase
        if (x.s === 0 || x.s === 8) {
          voice(midi(x.root - 12), x.t, x.beat * 1.6, {
            type: 'sawtooth', vol: 0.2, detune: 26, cut: 420 + x.bar * 90, q: 5, atk: 0.02
          });
        }
        if (x.s === 3 || x.s === 11) {
          chord(x.t, x.root + 12, x.ivs, x.beat * 0.22, { type: 'square', vol: 0.065, cut: 2400, atk: 0.004 });
        }
        // hohes Ostinato springt zwischen den Kanälen
        if (x.s === 2 || x.s === 9 || x.s === 13) {
          voice(midi(x.root + 24 + x.ivs[x.s % x.ivs.length]), x.t, 0.1,
                { type: 'triangle', vol: 0.05, atk: 0.003, pan: x.s === 2 ? -0.55 : 0.55 });
        }
        if (x.last && x.s === 8) siren(x.t, x.beat * 2, 0.045, 300, 1400);
      }
    },
    {
      id: 'allin', name: 'All In', mood: 'Hardcore · Gabber-Kick & Alarmsirene',
      bpm: 176, swing: 0, cut: 6500,
      chords: [[45, [0, 3, 7]], [48, [0, 3, 7]], [43, [0, 4, 7]], [44, [0, 4, 7]]],
      riff: [0, 0, 12, 0, 3, 0, 12, 7],
      step: function (x) {
        if (x.s % 4 === 0) kick(x.t, 0.34, 'gabber');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.15, 'clap');
        if (x.s % 2 === 1) hat(x.t, 0.028, 'closed');
        // Hoover-Stich, der beim Ausklingen nach unten rutscht
        if (x.s === 2 || x.s === 10) {
          voice(midi(x.root + 12), x.t, x.beat * 0.55, {
            type: 'sawtooth', vol: 0.13, detune: 32, cut: 2600, q: 3,
            glide: midi(x.root + 5), atk: 0.01
          });
        }
        // Oktav-Riff auf Achteln
        if (x.s % 2 === 0) {
          voice(midi(x.root + 12 + this.riff[(x.s / 2) % 8]), x.t, 0.09,
                { type: 'square', vol: 0.07, cut: 4200, atk: 0.003 });
        }
        if (x.bar === 0 && x.s === 0) {
          bell(x.t, 523, 0.075, 1.4);
          noise(x.t, 0.7, { vol: 0.045, filter: 'highpass', freq: 5200 });   // Crash
        }
        if (x.last && x.s >= 8) {
          siren(x.t, x.beat * 0.5, 0.05, 500 + (x.s - 8) * 120, 1600 + (x.s - 8) * 180);
        }
      }
    }
  ];

  var Music = GK.music = {
    tracks: TRACKS,
    enabled: false,
    trackIdx: 0,
    volume: 35,
    playing: false,
    _timer: null,
    _step: 0,
    _nextTime: 0,
    _gain: null,
    _filter: null
  };

  function ensureChain() {
    GK.sound.init();
    if (!GK.sound.ready) return false;
    if (!Music._gain) {
      Music._gain = ctx().createGain();
      Music._filter = ctx().createBiquadFilter();
      Music._filter.type = 'lowpass';
      Music._filter.frequency.value = TRACKS[Music.trackIdx].cut || 3000;
      Music._gain.connect(Music._filter);
      // an den Ausgang, nicht an den SFX-Master — sonst regelt ein Regler beides
      Music._filter.connect(ctx().destination);
      applyGain();
    }
    return true;
  }

  function applyGain() {
    if (!Music._gain) return;
    var v = Music.enabled ? (Music.volume / 100) * 0.16 : 0;
    Music._gain.gain.setTargetAtTime(v, ctx().currentTime, 0.15);
  }

  /* ══════════════ Sequencer: 16 Schritte pro Takt ══════════════ */

  function scheduleStep(step, t) {
    var tr = TRACKS[Music.trackIdx];
    var bars = tr.chords.length;
    var bar = Math.floor(step / 16) % bars;
    var c = tr.chords[bar];
    tr.step({
      s: step % 16,
      step: step,
      bar: bar,
      last: bar === bars - 1,
      t: t,
      beat: 60 / tr.bpm,
      root: c[0],
      ivs: c[1]
    });
  }

  function tick() {
    if (!Music.playing || !ctx()) return;
    var tr = TRACKS[Music.trackIdx];
    var stepDur = (60 / tr.bpm) / 4;      // Sechzehntel
    while (Music._nextTime < ctx().currentTime + 0.25) {
      // Swing: die geraden Sechzehntel rutschen nach hinten, das gibt den Groove
      var sw = (Music._step % 2 === 1) ? (tr.swing || 0) * stepDur : 0;
      scheduleStep(Music._step, Music._nextTime + sw);
      Music._step++;
      Music._nextTime += stepDur;
    }
  }

  Music.start = function () {
    if (!ensureChain()) return false;
    GK.sound.resume();
    Music.enabled = true;
    applyGain();
    if (Music.playing) return true;
    Music.playing = true;
    Music._step = 0;
    Music._nextTime = ctx().currentTime + 0.1;
    Music._timer = setInterval(tick, 25);
    applyTone();
    return true;
  };

  Music.stop = function () {
    Music.enabled = false;
    applyGain();
    Music.playing = false;
    if (Music._timer) { clearInterval(Music._timer); Music._timer = null; }
  };

  /** Jeder Track bringt seine eigene Klangfarbe mit — von dumpf bis offen. */
  function applyTone() {
    if (!Music._filter) return;
    Music._filter.frequency.setTargetAtTime(
      TRACKS[Music.trackIdx].cut || 3000, ctx().currentTime, 0.2);
  }

  Music.setTrack = function (idx) {
    Music.trackIdx = GK.clamp(idx, 0, TRACKS.length - 1);
    Music._step = 0;
    if (ctx()) Music._nextTime = ctx().currentTime + 0.1;
    if (!Music.playing) Music.start();
    applyTone();
    save();
  };

  Music.setVolume = function (v) {
    Music.volume = GK.clamp(Math.round(Number(v) || 0), 0, 100);
    applyGain();
    save();
  };

  Music.toggle = function () {
    if (Music.playing && Music.enabled) Music.stop();
    else Music.start();
    save();
    return Music.enabled;
  };

  /* ── Einstellungen pro Gerät ── */
  var MKEY = 'gambaking:music';
  function save() {
    try {
      localStorage.setItem(MKEY, JSON.stringify({
        enabled: Music.enabled, trackIdx: Music.trackIdx, volume: Music.volume
      }));
    } catch (e) {}
  }
  Music.load = function () {
    try {
      var d = JSON.parse(localStorage.getItem(MKEY) || '{}');
      if (d.trackIdx !== undefined) Music.trackIdx = GK.clamp(d.trackIdx, 0, TRACKS.length - 1);
      if (d.volume !== undefined) Music.volume = d.volume;
      Music.wanted = !!d.enabled;   // erst nach der ersten Interaktion starten
    } catch (e) {}
  };

})(window.GK);
