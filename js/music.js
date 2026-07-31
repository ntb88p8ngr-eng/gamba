/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Hintergrundmusik
   Acht Loops, komplett per Web Audio erzeugt: vier ruhige und vier
   schnelle. Keine Audio-Dateien, kein Nachladen — jederzeit abschaltbar.
   ═══════════════════════════════════════════════════════════ */
(function (GK) {
  'use strict';

  /* Akkorde als MIDI-Grundton + Intervalle */
  var TRACKS = [
    {
      id: 'lounge', name: 'Neon Lounge', mood: 'ruhig, jazzig',
      bpm: 84,
      chords: [[57, [0, 3, 7, 10]], [62, [0, 3, 7, 10]], [64, [0, 3, 7, 10]], [60, [0, 4, 7, 11]]],
      pad: 0.16, bass: 0.20, arp: 0.10, arpSteps: [0, 4, 6, 10, 12, 14],
      hats: 0, kick: 0, wave: 'sine', arpWave: 'triangle'
    },
    {
      id: 'deep', name: 'Tiefsee', mood: 'schwebend, langsam',
      bpm: 66,
      chords: [[55, [0, 7, 12, 16]], [53, [0, 7, 12, 17]], [50, [0, 7, 12, 15]], [57, [0, 7, 12, 15]]],
      pad: 0.20, bass: 0.14, arp: 0.07, arpSteps: [0, 6, 11],
      hats: 0, kick: 0, wave: 'sine', arpWave: 'sine'
    },
    {
      id: 'chips', name: 'Retro Chips', mood: 'chiptune, treibend',
      bpm: 112,
      chords: [[57, [0, 3, 7]], [65, [0, 4, 7]], [60, [0, 4, 7]], [55, [0, 4, 7]]],
      pad: 0.07, bass: 0.22, arp: 0.13, arpSteps: [0, 2, 4, 6, 8, 10, 12, 14],
      hats: 0.09, kick: 0.26, wave: 'square', arpWave: 'square'
    },
    {
      id: 'midnight', name: 'Mitternacht', mood: 'dunkel, groovy',
      bpm: 94,
      chords: [[52, [0, 3, 7, 10]], [52, [0, 3, 7, 10]], [57, [0, 3, 7, 10]], [56, [0, 4, 7, 10]]],
      pad: 0.13, bass: 0.24, arp: 0.08, arpSteps: [3, 7, 11, 14],
      hats: 0.06, kick: 0.22, wave: 'triangle', arpWave: 'triangle'
    },

    /* ── ab hier: schnell und laut ── */
    {
      id: 'turbo', name: 'Turbo-Rausch', mood: 'treibend, Vollgas',
      bpm: 140,
      chords: [[57, [0, 3, 7]], [53, [0, 4, 7]], [60, [0, 4, 7]], [55, [0, 4, 7]]],
      pad: 0.06, wave: 'sawtooth',
      bass: 0.24, bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], bassLen: 0.35,
      arp: 0.11, arpWave: 'square', arpMode: 'up', arpLen: 0.4,
      arpSteps: [0, 2, 4, 6, 8, 10, 12, 14],
      stab: 0.10, stabSteps: [7, 15], stabWave: 'sawtooth',
      kick: 0.30, kickSteps: [0, 4, 8, 12],
      snare: 0.16, snareSteps: [4, 12],
      hats: 0.07, hatSteps: [2, 6, 10, 14]
    },
    {
      id: 'jackpot', name: 'Jackpot-Fieber', mood: 'euphorisch, hymnisch',
      bpm: 128,
      chords: [[53, [0, 4, 7, 11]], [55, [0, 4, 7]], [57, [0, 3, 7]], [60, [0, 4, 7]]],
      pad: 0.12, wave: 'sawtooth',
      bass: 0.22, bassSteps: [0, 3, 6, 8, 11, 14], bassLen: 0.5,
      arp: 0.13, arpWave: 'square', arpMode: 'up', arpLen: 0.45,
      arpSteps: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
      stab: 0.09, stabSteps: [6, 14],
      kick: 0.28, kickSteps: [0, 4, 8, 12],
      snare: 0.14, snareSteps: [4, 12],
      hats: 0.06, hatSteps: [1, 3, 5, 7, 9, 11, 13, 15]
    },
    {
      id: 'adrenalin', name: 'Adrenalin', mood: 'hektisch, dunkel',
      bpm: 152,
      chords: [[50, [0, 3, 7, 10]], [50, [0, 3, 7, 10]], [55, [0, 3, 7, 10]], [51, [0, 4, 7, 10]]],
      pad: 0.07, wave: 'sawtooth',
      bass: 0.26, bassSteps: [0, 3, 4, 7, 8, 11, 12, 15], bassLen: 0.3,
      arp: 0.10, arpWave: 'square', arpMode: 'up', arpLen: 0.3,
      arpSteps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      kick: 0.30, kickSteps: [0, 6, 8, 14],
      snare: 0.17, snareSteps: [4, 12],
      hats: 0.05, hatSteps: [2, 6, 10, 14]
    },
    {
      id: 'allin', name: 'All In', mood: 'brachial, kein Halten',
      bpm: 170,
      chords: [[45, [0, 3, 7]], [48, [0, 3, 7]], [43, [0, 4, 7]], [44, [0, 4, 7]]],
      pad: 0.05, wave: 'sawtooth',
      bass: 0.28, bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], bassLen: 0.28,
      arp: 0.12, arpWave: 'sawtooth', arpMode: 'up', arpLen: 0.28,
      arpSteps: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15],
      stab: 0.11, stabSteps: [3, 11], stabWave: 'square',
      kick: 0.32, kickSteps: [0, 3, 4, 8, 11, 12],
      snare: 0.18, snareSteps: [4, 12],
      hats: 0.07, hatSteps: [1, 3, 5, 7, 9, 11, 13, 15]
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
    _arpN: 0,
    _nextTime: 0,
    _gain: null,
    _filter: null
  };

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function ctx() { return GK.sound.ctx; }

  function ensureChain() {
    GK.sound.init();
    if (!GK.sound.ready) return false;
    if (!Music._gain) {
      Music._gain = ctx().createGain();
      Music._filter = ctx().createBiquadFilter();
      Music._filter.type = 'lowpass';
      Music._filter.frequency.value = 2600;
      Music._filterBase = 2600;
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

  /* ── einzelne Stimmen ── */

  function voice(freq, t, dur, type, vol, glideTo) {
    var c = ctx();
    var o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Music._gain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** Kurzer Akkord-Stich — gibt schnellen Tracks den Druck. */
  function stab(t, root, ivs, dur, type, vol) {
    ivs.forEach(function (iv, i) {
      voice(midi(root + iv), t, dur, type, vol / (i + 1.3));
    });
  }

  function drum(t, kind, vol) {
    var c = ctx();
    if (kind === 'snare') {
      var len = 0.16;
      var buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      var src = c.createBufferSource(); src.buffer = buf;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
      var g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(bp); bp.connect(g); g.connect(Music._gain);
      src.start(t); src.stop(t + len);
      // etwas Körper darunter
      var o = c.createOscillator(), og = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(190, t);
      og.gain.setValueAtTime(vol * 0.5, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(og); og.connect(Music._gain);
      o.start(t); o.stop(t + 0.12);
      return;
    }
    if (kind === 'kick') {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(Music._gain);
      o.start(t); o.stop(t + 0.26);
    } else {
      var len = 0.05;
      var buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var src = c.createBufferSource(); src.buffer = buf;
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      var g2 = c.createGain();
      g2.gain.setValueAtTime(vol, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(hp); hp.connect(g2); g2.connect(Music._gain);
      src.start(t); src.stop(t + len);
    }
  }

  /* ── Sequencer: 16 Schritte pro Takt ── */

  var DEFAULT_BASS = [0, 6, 10];
  var DEFAULT_KICK = [0, 8];
  var DEFAULT_HATS = [1, 3, 5, 7, 9, 11, 13, 15];

  function scheduleStep(step, t) {
    var tr = TRACKS[Music.trackIdx];
    var bar = Math.floor(step / 16) % tr.chords.length;
    var s = step % 16;
    var chord = tr.chords[bar];
    var root = chord[0], ivs = chord[1];
    var beat = 60 / tr.bpm;

    // Pad: einmal pro Takt, lang und leise
    if (s === 0 && tr.pad) {
      ivs.forEach(function (iv, i) {
        voice(midi(root + iv), t, beat * 3.6, tr.wave, tr.pad / (i + 1.6));
      });
    }

    // Bass
    var bassSteps = tr.bassSteps || DEFAULT_BASS;
    if (tr.bass && bassSteps.indexOf(s) >= 0) {
      voice(midi(root - 12), t, beat * (tr.bassLen || 0.9), 'triangle',
            tr.bass * (s === 0 ? 1 : 0.75));
    }

    // Arpeggio — 'up' läuft sauber die Akkordtöne hoch, sonst gestreut
    if (tr.arp && tr.arpSteps.indexOf(s) >= 0) {
      var note;
      if (tr.arpMode === 'up') {
        var n = Music._arpN++;
        var len = ivs.length;
        note = root + 12 + ivs[n % len] + 12 * Math.floor((n % (len * 2)) / len);
      } else {
        note = root + 12 + ivs[(step + s) % ivs.length];
      }
      voice(midi(note), t, beat * (tr.arpLen || 0.55), tr.arpWave, tr.arp);
    }

    // Akkord-Stiche
    if (tr.stab && tr.stabSteps && tr.stabSteps.indexOf(s) >= 0) {
      stab(t, root + 12, ivs, beat * 0.3, tr.stabWave || 'sawtooth', tr.stab);
    }

    // Drums
    var kickSteps = tr.kickSteps || DEFAULT_KICK;
    var hatSteps = tr.hatSteps || DEFAULT_HATS;
    if (tr.kick && kickSteps.indexOf(s) >= 0) drum(t, 'kick', tr.kick);
    if (tr.snare && tr.snareSteps && tr.snareSteps.indexOf(s) >= 0) drum(t, 'snare', tr.snare);
    if (tr.hats && hatSteps.indexOf(s) >= 0) {
      drum(t, 'hat', tr.hats * (s % 4 === 3 ? 1 : 0.6));
    }
  }

  function tick() {
    if (!Music.playing || !ctx()) return;
    var tr = TRACKS[Music.trackIdx];
    var stepDur = (60 / tr.bpm) / 4;      // Sechzehntel
    while (Music._nextTime < ctx().currentTime + 0.25) {
      scheduleStep(Music._step, Music._nextTime);
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
    Music._arpN = 0;
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

  /** Ruhige Tracks weicher filtern, schnelle offener lassen. */
  function applyTone() {
    if (!Music._filter) return;
    var tr = TRACKS[Music.trackIdx];
    Music._filter.frequency.setTargetAtTime(tr.bpm >= 125 ? 5200 : 2600, ctx().currentTime, 0.2);
  }

  Music.setTrack = function (idx) {
    Music.trackIdx = GK.clamp(idx, 0, TRACKS.length - 1);
    Music._step = 0;
    Music._arpN = 0;
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
