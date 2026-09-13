// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MDR;

const A = {
  ctx: null, master: null, shotAt: 0, hurtAt: 0,

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.38;
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

  // ── 효과음 ── (연사음·피격음은 최소 간격을 두고 솎아 낸다)
  shoot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.shotAt < 0.09) return;
    this.shotAt = now;
    this.tone(880, 0.05, 'square', 0.05, 440);
  },
  hurt() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.hurtAt < 0.06) return;
    this.hurtAt = now;
    this.noise(0.04, 0.08, 1800, 2);
  },
  clank()   { this.tone(1400, 0.05, 'triangle', 0.08, 700); },
  kill()    { this.noise(0.16, 0.24, 500, 0.9); this.tone(220, 0.14, 'square', 0.14, 80); },
  coin()    { this.tone(1320, 0.07, 'square', 0.1); this.tone(1760, 0.1, 'square', 0.1, null, 0.06); },
  item()    { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.09, 'triangle', 0.16, null, i * 0.07)); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.16, null, i * 0.08)); },
  fever()   { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'sawtooth', 0.14, null, i * 0.07)); },
  bomb()    { this.noise(0.6, 0.4, 300, 0.5); this.tone(120, 0.5, 'sawtooth', 0.2, 40); },
  hit()     { this.noise(0.25, 0.32, 380, 0.8); this.tone(200, 0.3, 'square', 0.2, 60); },
  shield()  { this.tone(900, 0.2, 'sine', 0.18, 300); },
  boss()    { this.tone(90, 0.7, 'sawtooth', 0.22, 60); this.noise(0.5, 0.2, 200, 0.6); this.tone(70, 0.6, 'sawtooth', 0.2, 50, 0.6); },
  bossdead(){ [196, 262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.2, 'square', 0.18, null, i * 0.1)); this.noise(0.7, 0.35, 260, 0.5); },
  wave(n)   { this.tone(520 + n * 18, 0.1, 'square', 0.14, 780 + n * 18); },
  clear()   { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.2, 'square', 0.18, null, i * 0.11)); },
  over()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  best()    { [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, 'square', 0.16, null, i * 0.1)); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
