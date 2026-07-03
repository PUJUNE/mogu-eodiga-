// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 모구 어디가와 같은 방식)
const M = window.MDG;

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
  swing()   { this.noise(0.06, 0.14, 2200, 1.4); },
  hit()     { this.tone(160, 0.07, 'square', 0.22, 110); this.noise(0.06, 0.2, 900, 1); },
  kd()      { this.tone(120, 0.16, 'square', 0.26, 60); this.noise(0.14, 0.26, 500, 0.8); },
  hurt()    { this.tone(280, 0.14, 'sawtooth', 0.18, 120); },
  jump()    { this.tone(260, 0.1, 'triangle', 0.1, 420); },
  edown()   { this.tone(440, 0.09, 'square', 0.15, 660); this.tone(660, 0.1, 'square', 0.12, 880, 0.06); },
  pickup()  { [880, 1320].forEach((f, i) => this.tone(f, 0.09, 'square', 0.15, null, i * 0.06)); },
  wave()    { this.tone(330, 0.14, 'sawtooth', 0.16, 220); },
  go()      { [523, 659].forEach((f, i) => this.tone(f, 0.12, 'square', 0.16, null, i * 0.08)); },
  bossintro(){ [220, 220, 180].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.22, 140, i * 0.24)); },
  buddyup() { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.09, 'square', 0.14, null, i * 0.06)); },
  clear(n)  { const seq = n >= 3 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
              seq.forEach((f, i) => this.tone(f, 0.16, 'square', 0.18, null, i * 0.1)); },
  over()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.16, null, i * 0.07)); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
  cluck()   { [620, 780, 620].forEach((f, i) => this.tone(f, 0.07, 'square', 0.12, null, i * 0.07)); },
};

M.audio = A;
