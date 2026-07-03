// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MBK;

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
  launch()  { this.tone(320, 0.1, 'triangle', 0.14, 620); },
  wall()    { this.tone(480, 0.04, 'square', 0.08, 420); },
  paddle()  { this.tone(300, 0.06, 'square', 0.14, 380); },
  brick()   { this.tone(620, 0.07, 'square', 0.16, 880); this.noise(0.05, 0.12, 2200, 1.2); },
  crack()   { this.tone(420, 0.05, 'square', 0.13, 360); },
  clank()   { this.tone(180, 0.09, 'square', 0.16, 140); this.noise(0.06, 0.14, 600, 2); },
  mogudrop(){ [660, 880].forEach((f, i) => this.tone(f, 0.09, 'square', 0.13, null, i * 0.06)); },
  rescue()  { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.11, 'square', 0.16, null, i * 0.07)); },
  mogulost(){ this.tone(330, 0.2, 'triangle', 0.14, 180); },
  balllost(){ [392, 294, 220].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.18, null, i * 0.12)); },
  over()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  clear(n)  { const seq = n >= 3 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
              seq.forEach((f, i) => this.tone(f, 0.16, 'square', 0.18, null, i * 0.1)); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
