// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 모구 어디가와 같은 방식)
const M = window.SMG;

const A = {
  ctx: null, master: null,

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
  jump()    { this.tone(260, 0.16, 'square', 0.15, 620); },
  stomp()   { this.tone(340, 0.08, 'square', 0.16, 120); },
  coin()    { [988, 1319].forEach((f, i) => this.tone(f, 0.09, 'square', 0.15, null, i * 0.06)); },
  bump()    { this.tone(120, 0.07, 'square', 0.14, 90); },
  brk()     { this.noise(0.14, 0.2, 900, 0.8); },
  sprout()  { [523, 587, 659, 784].forEach((f, i) => this.tone(f, 0.07, 'square', 0.13, null, i * 0.05)); },
  grow()    { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.08, 'square', 0.15, null, i * 0.05)); },
  shrink()  { [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.08, 'square', 0.14, null, i * 0.05)); },
  shoot()   { this.tone(700, 0.07, 'square', 0.12, 1100); },
  kick()    { this.noise(0.08, 0.18, 2000, 1.2); },
  starman() { [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.1, 'square', 0.14, null, i * 0.07)); },
  die()     { [523, 392, 262, 196, 131].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, null, i * 0.12)); },
  clear(n)  { const seq = n >= 3 ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
              seq.forEach((f, i) => this.tone(f, 0.14, 'square', 0.17, null, i * 0.09)); },
  bosshit() { this.tone(200, 0.16, 'sawtooth', 0.2, 80); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
