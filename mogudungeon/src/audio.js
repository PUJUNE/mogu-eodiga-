// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MDN;

const A = {
  ctx: null, master: null, hitAt: 0,

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
  swing()   { this.noise(0.08, 0.14, 1500, 1.5); },
  hit(kd) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.hitAt < 0.05) return;
    this.hitAt = now;
    this.noise(kd ? 0.2 : 0.1, kd ? 0.34 : 0.22, kd ? 300 : 600, 0.9); this.tone(kd ? 120 : 220, 0.1, 'square', 0.16, 60);
  },
  phit()    { this.noise(0.22, 0.3, 380, 0.8); this.tone(180, 0.28, 'square', 0.2, 60); },
  kill()    { this.tone(300, 0.12, 'sawtooth', 0.14, 90); this.noise(0.15, 0.2, 500, 0.9); },
  coin()    { this.tone(1320, 0.07, 'square', 0.1); this.tone(1760, 0.1, 'square', 0.1, null, 0.06); },
  item()    { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.09, 'triangle', 0.16, null, i * 0.07)); },
  chest()   { this.tone(400, 0.08, 'square', 0.14, 600); [784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', 0.14, null, 0.1 + i * 0.08)); },
  levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.14, 'square', 0.16, null, i * 0.08)); },
  skill(cls) {
    if (cls === 'mage') { this.noise(0.4, 0.3, 700, 0.7); this.tone(200, 0.4, 'sawtooth', 0.16, 900); }
    else if (cls === 'cleric') { [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.16, null, i * 0.06)); }
    else if (cls === 'thief') { for (let i = 0; i < 3; i++) this.noise(0.06, 0.16, 2000, 2, i * 0.05); }
    else { this.noise(0.35, 0.3, 900, 1.2); this.tone(500, 0.3, 'square', 0.14, 150); }
  },
  nomp()    { this.tone(220, 0.12, 'square', 0.12, 160); },
  efire()   { this.tone(900, 0.12, 'sawtooth', 0.1, 300); },
  smash()   { this.noise(0.4, 0.4, 200, 0.5); this.tone(70, 0.4, 'sawtooth', 0.22, 40); },
  breath()  { this.noise(0.8, 0.3, 500, 0.4); },
  go()      { [660, 880].forEach((f, i) => this.tone(f, 0.12, 'square', 0.14, null, i * 0.12)); },
  boss()    { this.tone(90, 0.7, 'sawtooth', 0.22, 60); this.noise(0.5, 0.2, 200, 0.6); this.tone(70, 0.6, 'sawtooth', 0.2, 50, 0.6); },
  bossdead(){ [196, 262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.2, 'square', 0.18, null, i * 0.1)); this.noise(0.7, 0.35, 260, 0.5); },
  stage()   { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.18, null, i * 0.12)); },
  clear()   { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.2, 'square', 0.18, null, i * 0.11)); },
  over()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  coinIn()  { this.tone(1200, 0.05, 'square', 0.16); this.tone(1800, 0.14, 'square', 0.16, null, 0.06); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
