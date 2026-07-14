// audio.js — WebAudio 간이 효과음 (모구 시리즈 공통 문법)
var M = window.MBL;

M.audio = {
  ctx: null, on: true,
  resume: function () {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone: function (freq, dur, type, vol, slide) {
    if (!this.on || !this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  dice: function () { this.tone(240, 0.1, 'square', 0.09, 420); },
  hop: function () { this.tone(520, 0.05, 'square', 0.06, 640); },
  money: function () { this.tone(880, 0.09, 'square', 0.1, 1320); this.tone(1180, 0.12, 'square', 0.07); },
  pay: function () { this.tone(300, 0.16, 'sawtooth', 0.09, 170); },
  buy: function () { this.tone(660, 0.1, 'square', 0.1, 880); setTimeout(this.tone.bind(this, 990, 0.14, 'square', 0.09), 90); },
  card: function () { this.tone(740, 0.08, 'triangle', 0.12, 980); },
  island: function () { this.tone(320, 0.3, 'sawtooth', 0.1, 150); },
  festival: function () { this.tone(620, 0.1, 'square', 0.1, 930); setTimeout(this.tone.bind(this, 930, 0.16, 'square', 0.08), 110); },
  bankrupt: function () { this.tone(280, 0.5, 'sawtooth', 0.12, 90); },
  win: function () { var a = this; [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(a.tone.bind(a, f, 0.22, 'square', 0.1), i * 140); }); },
  turn: function () { this.tone(440, 0.07, 'triangle', 0.08, 560); },
};
