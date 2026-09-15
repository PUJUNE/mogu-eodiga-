// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
// 연필 사각거림·종이 넘김 같은 스케치 질감을 노이즈 필터로 만든다
const M = window.MSK;

const A = {
  ctx: null, master: null, lastHit: 0,

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

  tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, when = 0) {
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

  noise(dur, vol = 0.25, freq = 900, q = 1, when = 0, sweepTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },

  // ── 효과음 ──
  scratch() { this.noise(0.08, 0.10, 3200, 2.5); },                                 // 연필 획
  swing(strong) { this.noise(strong ? 0.16 : 0.1, 0.12, strong ? 900 : 1600, 1.2, 0, strong ? 400 : 900); },
  hit(strong) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.03) return;
    this.lastHit = now;
    this.noise(strong ? 0.2 : 0.1, strong ? 0.42 : 0.3, strong ? 380 : 650, 0.9);
    this.tone(strong ? 120 : 190, strong ? 0.18 : 0.09, 'square', 0.2, strong ? 55 : 90);
  },
  block() { this.noise(0.06, 0.24, 2400, 3); this.tone(900, 0.04, 'triangle', 0.1); },
  grab() { this.noise(0.12, 0.2, 500, 1); this.tone(160, 0.25, 'sawtooth', 0.14, 70, 0.06); },
  fireball() { this.noise(0.3, 0.2, 700, 1.4, 0, 2400); this.tone(330, 0.2, 'triangle', 0.14, 660); },
  shuriken() { this.noise(0.08, 0.16, 4200, 3); },
  jump() { this.tone(300, 0.08, 'sine', 0.08, 480); },
  land() { this.noise(0.14, 0.3, 220, 0.8); },
  page() { this.noise(0.35, 0.28, 1800, 0.7, 0, 500); },                             // 종이 넘김
  super() { this.page(); [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.16, 'square', 0.15, null, 0.1 + i * 0.07)); },
  eraser() { this.noise(0.6, 0.22, 1400, 0.5, 0, 700); },
  bell() { this.tone(1320, 0.5, 'sine', 0.2); this.tone(1980, 0.35, 'sine', 0.08, null, 0.02); },
  fight() { this.bell(); this.tone(523, 0.1, 'square', 0.14, null, 0.25); this.tone(784, 0.18, 'square', 0.14, null, 0.36); },
  ko() { this.tone(220, 0.6, 'sawtooth', 0.2, 60); this.noise(0.5, 0.3, 300, 0.7); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'square', 0.16, null, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.18, null, i * 0.2)); },
  select() { this.tone(660, 0.06, 'square', 0.1, 880); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
