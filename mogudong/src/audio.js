// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MDD;

const A = {
  ctx: null, master: null, plopAt: 0,

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  tone(freq, dur, type = 'square', vol = 0.22, slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, vol = 0.25, freq = 900, q = 1, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },

  // ── 효과음 ──
  // 후반엔 초당 십수 개가 떨어지므로 착지음은 최소 간격을 두고 솎아 낸다
  plop(r) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.plopAt < 0.07) return;
    this.plopAt = now;
    const f = r > 12 ? 130 : r > 8 ? 190 : 260;
    this.tone(f, 0.06, 'sine', 0.12, f * 0.55);
    this.noise(0.05, 0.09, 700, 1.4);
  },
  splat()  { this.noise(0.22, 0.34, 420, 0.9); this.tone(150, 0.22, 'square', 0.2, 60); },
  wave(n)  { this.tone(520 + n * 18, 0.1, 'square', 0.16, 780 + n * 18);
             this.tone(780 + n * 18, 0.12, 'square', 0.13, null, 0.09); },
  storm()  { this.noise(0.7, 0.24, 260, 0.6); this.tone(90, 0.6, 'sawtooth', 0.14, 55); },
  clear()  { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.18, 'square', 0.18, null, i * 0.11)); },
  over()   { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  best()   { [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, 'square', 0.16, null, i * 0.1)); },
  meow()   { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
