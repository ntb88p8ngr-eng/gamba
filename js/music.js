/* ═══════════════════════════════════════════════════════════
   GAMBAKING — Hintergrundmusik
   Vier minimalistische Loops, komplett per Web Audio erzeugt.
   Keine Audio-Dateien, kein Nachladen — und jederzeit abschaltbar.
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

  function drum(t, kind, vol) {
    var c = ctx();
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
    if (tr.bass && (s === 0 || s === 6 || s === 10)) {
      voice(midi(root - 12), t, beat * 0.9, 'triangle', tr.bass * (s === 0 ? 1 : 0.7));
    }
    // Arpeggio
    if (tr.arp && tr.arpSteps.indexOf(s) >= 0) {
      var note = root + 12 + ivs[(step + s) % ivs.length];
      voice(midi(note), t, beat * 0.55, tr.arpWave, tr.arp);
    }
    // Drums
    if (tr.kick && (s === 0 || s === 8)) drum(t, 'kick', tr.kick);
    if (tr.hats && s % 2 === 1) drum(t, 'hat', tr.hats * (s % 4 === 3 ? 1 : 0.6));
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
    Music._nextTime = ctx().currentTime + 0.1;
    Music._timer = setInterval(tick, 25);
    return true;
  };

  Music.stop = function () {
    Music.enabled = false;
    applyGain();
    Music.playing = false;
    if (Music._timer) { clearInterval(Music._timer); Music._timer = null; }
  };

  Music.setTrack = function (idx) {
    Music.trackIdx = GK.clamp(idx, 0, TRACKS.length - 1);
    Music._step = 0;
    if (ctx()) Music._nextTime = ctx().currentTime + 0.1;
    if (!Music.playing) Music.start();
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
