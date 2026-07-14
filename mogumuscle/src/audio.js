// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MMS;

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
  bell()     { [880, 880, 880].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.22, null, i * 0.45)); },
  swing()    { this.noise(0.08, 0.1, 2000, 1.4); },
  bounce()   { this.noise(0.12, 0.14, 1200, 1); this.tone(220, 0.1, 'square', 0.1, 320); },
  punch()    { this.noise(0.09, 0.22, 600, 0.8); this.tone(160, 0.08, 'square', 0.14, 90); },
  throwSlam(){ this.tone(320, 0.18, 'sawtooth', 0.16, 90); this.noise(0.22, 0.28, 400, 0.7, 0.12); },
  lariat()   { this.noise(0.2, 0.3, 500, 0.7); this.tone(200, 0.2, 'sawtooth', 0.2, 70); },
  special()  { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.2, null, i * 0.05));
               this.noise(0.3, 0.32, 450, 0.7, 0.2); },
  kd()       { this.tone(110, 0.3, 'sawtooth', 0.24, 50); this.noise(0.25, 0.2, 300, 0.7); },
  tag()      { [660, 990].forEach((f, i) => this.tone(f, 0.09, 'square', 0.16, null, i * 0.07)); },
  ball()     { [880, 1100, 1320].forEach((f, i) => this.tone(f, 0.07, 'triangle', 0.13, null, i * 0.05)); },
  powered()  { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.09, 'square', 0.15, null, i * 0.06)); },
  ko()       { this.tone(80, 0.5, 'sawtooth', 0.26, 40); },
  tick()     { this.tone(880, 0.05, 'square', 0.1); },
  clear(n)   { const seq = n >= 3 ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
               seq.forEach((f, i) => this.tone(f, 0.16, 'square', 0.18, null, i * 0.1)); },
  over()     { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  meow()     { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
  cluck()    { [740, 620].forEach((f, i) => this.tone(f, 0.08, 'square', 0.12, null, i * 0.09)); },
};

M.audio = A;
