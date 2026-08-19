/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Hintergrundmusik
   Sechs Techno-Loops, komplett per Web Audio erzeugt. Jeder Track hat
   seine eigene Besetzung, sein eigenes Schlagzeug und sein eigenes
   Tempo — vom schleppenden Dub-Keller bis zur Industrial-Stahlplatte.
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
      id: 'neon', name: 'Neonflucht', mood: 'Melodic Techno · Fünfer-Arpeggio & Sog',
      bpm: 128, swing: 0, cut: 4800,
      chords: [
        [45, [0, 3, 7, 10]], [50, [0, 3, 7, 10]], [43, [0, 4, 7, 11]], [48, [0, 3, 7, 10]],
        [45, [0, 3, 7, 10]], [50, [0, 3, 7, 10]], [46, [0, 4, 7, 10]], [41, [0, 3, 7, 10]]
      ],
      /* Fünf Töne gegen sechzehn Schritte: das Arpeggio steht erst nach fünf
         Takten wieder auf der Eins. Dieselben Töne, nie dieselbe Betonung. */
      arp: [0, 7, 12, 3, 10],
      mel: [
        [], [],
        [[0, 15, 6], [6, 12, 4], [10, 10, 6]],
        [[2, 19, 6], [10, 15, 6]],
        [], [],
        [[0, 22, 4], [4, 19, 4], [8, 15, 8]],
        [[0, 12, 16]]
      ],
      step: function (x) {
        if (x.s % 4 === 0) kick(x.t, 0.27, 'punch');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.1, 'clap');
        // Offbeat: Bass und offene Hi-Hat schieben zwischen die Kicks
        if (x.s % 4 === 2) {
          hat(x.t, 0.04, 'open');
          voice(midi(x.root - 12), x.t, x.beat * 0.24,
                { type: 'sawtooth', vol: 0.17, cut: 780, atk: 0.004 });
        }
        if (x.s % 2 === 1) hat(x.t, 0.014, 'closed');
        // Pad legt sich unter den ganzen Takt
        if (x.s === 0) {
          chord(x.t, x.root, x.ivs, x.beat * 3.9, {
            type: 'sawtooth', vol: 0.05, detune: 12, atk: x.beat * 0.9, cut: 1400, q: 1.5
          });
        }
        /* Das Arpeggio wandert alle zwei Takte eine Oktave höher und wieder
           zurück — der Sog, der das Stück trägt. */
        var okt = 12 * (Math.floor(x.step / 32) % 2);
        voice(midi(x.root + 12 + okt + this.arp[x.step % this.arp.length]), x.t, 0.12, {
          type: 'sawtooth', vol: 0.06, detune: 10, cut: 2600 + (x.step % 64) * 45,
          atk: 0.004, pan: (x.step % this.arp.length) / 2.5 - 0.8
        });
        // Die Melodie kommt erst in der zweiten Hälfte der Phrase dazu
        var m = melNote(this.mel, x.bar, x.s);
        if (m) {
          voice(midi(x.root + 12 + m[1]), x.t, x.beat * m[2] * 0.22, {
            type: 'sawtooth', vol: 0.075, detune: 8, cut: 3800,
            vib: 10, vibRate: 4.5, atk: 0.04
          });
        }
        if (x.last && x.s >= 10) riser(x.t, x.beat * 0.8, 0.035);
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
      id: 'strobo', name: 'Stroboskop', mood: 'Industrial · Stahlplatte & Blechhall',
      bpm: 142, swing: 0, cut: 6400,
      chords: [[41, [0, 3, 7]], [41, [0, 3, 7]], [44, [0, 3, 7]], [39, [0, 4, 7]]],
      step: function (x) {
        /* Das Stück läuft in zwei Gesichtern, jedes vier Takte lang: erst
           stur und trocken, dann rollend und offen. Danach von vorn. */
        var teil = Math.floor(x.step / 64) % 2;

        /* Der Gabber-Kick läuft durch den Verzerrer, und der macht aus 0.26
           schon fast Vollausschlag — tanh(0.26 · 4) ist 0.78. Was hier klein
           aussieht, ist in Wahrheit der lauteste Klang des ganzen Stücks. */
        if (x.s % 4 === 0) kick(x.t, 0.11, 'gabber');
        // in der zweiten Hälfte kommt ein Doppelschlag vor jeder Eins dazu
        if (teil === 1 && x.s === 14) kick(x.t, 0.07, 'gabber');
        if (x.s === 4 || x.s === 12) snare(x.t, 0.13, 'clap');
        if (teil === 1 && x.s === 14) snare(x.t, 0.06, 'clap');

        if (x.s % 2 === 1) hat(x.t, teil ? 0.024 : 0.014, 'closed');
        if (teil === 1 && x.s % 4 === 2) hat(x.t, 0.035, 'open');

        /* Der Bass ist gegattert: jeder dritte Schritt fällt weg. Weil drei
           und sechzehn nichts gemeinsam haben, sitzt das Loch in jedem Takt
           woanders.

           Die Lautstärke muss hier niedriger stehen als anderswo: der Bass
           läuft auf zwei Dritteln aller Sechzehntel mit, und mit dem Wert der
           übrigen Stücke stapelte er sich mit dem verzerrten Kick bis über
           die Aussteuerungsgrenze. */
        if (x.step % 3 !== 0) {
          voice(midi(x.root - 12), x.t, x.beat * 0.18, {
            type: 'sawtooth', vol: 0.105, cut: 300 + (x.step % 48) * 60, q: 8, atk: 0.003
          });
        }
        /* Stahlplatte: schepperndes FM mit krummem Verhältnis, springt quer
           durch das Stereobild. */
        if (x.step % 4 === 1 || x.step % 9 === 5) {
          fm(midi(x.root + 24), x.t, 0.11, {
            ratio: 5.7, index: 7, vol: 0.07, atk: 0.002,
            pan: ((x.step % 5) / 2) - 1
          });
        }
        // ein trockener Stich auf der Drei, aber nur im harten Teil
        if (teil === 0 && x.s === 8) {
          chord(x.t, x.root + 12, x.ivs, x.beat * 0.18, {
            type: 'square', vol: 0.07, cut: 2200, atk: 0.003
          });
        }
        // Blechhall: alle acht Takte fegt ein Rauschen durch
        if (x.step % 128 === 112) {
          noise(x.t, x.beat * 4, { vol: 0.05, filter: 'bandpass', freq: 700, sweep: 8000, q: 1.4, atk: x.beat * 3 });
        }
        if (x.last && x.s >= 8 && x.s % 2 === 0) tom(x.t, 0.1, 150 + (x.s - 8) * 30);
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
        enabled: Music.enabled, track: TRACKS[Music.trackIdx].id, volume: Music.volume
      }));
    } catch (e) {}
  }
  Music.load = function () {
    try {
      var d = JSON.parse(localStorage.getItem(MKEY) || '{}');
      /* Gemerkt wird die Kennung, nicht die Position in der Liste: sonst
         landet man nach einer Aenderung an der Liste auf einem fremden Stueck.
         Alte Stände haben noch eine Nummer — die zaehlt weiter, solange sie
         passt. */
      if (d.track) {
        for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === d.track) Music.trackIdx = i;
      } else if (d.trackIdx !== undefined) {
        Music.trackIdx = GK.clamp(d.trackIdx, 0, TRACKS.length - 1);
      }
      if (d.volume !== undefined) Music.volume = d.volume;
      Music.wanted = !!d.enabled;   // erst nach der ersten Interaktion starten
    } catch (e) {}
  };

})(window.GK);
