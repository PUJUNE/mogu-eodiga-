// audio.js — WebAudio 합성 효과음 + 붐뱁 비트 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MBK;

const A = {
  ctx: null, master: null, beatTimer: null, step: 0, dribAt: 0,

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol = 0.2, freq = 900, q = 1, when = 0, type = 'bandpass') {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.02);
  },

  // ── 배경 비트: 90BPM 붐뱁 (킥·스네어·하이햇 + 낮은 베이스) ──
  beatStart() {
    this.beatStop();
    if (!this.ctx) return;
    const bass = [55, 0, 0, 55, 0, 0, 65, 0, 49, 0, 0, 49, 0, 0, 73, 0];
    this.step = 0;
    this.beatTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const s = this.step % 16;
      if (s === 0 || s === 7 || s === 10) { this.tone(120, 0.18, 'sine', 0.22, 45); }
      if (s === 4 || s === 12) { this.noise(0.14, 0.12, 1800, 0.7); this.tone(190, 0.08, 'triangle', 0.06, 140); }
      if (s % 2 === 0) this.noise(0.03, 0.035, 8000, 1, 0, 'highpass');
      if (bass[s]) this.tone(bass[s], 0.3, 'triangle', 0.09);
      this.step++;
    }, 166);
  },
  beatStop() { if (this.beatTimer) clearInterval(this.beatTimer); this.beatTimer = null; },

  // ── 효과음 ──
  dribble() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime; if (now - this.dribAt < 0.12) return; this.dribAt = now;
    this.tone(95, 0.09, 'sine', 0.22, 60); this.noise(0.04, 0.05, 600, 1);
  },
  bounce(v) { this.tone(90, 0.1, 'sine', Math.min(0.25, 0.06 + v * 0.03), 60); },
  squeak() { this.tone(1900, 0.07, 'sine', 0.06, 2400); this.tone(2300, 0.05, 'sine', 0.05, 1800, 0.05); },
  whistle() { this.tone(2600, 0.25, 'square', 0.05); this.tone(2650, 0.25, 'sine', 0.06); },
  release() { this.noise(0.06, 0.06, 2000, 1); },
  swish() { this.noise(0.28, 0.14, 4200, 0.6); },
  rim() { this.tone(520, 0.25, 'triangle', 0.14, 470); this.tone(1240, 0.12, 'square', 0.04); },
  board() { this.tone(160, 0.12, 'square', 0.12, 110); this.noise(0.08, 0.08, 900, 1); },
  dunk() { this.tone(70, 0.35, 'sawtooth', 0.2, 40); this.noise(0.3, 0.2, 500, 0.7); this.tone(520, 0.3, 'triangle', 0.12, 430, 0.02); },
  block() { this.noise(0.12, 0.2, 1200, 0.8); this.tone(240, 0.15, 'square', 0.1, 120); },
  steal() { this.noise(0.1, 0.14, 2600, 1); this.tone(880, 0.12, 'square', 0.08, 1320); },
  ankle() { this.tone(1400, 0.08, 'sine', 0.08, 2200); this.tone(300, 0.3, 'triangle', 0.14, 80, 0.06); },
  buzzer() { this.tone(180, 0.6, 'sawtooth', 0.12); this.tone(182, 0.6, 'square', 0.06); },
  score(pts) { [784, 988, 1175].slice(0, pts + 1).forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, null, i * 0.07)); },
  oops() { this.tone(330, 0.15, 'triangle', 0.12, 220); },
  win() { this.beatStop(); [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.14, null, i * 0.11)); },
  lose() { this.beatStop(); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.18, null, i * 0.2)); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
