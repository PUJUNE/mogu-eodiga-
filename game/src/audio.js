// audio.js — WebAudio 합성 효과음 (외부 파일 없음)
const G = window.MOGU;

const A = {
  ctx: null, master: null, waterGain: null, waterSrc: null,

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  tone(freq, dur, type = 'square', vol = 0.25, slideTo = null, when = 0) {
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

  noise(dur, vol = 0.3, freq = 800, q = 1, when = 0) {
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
    src.start(t0);
  },

  // ── 개별 효과음 ──
  pickup() { this.tone(880, 0.07, 'square', 0.18); this.tone(1318, 0.1, 'square', 0.18, null, 0.06); },
  fish() { [659, 830, 1046, 1318].forEach((f, i) => this.tone(f, 0.09, 'square', 0.16, null, i * 0.055)); },
  hit() { this.noise(0.22, 0.5, 350, 0.8); this.tone(160, 0.3, 'sawtooth', 0.3, 55); },
  coin() { this.tone(987, 0.085, 'square', 0.3); this.tone(1318, 0.34, 'square', 0.3, null, 0.085); },
  beep(last) { this.tone(last ? 880 : 440, last ? 0.4 : 0.1, 'square', 0.2); },
  splash() { this.noise(0.4, 0.4, 900, 0.6); },
  cluck() { this.tone(620, 0.06, 'square', 0.2, 880); this.tone(740, 0.1, 'square', 0.2, 500, 0.08); },
  stuck() { this.noise(0.3, 0.3, 250, 1.2); },
  meow() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(540, t0);
    o.frequency.linearRampToValueAtTime(900, t0 + 0.14);
    o.frequency.linearRampToValueAtTime(480, t0 + 0.42);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.46);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.5);
  },
  fanfare() {
    const seq = [[523, 0], [659, 0.13], [784, 0.26], [1046, 0.42]];
    for (const [f, w] of seq) { this.tone(f, 0.22, 'square', 0.22, null, w); this.tone(f / 2, 0.22, 'triangle', 0.2, null, w); }
    this.tone(1046, 0.55, 'square', 0.22, null, 0.62);
    this.tone(523, 0.55, 'triangle', 0.2, null, 0.62);
  },
  gameover() { [392, 369, 349, 311].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.25, null, i * 0.24)); },
  whoosh() { this.noise(0.5, 0.45, 1400, 0.5); },

  // ── 물소리 루프 ──
  startWater() {
    if (!this.ctx || this.waterSrc) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 2.5; }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = this.ctx.createGain(); g.gain.value = 0.12;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.waterSrc = src; this.waterGain = g;
  },
  setWaterLevel(v) { if (this.waterGain) this.waterGain.gain.value = 0.06 + v * 0.16; },
  stopWater() { if (this.waterSrc) { try { this.waterSrc.stop(); } catch (e) {} this.waterSrc = null; this.waterGain = null; } },
};

G.audio = A;
