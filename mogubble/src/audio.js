// audio.js — WebAudio 합성 효과음 (외부 파일 없음, 모구 어디가와 같은 방식)
const M = window.MGB;

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
  shoot()   { this.tone(520, 0.1, 'triangle', 0.18, 880); this.noise(0.06, 0.12, 2400, 1.4); },
  bounce()  { this.tone(360, 0.05, 'square', 0.1, 320); },
  snap()    { this.tone(240, 0.06, 'square', 0.14, 200); },
  match()   { [520, 640, 760].forEach((f, i) => this.tone(f, 0.07, 'square', 0.12, null, i * 0.09)); },
  pop(n)    { const k = Math.min(n, 8);
              for (let i = 0; i < k; i++) this.tone(620 + i * 90, 0.08, 'square', 0.16, 900 + i * 90, i * 0.045);
              this.noise(0.12, 0.2, 1200, 1); },
  fall(n)   { for (let i = 0; i < Math.min(n, 5); i++) this.tone(700 - i * 80, 0.1, 'triangle', 0.12, 300, i * 0.06); },
  descend() { this.tone(140, 0.22, 'sawtooth', 0.22, 90); this.noise(0.2, 0.18, 400, 0.8); },
  clear()   { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'square', 0.18, null, i * 0.1)); },
  over()    { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.2, null, i * 0.2)); },
  meow()    { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
