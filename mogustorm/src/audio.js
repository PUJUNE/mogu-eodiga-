// audio.js — WebAudio 합성 무드 패드 + SFX (외부 파일 없음)
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var A = (NS.Audio = {});

  var ctx = null;
  var master = null;
  var padNodes = [];
  var curMood = null;
  A.muted = false;

  // 무드별 코드 (주파수 Hz) — warm: 장화음, tense: 단2도 긴장, sad: 단조, storm: 저음 불협
  var MOODS = {
    warm: { freqs: [130.8, 164.8, 196.0, 246.9], gain: 0.05, wob: 0.15 },
    tense: { freqs: [110.0, 116.5, 174.6], gain: 0.045, wob: 0.6 },
    sad: { freqs: [110.0, 130.8, 164.8, 220.0], gain: 0.05, wob: 0.1 },
    storm: { freqs: [55.0, 82.4, 87.3, 110.0], gain: 0.06, wob: 1.2 }
  };

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = A.muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function stopPad() {
    padNodes.forEach(function (n) {
      try {
        n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        n.o.stop(ctx.currentTime + 2);
      } catch (e) {}
    });
    padNodes = [];
  }

  A.setMood = function (mood) {
    if (mood === curMood) return;
    curMood = mood;
    if (!ensureCtx()) return;
    stopPad();
    var m = MOODS[mood] || MOODS.sad;
    m.freqs.forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(m.gain, ctx.currentTime, 1.2);
      // 느린 진폭 흔들림 (바람 느낌)
      var lfo = ctx.createOscillator();
      lfo.frequency.value = m.wob * (0.7 + i * 0.21);
      var lg = ctx.createGain();
      lg.gain.value = m.gain * 0.45;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
      o.connect(g);
      g.connect(master);
      o.start();
      padNodes.push({ o: o, g: g, lfo: lfo });
    });
  };

  function blip(freq, dur, type, vol) {
    if (!ensureCtx()) return;
    var o = ctx.createOscillator();
    o.type = type || "square";
    o.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.value = vol || 0.06;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  A.sfxClick = function () { blip(880, 0.05, "square", 0.03); };
  A.sfxChoice = function () { blip(523, 0.09, "triangle", 0.07); setTimeout(function () { blip(784, 0.12, "triangle", 0.07); }, 70); };
  A.sfxEnding = function (tone) {
    // 톤 높을수록 밝은 아르페지오, 낮을수록 하강 단조
    var seq = tone >= 4 ? [523, 659, 784, 1047] : tone >= 2 ? [440, 523, 659, 587] : [330, 311, 262, 196];
    seq.forEach(function (f, i) {
      setTimeout(function () { blip(f, 0.35, "triangle", 0.09); }, i * 160);
    });
  };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (master) master.gain.value = A.muted ? 0 : 1;
    return A.muted;
  };

  A.unlock = function () { ensureCtx(); };
})();
