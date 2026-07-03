// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MDV;

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
  swing()   { this.noise(0.08, 0.14, 2400, 1.2); this.tone(800, 0.05, 'sawtooth', 0.05, 1300); },
  hit()     { this.tone(180, 0.07, 'square', 0.2, 120); this.noise(0.05, 0.16, 1000, 1); },
  kill()    { this.tone(440, 0.09, 'square', 0.14, 660); this.tone(660, 0.1, 'square', 0.11, 880, 0.06); },
  grab()    { [700, 1050].forEach((f, i) => this.tone(f, 0.08, 'square', 0.14, null, i * 0.05)); },
  deposit() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.11, 'square', 0.15, null, i * 0.07)); },
  quota()   { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.16, null, i * 0.08)); },
  dash()    { this.noise(0.16, 0.14, 1200, 0.7); },
  hurt()    { this.tone(260, 0.14, 'sawtooth', 0.18, 110); },
  o2low()   { [880, 880].forEach((f, i) => this.tone(f, 0.12, 'square', 0.14, 700, i * 0.18)); },
  o2full()  { this.tone(660, 0.1, 'sine', 0.1, 990); },
  faint()   { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, null, i * 0.16)); },
  bossintro(){ [200, 200, 160].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.22, 130, i * 0.24)); },
  bosstele(){ this.tone(1100, 0.09, 'square', 0.08, 850); },
  spikes()  { this.noise(0.14, 0.2, 2600, 1.2); },
  zap()     { this.noise(0.22, 0.3, 2400, 0.5); this.tone(150, 0.26, 'sawtooth', 0.2, 55); },
  ink()     { this.noise(0.12, 0.14, 700, 0.8); },
  bosshit() { this.tone(150, 0.08, 'square', 0.22, 100); this.noise(0.07, 0.2, 800, 1); },
  bossdown(){ this.tone(120, 0.3, 'sawtooth', 0.24, 45); this.noise(0.3, 0.28, 500, 0.7); },
  clear(n)  { const seq = n >= 3 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
              seq.forEach((f, i) => this.tone(f, 0.16, 'square', 0.18, null, i * 0.1)); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
