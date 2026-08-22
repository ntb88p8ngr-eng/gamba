/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Hintergrundmusik
   Fuenf Techno-Loops, komplett per Web Audio erzeugt. Jeder Track hat
   seine eigene Besetzung, sein eigenes Schlagzeug und sein eigenes
   Tempo — vom schleppenden Dub-Keller bis zum Acid-Rausch.
   Keine Audio-Dateien, kein Nachladen, jederzeit abschaltbar.

   Ein Loop, der sich alle vier Takte wörtlich wiederholt, wird nach
   zwei Minuten unerträglich. Deshalb hängt hier möglichst wenig am
   Takt selbst: Zähler, die mit sechzehn nichts gemeinsam haben (drei,
   fünf, sechs, sieben, dreiundzwanzig), verschieben Hi-Hats, Stiche und
   Bassläufe von Takt zu Takt, Filter wandern über Dutzende Takte, und
   mehrere Stücke wechseln nach vier oder acht Takten die Besetzung.
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

  /**
   * Verzerrer für den Gabber-Kick.
   *
   * Die Kennlinie hat bewusst eine ungerade Zahl von Stützstellen. Bei einer
   * geraden liegt die Eingangsnull genau zwischen zwei Werten, und heraus
   * kommt ein winziger Gleichspannungsversatz — bei Stille, dauerhaft. Weil
   * jeder Schlag seinen eigenen Verzerrer bekommt, summierte sich das: nach
   * einer Viertelminute lag ein Versatz von 0.15 auf der Summe, mehr als der
   * eigentliche Klang. Mit ungerader Länge trifft die Mitte exakt die Null.
   */
  function shaper() {
    var c = ctx();
    if (!CURVE) {
      var N = 1025, m = (N - 1) / 2;
      CURVE = new Float32Array(N);
      for (var i = 0; i < N; i++) CURVE[i] = Math.tanh((i / m - 1) * 4);
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
    var ws = null;
    if (kind === 'gabber') { ws = shaper(); g.connect(ws); ws.connect(Music._gain); }
    else g.connect(Music._gain);
    o.start(t); o.stop(t + spec[2] + 0.05);
    /* Aufräumen. Ein Oszillator hängt sich nach dem Stoppen selbst ab, ein
       Verzerrer nicht — der bliebe für den Rest der Sitzung am Mischpult. */
    if (ws) o.onended = function () { try { ws.disconnect(); g.disconnect(); } catch (e) {} };
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

  /** Tom für Wirbel am Phrasenende — fällt in der Tonhöhe ab. */
  function tom(t, vol, freq) {
    voice(freq, t, 0.16, { type: 'sine', vol: vol, atk: 0.002, glide: freq * 0.6 });
    noise(t, 0.05, { vol: vol * 0.25, filter: 'bandpass', freq: freq * 4, q: 1.2 });
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

  /* ══════════════ Die neun Tracks ══════════════
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
      id: 'keller', name: 'Kellergewölbe', mood: 'Dub-Techno · Hallakkord & Vinylstaub',
      bpm: 122, swing: 0, cut: 2600,
      /* Acht Takte statt vier — die Harmonie kommt erst nach doppelt so langer
         Zeit wieder an derselben Stelle an. */
      chords: [
        [48, [0, 3, 7, 10]], [48, [0, 3, 7, 10]], [46, [0, 4, 7, 10]], [48, [0, 3, 7, 10]],
        [53, [0, 3, 7, 10]], [51, [0, 4, 7, 10]], [46, [0, 3, 7, 10]], [43, [0, 4, 7, 10]]
      ],
      step: function (x) {
        // Der Raum atmet über 32 Takte: das Filter fährt langsam auf und wieder zu
        var atem = 0.5 + 0.5 * Math.sin(x.step / 128);
        if (x.s % 4 === 0) kick(x.t, 0.3, 'deep');
        // Sub auf der Eins, ein Schub auf der Und-von-drei
        if (x.s === 0) voice(midi(x.root - 24), x.t, x.beat * 1.7, { type: 'sine', vol: 0.2, atk: 0.02 });
        if (x.s === 10) voice(midi(x.root - 24 + 7), x.t, x.beat * 0.5, { type: 'sine', vol: 0.13 });
        if (x.s === 4 || x.s === 12) snare(x.t, 0.055, 'rim');
        /* Die Hi-Hats laufen in Sechsern und Zwölfern gegen den Viervierteltakt.
           Erst nach drei Takten steht wieder dasselbe Muster über derselben
           Kick — man hört nie zweimal hintereinander dasselbe. */
        if (x.step % 6 === 1) hat(x.t, 0.02, 'closed');
        if (x.step % 12 === 7) hat(x.t, 0.032, 'open');
        // Der Dub-Akkord und seine drei Echos, jedes leiser und weiter im Raum
        if ((x.bar % 2 === 0 && x.s === 6) || (x.bar === 5 && x.s === 14)) {
          for (var e = 0; e < 4; e++) {
            chord(x.t + e * x.beat * 0.75, x.root + 12, x.ivs, x.beat * (0.5 + e * 0.2), {
              type: 'sawtooth', vol: 0.085 * Math.pow(0.55, e), detune: 7, atk: 0.012,
              cut: 700 + atem * 2400 - e * 120, q: 2, pan: e % 2 ? 0.5 : -0.5
            });
          }
        }
        /* Vinylstaub. Zwei teilerfremde Zähler sorgen dafür, dass die Knackser
           nie ins Raster fallen — genau das macht sie glaubhaft. */
        if (x.step % 23 === 5 || x.step % 31 === 11) {
          noise(x.t, 0.012, { vol: 0.022, filter: 'highpass', freq: 3000,
                              pan: (x.step % 7) / 7 - 0.5 });
        }
        if (x.last && x.s >= 12) riser(x.t, x.beat, 0.03);
      }
    },
    {
      id: 'nebel', name: 'Nebelkammer', mood: 'Dub-Techno · Rhodes-Wolke & Bandecho',
      bpm: 116, swing: 0, cut: 2000,
      /* Der zweite Dub-Track, und bewusst anders gebaut als der erste:
         langsamer, der Akkord kommt aus einer FM-Stimme statt aus Sägezähnen,
         das Echo steht auf punktierten Vierteln statt auf Achteln, und die
         Betonung liegt auf der Drei statt auf zwei und vier. Zwei Stücke mit
         demselben Handgriff wären zwei Mal dasselbe Stück. */
      chords: [
        [45, [0, 3, 7, 10, 14]], [45, [0, 3, 7, 10, 14]],
        [43, [0, 4, 7, 11, 14]], [50, [0, 3, 7, 10, 14]],
        [48, [0, 3, 7, 10, 14]], [46, [0, 4, 7, 10, 14]],
        [41, [0, 3, 7, 10, 17]], [43, [0, 3, 7, 10, 14]]
      ],
      step: function (x) {
        /* Zwei Atmungen übereinander, mit unterschiedlicher Länge: so trifft
           dieselbe Kombination erst nach vielen Takten wieder zusammen. */
        var weit = 0.5 + 0.5 * Math.sin(x.step / 173);
        var eng = 0.5 + 0.5 * Math.sin(x.step / 61);

        if (x.s % 4 === 0) kick(x.t, 0.29, 'boom');
        /* Sub liegt lang und legt sich unter zwei Schläge. */
        if (x.s === 0) voice(midi(x.root - 24), x.t, x.beat * 2.2,
                             { type: 'sine', vol: 0.21, atk: 0.03 });
        if (x.s === 11) voice(midi(x.root - 24 + 5), x.t, x.beat * 0.7,
                              { type: 'sine', vol: 0.12, atk: 0.02 });

        /* Betonung auf der Drei — nicht auf zwei und vier wie üblich. */
        if (x.s === 8) snare(x.t, 0.05, 'rim');
        /* Besen in Siebenern, mit einem lauteren Schlag alle elf Schritte. */
        if (x.step % 7 === 2) hat(x.t, 0.018, 'brush');
        if (x.step % 11 === 5) hat(x.t, 0.03, 'brush');

        /* Die Rhodes-Wolke: ein FM-Akkord und drei Wiederholungen im Abstand
           einer punktierten Viertel. Das Echo trägt weiter als der Akkord
           selbst und wandert dabei von links nach rechts. */
        if ((x.bar % 2 === 1 && x.s === 4) || (x.bar === 6 && x.s === 12)) {
          for (var e = 0; e < 4; e++) {
            chordFm(x.t + e * x.beat * 1.5, x.root + 12, x.ivs, x.beat * (1.1 + e * 0.35), {
              ratio: 2, index: 1.1 + eng * 1.6,
              vol: 0.085 * Math.pow(0.6, e), atk: 0.02,
              pan: e % 2 ? 0.55 : -0.55
            });
          }
        }
        /* Ein einzelner Ton der Melodica, weit oben, alle vier Takte. */
        if (x.bar % 4 === 3 && x.s === 6) {
          fm(midi(x.root + 24 + x.ivs[3]), x.t, x.beat * 2.4, {
            ratio: 3, index: 1.4, vol: 0.05, atk: 0.12, pan: 0.25
          });
        }
        /* Bandrauschen: die ganze Zeit da, aber nur zu ahnen. Es folgt der
           langsamen Atmung, damit es nicht als gleichmäßiges Zischen auffällt. */
        if (x.s % 8 === 0) {
          noise(x.t, x.beat * 2.1, {
            vol: 0.006 + weit * 0.008, filter: 'bandpass',
            freq: 1800 + weit * 2600, q: 0.6, atk: x.beat
          });
        }
      }
    },
    {
      id: 'beton', name: 'Betonwiese', mood: 'Minimal · Krumme Kick & Holzblock',
      bpm: 134, swing: 0.12, cut: 4200,
      chords: [
        [47, [0, 3, 7, 10]], [47, [0, 3, 7, 10]], [45, [0, 3, 7, 10]], [52, [0, 4, 7, 10]]
      ],
      /* Zwei Takte lang, nicht einer: die Kick sitzt im zweiten Takt anders als
         im ersten, und genau das trägt das ganze Stück. 1 = Kick. */
      kicks: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0,
              1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      /* Basslauf über zwei Takte, null heisst Pause. */
      bass: [0, null, null, 0, null, 7, null, null, 3, null, 0, null, null, 10, null, null,
             0, null, 12, null, 7, null, null, 3, null, null, 0, null, 5, null, null, null],
      step: function (x) {
        var z = x.step % 32;
        /* Jeder vierte Takt lässt die Kick weg — der Boden fällt kurz weg und
           kommt danach doppelt so hart zurück. */
        var loch = Math.floor(x.step / 16) % 8 === 7;
        if (this.kicks[z] && !loch) kick(x.t, 0.3, 'boom');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.075, 'rim');
        if (loch && x.s % 2 === 0) snare(x.t, 0.05, 'clap');
        // Shaker mit wechselndem Akzent
        if (x.s % 2 === 1) hat(x.t, x.s % 8 === 3 ? 0.03 : 0.014, 'closed');
        if (x.step % 16 === 14) hat(x.t, 0.035, 'open');
        // Holzblock in Siebenern — die Zutat, die den Takt schief zieht
        if (x.step % 7 === 3) hat(x.t, 0.045, 'tick');
        var b = this.bass[z];
        if (b !== null && b !== undefined) {
          voice(midi(x.root - 12 + b), x.t, x.beat * 0.3, {
            type: 'square', vol: 0.16, cut: 620 + (z * 18), q: 4, atk: 0.004
          });
        }
        // Glockenstich, alle fünf Schritte, dadurch nie auf derselben Zählzeit
        if (x.step % 5 === 0 && x.step % 16 !== 0) {
          fm(midi(x.root + 24 + x.ivs[(x.step / 5) % x.ivs.length]), x.t, 0.22, {
            ratio: 3.5, index: 2.4, vol: 0.045, atk: 0.003,
            pan: ((x.step / 5) % 3) - 1
          });
        }
        if (x.last && x.s >= 12) {
          tom(x.t, 0.09, 180 - (x.s - 12) * 22);
        }
      }
    },
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
      id: 'saeure', name: 'Säurebad', mood: 'Acid-Techno · Zwei 303 im Wechsel',
      bpm: 130, swing: 0, cut: 5200,
      chords: [
        [49, [0, 3, 7]], [49, [0, 3, 7]], [47, [0, 4, 7]], [54, [0, 3, 7]],
        [49, [0, 3, 7]], [52, [0, 3, 7]], [45, [0, 4, 7]], [47, [0, 3, 7]]
      ],
      /* Die Linie als Tabelle statt als Formel: [Halbton, Betonung, Bindung],
         null ist eine Pause. Genau die Pausen unterscheiden dieses Stück vom
         Turbo-Rausch — dort läuft die 303 durch, hier atmet sie. Eine
         gebundene Note klingt länger und lässt das Filter weiter wandern,
         das ist das typische Rutschen einer 303. */
      linie: [
        [0, 1, 0], null, [0, 0, 0], [12, 0, 1],
        [10, 0, 0], null, [0, 1, 0], [3, 0, 1],
        [0, 0, 0], [7, 0, 0], null, [12, 1, 0],
        [10, 0, 1], [0, 0, 0], null, [15, 1, 1]
      ],
      step: function (x) {
        /* Das Filter folgt einer eigenen, langsamen Welle statt der Taktzahl.
           Über sechsundzwanzig Takte hinweg öffnet und schließt es sich einmal
           — im Turbo-Rausch springt es dagegen bei jedem Taktwechsel. */
        var welle = 0.5 + 0.5 * Math.sin(x.step / 67);

        if (x.s % 4 === 0) kick(x.t, 0.3, 'hard');
        /* Ein zusätzlicher Schlag vor der Eins, aber nur in der zweiten
           Hälfte der Phrase. */
        if (x.bar >= 4 && x.s === 14) kick(x.t, 0.19, 'hard');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.09, 'rim');
        if (x.s % 2 === 1) hat(x.t, x.s % 4 === 3 ? 0.034 : 0.017, 'closed');
        if (x.step % 6 === 4) hat(x.t, 0.04, 'open');
        if (x.step % 9 === 2) hat(x.t, 0.04, 'tick');

        var n = this.linie[x.s];
        if (n) {
          /* Erste Hälfte tief, zweite Hälfte eine Oktave höher: dieselbe
             Linie, anderer Charakter — die beiden 303 im Wechselgespräch. */
          var hoch = x.bar >= 4;
          var laenge = x.beat * (n[2] ? 0.62 : 0.2);
          var basis = 240 + welle * 1500 + (n[1] ? 1100 : 0) + (hoch ? 700 : 0);
          voice(midi(x.root - 12 + n[0] + (hoch ? 12 : 0)), x.t, laenge, {
            type: 'sawtooth', vol: n[1] ? 0.22 : 0.125, atk: 0.004,
            cut: basis, sweep: 200 + welle * 900, q: 13
          });
        }
        /* Kurzes Kreischen ganz oben — selten und nie auf derselben Zählzeit. */
        if (x.step % 47 === 11) {
          voice(midi(x.root + 24), x.t, x.beat * 0.5, {
            type: 'sawtooth', vol: 0.055, atk: 0.006,
            cut: 2600 + welle * 3000, sweep: 700, q: 16, pan: 0.4
          });
        }
        if (x.bar === 3 && x.s === 0) {
          noise(x.t, 0.55, { vol: 0.04, filter: 'highpass', freq: 5400 });   // Crash
        }
        if (x.last && x.s >= 10) riser(x.t, x.beat * 0.9, 0.04);
      }
    },
  ];

  var Music = GK.music = {
    tracks: TRACKS,
    _wunschId: '',
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

  /* ── Stücke aus dem Sound-Pack ────────────────────────────────────
     Die eingebauten Stücke entstehen im Browser Ton für Ton. Daneben darf
     jedes Pack eigene Musik als fertige Datei mitbringen (Block "music" in
     assets/sfx/sounds.json) — die läuft nicht durch den Sequenzer, sondern
     als ganz gewöhnliches Audio-Element in Schleife.

     Beides steht in derselben Liste, damit die Auswahl im Musikfenster
     nichts davon wissen muss. `datei: true` unterscheidet sie. */
  var audio = null;              // Element für Datei-Stücke, einmal angelegt

  function packLaden() {
    if (!GK.sfxPack || !GK.sfxPack.musik) return;
    var neu = GK.sfxPack.musik();
    if (!neu.length) return;
    /* Zweimal einlesen (etwa nach GK.sfxPack.reload()) soll die Liste nicht
       verdoppeln: gleiche Kennung, gleicher Platz. */
    neu.forEach(function (t) {
      var da = -1;
      for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === t.id) da = i;
      if (da >= 0) TRACKS[da] = t; else TRACKS.push(t);
    });
    /* Beim Start war das gemerkte Stück vielleicht noch gar nicht da —
       jetzt schon. */
    if (Music._wunschId) {
      for (var k = 0; k < TRACKS.length; k++) {
        /* Ein reines Sender-Stück nur dann, wenn auch der Sender wieder
           anläuft — sonst hinge man nach dem Neuladen auf einem Titel, den
           die Auswahl gar nicht anbietet. */
        if (TRACKS[k].nurRadio && !Music._radioWunsch && !Music.radio.an) continue;
        if (TRACKS[k].id === Music._wunschId && TRACKS[k] !== TRACKS[Music.trackIdx]) {
          Music.trackIdx = k;
          if (Music.enabled && Music.playing) { Music.playing = false; Music.start(); }
        }
      }
    }
    if (GK.emit) GK.emit('musik-liste');
  }

  /**
   * Welche Stücke gehören zum laufenden Anstrich?
   *
   * Ein Stück ohne `skins` erscheint überall. Steht dort eine Liste, taucht
   * es nur unter diesen Skins auf — Old Vegas darf seine eigene Musik haben,
   * ohne dass sie im Standard-Anstrich in der Auswahl steht.
   *
   * Zurück kommen Paare aus Stück und echter Position, damit setTrack()
   * weiterhin mit der Position in TRACKS arbeitet.
   */
  function zumAnstrich() {
    var skin = GK.skin ? GK.skin() : 'default';
    var raus = [];
    TRACKS.forEach(function (t, i) {
      if (!t.skins || t.skins.indexOf(skin) >= 0) raus.push({ track: t, idx: i });
    });
    return raus;
  }

  /**
   * Alles, was der Sender spielen darf — auch die Stücke, die nur zum
   * Radio gehören.
   */
  Music.fuerRadio = zumAnstrich;

  /**
   * Was in der Stückauswahl steht.
   *
   * Dasselbe wie oben, abzüglich der Stücke mit `nurRadio`. Ein Sender wie
   * Vegas FM bringt zehn Titel mit; stünden die alle einzeln in der Liste,
   * bliebe von der Auswahl nichts als eine Titelliste. Sie laufen im Radio,
   * und dort gehören sie hin.
   */
  Music.sichtbar = function () {
    return zumAnstrich().filter(function (x) { return !x.track.nurRadio; });
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

  /* ── Radio ────────────────────────────────────────────────────────
     Ein Sender ist eine Reihenfolge von Stücken, die von selbst
     weiterläuft. Die eingebauten Loops enden nie von allein — für sie
     zählt eine Uhr; eine Datei wechselt, wenn sie durch ist.

     Der Sender „Bunt gemischt" braucht keinen Eintrag: er nimmt alles,
     was zum laufenden Anstrich gehört, und mischt es. Weitere Sender
     kommen aus dem Sound-Pack (Block "radio" in sounds.json). */
  var EIGEN_SENDER = {
    id: 'bunt', name: 'Bunt gemischt', was: 'Alles, was zum Anstrich passt — gemischt',
    tracks: null, mischen: true, dauer: 210,
    /* Der eingebaute Sender gehört zu Old Vegas: dort passt ein Radio ins
       Bild, im Standard-Anstrich bleibt es bei der Stückauswahl. Wie bei
       den Sendern aus dem Pack ist das nur eine Liste von Anstrichen —
       null hieße „überall". */
    skins: ['old-vegas']
  };

  Music.radio = { an: false, sender: '', reihe: [], pos: 0, _uhr: null };

  /** Alle Sender, die zum laufenden Anstrich passen. */
  Music.sender = function () {
    var skin = GK.skin ? GK.skin() : 'default';
    var liste = [];
    if (!EIGEN_SENDER.skins || EIGEN_SENDER.skins.indexOf(skin) >= 0) liste.push(EIGEN_SENDER);
    if (GK.sfxPack && GK.sfxPack.radio) {
      GK.sfxPack.radio().forEach(function (r) {
        if (!r.skins || r.skins.indexOf(skin) >= 0) liste.push(r);
      });
    }
    return liste;
  };

  function senderVon(id) {
    var alle = Music.sender();
    for (var i = 0; i < alle.length; i++) if (alle[i].id === id) return alle[i];
    /* Kennt der laufende Anstrich diesen Sender nicht, hilft der erste, den
       es hier gibt — und wenn es gar keinen gibt, der eingebaute als
       Notnagel, damit senderVon nie undefined liefert. */
    return alle[0] || EIGEN_SENDER;
  }

  /** Die Reihenfolge eines Senders aufbauen — als echte Positionen in TRACKS. */
  function reiheBauen(sender) {
    var erlaubt = Music.fuerRadio();
    var raus = [];
    if (sender.tracks) {
      /* Feste Liste: die Reihenfolge des Senders zählt, und was es nicht
         gibt (oder nicht zum Anstrich passt), fällt still weg. */
      sender.tracks.forEach(function (id) {
        erlaubt.forEach(function (x) { if (x.track.id === id) raus.push(x.idx); });
      });
    } else {
      erlaubt.forEach(function (x) { raus.push(x.idx); });
    }
    if (sender.mischen && raus.length > 2) {
      for (var i = raus.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = raus[i]; raus[i] = raus[j]; raus[j] = t;
      }
    }
    return raus;
  }

  function uhrAus() {
    if (Music.radio._uhr) { clearTimeout(Music.radio._uhr); Music.radio._uhr = null; }
  }

  /** Uhr für das laufende Stück stellen — nur die erzeugten Loops brauchen sie. */
  function uhrStellen() {
    uhrAus();
    if (!Music.radio.an || istDatei()) return;
    var sender = senderVon(Music.radio.sender);
    Music.radio._uhr = setTimeout(function () {
      Music.radio._uhr = null;
      Music.weiter();
    }, sender.dauer * 1000);
  }

  /** Nächstes Stück im Sender. Am Ende der Reihe geht es von vorn los. */
  Music.weiter = function () {
    if (!Music.radio.an) return;
    if (!Music.radio.reihe.length) { Music.radioAus(); return; }
    Music.radio.pos = (Music.radio.pos + 1) % Music.radio.reihe.length;
    /* Nur einmal durch: war die Reihe zu Ende, wird für die nächste Runde
       neu gemischt — sonst hört man ewig dieselbe Abfolge. */
    if (Music.radio.pos === 0) {
      Music.radio.reihe = reiheBauen(senderVon(Music.radio.sender));
    }
    spieleIntern(Music.radio.reihe[Music.radio.pos]);
    if (GK.emit) GK.emit('musik-liste');
  };

  /** Stück wechseln, ohne das Radio abzuschalten. */
  function spieleIntern(idx) {
    var vorher = Music.trackIdx;
    Music.trackIdx = GK.clamp(idx, 0, TRACKS.length - 1);
    Music._step = 0;
    if (ctx()) Music._nextTime = ctx().currentTime + 0.1;
    if (istDatei(vorher) && !istDatei()) dateiAus();
    Music.playing = false;
    Music.start();
    applyTone();
    save();
  }

  Music.radioAn = function (id) {
    var sender = senderVon(id || Music.radio.sender || EIGEN_SENDER.id);
    Music.radio.an = true;
    Music.radio.sender = sender.id;
    Music.radio.reihe = reiheBauen(sender);
    Music.radio.pos = 0;
    if (!Music.radio.reihe.length) { Music.radio.an = false; return false; }
    spieleIntern(Music.radio.reihe[0]);
    if (GK.emit) GK.emit('musik-liste');
    return true;
  };

  Music.radioAus = function () {
    Music.radio.an = false;
    uhrAus();
    if (audio) audio.loop = true;
    /* Lief gerade ein Stück, das nur zum Sender gehört, kann es hier nicht
       weiterlaufen: es steht in keiner Liste, die Auswahl zeigte also
       Musik ohne markiertes Stück. Also zurück auf das erste, das man auch
       selbst hätte wählen können. */
    var erlaubt = Music.sichtbar();
    if (TRACKS[Music.trackIdx].nurRadio && erlaubt.length) {
      var lief = Music.enabled && Music.playing;
      dateiAus();                       // das Sender-Stück läuft sonst weiter
      Music.trackIdx = erlaubt[0].idx;
      Music._step = 0;
      Music.playing = false;
      if (lief) Music.start();
    }
    save();
    if (GK.emit) GK.emit('musik-liste');
  };

  /* ── Datei-Stücke ──
     Ein Audio-Element in Schleife, mehr braucht es nicht. Es hängt bewusst
     nicht am Audio-Kontext: die Lautstärke regelt derselbe Regler, aber der
     Klangfilter der eingebauten Stücke hat hier nichts zu suchen — die
     Datei klingt so, wie sie gemischt wurde. */
  function dateiElement() {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'none';
      audio.addEventListener('error', function () {
        var tr = TRACKS[Music.trackIdx];
        if (GK.toast) GK.toast('Musikdatei nicht abspielbar: ' + (tr && tr.name), 'bad', '🎵');
        /* Im Radio hält eine kaputte Datei die Sendung nicht auf. */
        if (Music.radio.an) setTimeout(Music.weiter, 400);
      });
      /* Im Radio läuft eine Datei einmal durch und gibt dann weiter; ohne
         Radio wiederholt sie sich wie ein Loop. */
      audio.addEventListener('ended', function () {
        if (Music.radio.an) Music.weiter();
      });
    }
    audio.loop = !Music.radio.an;
    return audio;
  }

  function dateiLautstaerke() {
    if (!audio) return;
    var tr = TRACKS[Music.trackIdx];
    var eigen = tr && tr.volume !== undefined ? tr.volume : 1;
    audio.volume = Math.max(0, Math.min(1, (Music.volume / 100) * 0.9 * eigen));
  }

  function dateiAus() {
    if (audio && !audio.paused) audio.pause();
  }

  /** Läuft gerade ein Stück aus einer Datei? */
  function istDatei(i) {
    var tr = TRACKS[i === undefined ? Music.trackIdx : i];
    return !!(tr && tr.datei);
  }

  Music.start = function () {
    Music.enabled = true;
    if (istDatei()) {
      /* Der Generator schweigt, solange eine Datei läuft. */
      if (Music._timer) { clearInterval(Music._timer); Music._timer = null; }
      applyGain();
      var a = dateiElement();
      var tr = TRACKS[Music.trackIdx];
      if (a.dataset.quelle !== tr.url) { a.src = tr.url; a.dataset.quelle = tr.url; }
      dateiLautstaerke();
      Music.playing = true;
      /* Ohne vorherige Interaktion lehnt der Browser das Abspielen ab —
         das ist kein Fehler, sondern die übliche Regel; wir merken uns
         nur den Wunsch und starten beim nächsten Klick. */
      var p = a.play();
      if (p && p.catch) p.catch(function () { Music.playing = false; });
      uhrStellen();
      return true;
    }
    dateiAus();
    if (!ensureChain()) return false;
    GK.sound.resume();
    applyGain();
    if (Music.playing) return true;
    Music.playing = true;
    Music._step = 0;
    Music._nextTime = ctx().currentTime + 0.1;
    Music._timer = setInterval(tick, 25);
    applyTone();
    uhrStellen();
    return true;
  };

  Music.stop = function () {
    Music.enabled = false;
    applyGain();
    dateiAus();
    Music.playing = false;
    if (Music._timer) { clearInterval(Music._timer); Music._timer = null; }
    /* Die Senderwahl bleibt stehen: wer die Musik wieder anmacht, hört das
       Radio weiter. Nur die Uhr läuft nicht durch die Pause. */
    uhrAus();
  };

  /** Jeder Track bringt seine eigene Klangfarbe mit — von dumpf bis offen. */
  function applyTone() {
    if (!Music._filter) return;
    Music._filter.frequency.setTargetAtTime(
      TRACKS[Music.trackIdx].cut || 3000, ctx().currentTime, 0.2);
  }

  Music.setTrack = function (idx) {
    /* Wer selbst ein Stück wählt, schaltet das Radio ab — die eigene Wahl
       gewinnt gegen die Sendung. */
    if (Music.radio.an) Music.radioAus();
    var vorher = Music.trackIdx;
    Music.trackIdx = GK.clamp(idx, 0, TRACKS.length - 1);
    Music._step = 0;
    if (ctx()) Music._nextTime = ctx().currentTime + 0.1;
    /* Beim Wechsel weg von einer Datei muss die auch wirklich aufhören —
       sie läuft sonst unter dem neuen Stück weiter. */
    if (istDatei(vorher) && !istDatei()) dateiAus();
    if (istDatei()) { Music.playing = false; Music.start(); }
    else if (!Music.playing) Music.start();
    applyTone();
    save();
  };

  Music.setVolume = function (v) {
    Music.volume = GK.clamp(Math.round(Number(v) || 0), 0, 100);
    applyGain();
    dateiLautstaerke();
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
        enabled: Music.enabled, track: TRACKS[Music.trackIdx].id, volume: Music.volume,
        radio: Music.radio.an ? Music.radio.sender : ''
      }));
    } catch (e) {}
  }
  /* Das Sound-Pack kommt asynchron — sobald es da ist, wandern seine Stücke
     in die Liste. Und wer den Anstrich wechselt, soll nicht plötzlich Musik
     hören, die zum anderen Skin gehört. */
  GK.on('sfx-pack', packLaden);
  GK.on('skin', function () {
    packLaden();
    /* Läuft ein Sender, den es unter dem neuen Anstrich nicht gibt, hört die
       Sendung auf — sonst spielte ein Radio weiter, das nirgends mehr steht. */
    if (Music.radio.an) {
      var gibt = false;
      Music.sender().forEach(function (sd) { if (sd.id === Music.radio.sender) gibt = true; });
      if (!gibt) Music.radioAus();
    }
    /* Gehört das laufende Stück überhaupt hierher? Das entscheidet der
       Anstrich, nicht die Auswahlliste — ein Sender-Stück steht dort nie
       und würde sonst bei jedem Anstrichwechsel weggeschaltet, obwohl es
       gerade völlig richtig läuft. Der Ersatz kommt dagegen aus der
       Auswahl: darauf soll man auch von Hand kommen können. */
    var passt = Music.fuerRadio().some(function (x) { return x.idx === Music.trackIdx; });
    var erlaubt = Music.sichtbar();
    if (passt || !erlaubt.length) { if (GK.emit) GK.emit('musik-liste'); return; }
    /* Das laufende Stück gehört nicht hierher — auf das erste erlaubte
       umschalten, aber nur weiterspielen, wenn vorher etwas lief. */
    var lief = Music.enabled && Music.playing;
    Music.trackIdx = erlaubt[0].idx;
    if (lief) { Music.playing = false; Music.start(); } else { dateiAus(); }
    save();
    if (GK.emit) GK.emit('musik-liste');
  });

  Music.load = function () {
    try {
      var d = JSON.parse(localStorage.getItem(MKEY) || '{}');
      /* Gemerkt wird die Kennung, nicht die Position in der Liste: sonst
         landet man nach einer Aenderung an der Liste auf einem fremden Stueck.
         Alte Stände haben noch eine Nummer — die zaehlt weiter, solange sie
         passt. */
      if (d.track) {
        /* Gemerkt wird auch der Wunsch selbst: ein Stück aus dem Sound-Pack
           steht beim Laden noch nicht in der Liste (packLaden holt es nach). */
        Music._wunschId = d.track;
        for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === d.track) Music.trackIdx = i;
      } else if (d.trackIdx !== undefined) {
        Music.trackIdx = GK.clamp(d.trackIdx, 0, TRACKS.length - 1);
      }
      if (d.volume !== undefined) Music.volume = d.volume;
      /* Der Sender wird nur gemerkt, nicht gestartet — das passiert wie bei
         der Musik selbst erst nach der ersten Interaktion. */
      if (d.radio) Music._radioWunsch = d.radio;
      Music.wanted = !!d.enabled;   // erst nach der ersten Interaktion starten
    } catch (e) {}
  };

})(window.GK);
