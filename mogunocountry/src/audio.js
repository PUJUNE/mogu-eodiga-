// audio.js — WebAudio 합성 무드 패드 + SFX (외부 파일 없음)
// 원작 톤에 맞춰 선율을 거의 쓰지 않고 지속음·저역 불협·바람 흔들림으로 긴장을 만든다.
(function () {
  "use strict";
  var NS = (window.MNC = window.MNC || {});
  var A = (NS.Audio = {});

  var ctx = null;
  var master = null;
  var padNodes = [];
  var curMood = null;
  A.muted = false;

  // dry: 사막의 건조한 지속음 · tense: 추격 · dread: 슈거 · sorrow: 상실 · calm: 벨의 회상
  var MOODS = {
    dry: { freqs: [98.0, 146.8, 196.0], gain: 0.042, wob: 0.09 },
    tense: { freqs: [110.0, 116.5, 174.6], gain: 0.045, wob: 0.62 },
    dread: { freqs: [49.0, 51.9, 73.4, 98.0], gain: 0.058, wob: 1.35 },
    sorrow: { freqs: [110.0, 130.8, 164.8, 220.0], gain: 0.05, wob: 0.12 },
    calm: { freqs: [130.8, 164.8, 196.0, 246.9], gain: 0.046, wob: 0.14 }
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
    var m = MOODS[mood] || MOODS.dry;
    m.freqs.forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(m.gain, ctx.currentTime, 1.2);
      // 느린 진폭 흔들림 (사막 바람 느낌)
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
  // 동전 던지기 — 금속성 두 음
  A.sfxCoin = function () {
    blip(2093, 0.09, "triangle", 0.05);
    setTimeout(function () { blip(2637, 0.22, "triangle", 0.045); }, 90);
  };
  A.sfxEnding = function (tone) {
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
