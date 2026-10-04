// audio.js — WebAudio 합성 효과음 + 가야금풍 배경 가락 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MSP;

const A = {
  ctx: null, master: null, bgmTimer: null, bgmStep: 0, bgmFast: false, kneadAt: 0,

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
  noise(dur, vol = 0.2, freq = 900, q = 1, when = 0) {
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
  pluck(freq, when = 0, vol = 0.07) {       // 가야금 뜯는 소리 흉내 — 짧은 삼각파 두 겹
    this.tone(freq, 0.5, 'triangle', vol, freq * 0.995, when);
    this.tone(freq * 2, 0.18, 'sine', vol * 0.4, null, when);
  },

  // ── 배경 가락: 5음(도 레 파 솔 라)으로 도는 느린 12박, 장구 소리를 흉내 낸 박자 ──
  bgmStart() {
    this.bgmStop();
    if (!this.ctx) return;
    const scale = [262, 294, 349, 392, 440, 523, 587];
    const tune = [0, 2, 3, 4, 3, 2, 3, -1, 4, 5, 4, 3, 2, 3, 2, 0, 1, 2, -1, 0, 2, 3, 2, -1];
    this.bgmStep = 0;
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const n = tune[this.bgmStep % tune.length];
      if (n >= 0) this.pluck(scale[n], 0, 0.06);
      if (this.bgmStep % 6 === 0) this.tone(131, 0.25, 'sine', 0.08, 110);        // 장구 쿵
      if (this.bgmStep % 6 === 3) this.noise(0.06, 0.05, 2400, 2);                 // 덕
      this.bgmStep++;
    }, this.bgmFast ? 180 : 240);
  },
  bgmStop() { if (this.bgmTimer) clearInterval(this.bgmTimer); this.bgmTimer = null; },
  hurry() { this.bgmFast = true; if (this.bgmTimer) this.bgmStart(); [880, 880, 1175].forEach((f, i) => this.tone(f, 0.1, 'square', 0.12, null, i * 0.12)); },

  // ── 효과음 ──
  pick()   { this.tone(620, 0.06, 'square', 0.1, 820); },
  place()  { this.tone(300, 0.07, 'triangle', 0.16, 200); },
  bump()   { this.tone(160, 0.06, 'square', 0.06); },
  knead()  {
    if (!this.ctx) return;
    const now = this.ctx.currentTime; if (now - this.kneadAt < 0.2) return; this.kneadAt = now;
    this.tone(140, 0.08, 'sine', 0.2, 90); this.noise(0.05, 0.05, 500, 1);
  },
  done()   { this.tone(700, 0.08, 'triangle', 0.16, 1100); },
  fill()   { this.noise(0.08, 0.1, 3000, 1.5); this.tone(520, 0.05, 'triangle', 0.08); },
  steamIn(){ this.noise(0.35, 0.12, 5000, 0.8); },
  cooked() { this.tone(1320, 0.12, 'sine', 0.14); this.tone(1760, 0.18, 'sine', 0.12, null, 0.1); },
  burnt()  { this.tone(110, 0.4, 'sawtooth', 0.12, 80); this.noise(0.4, 0.1, 400, 0.7); },
  serve()  { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', 0.12, null, i * 0.06)); },
  wrong()  { this.tone(180, 0.18, 'square', 0.14); this.tone(150, 0.22, 'square', 0.14, null, 0.15); },
  miss()   { this.tone(440, 0.2, 'triangle', 0.14, 220); },
  order()  { this.tone(1046, 0.1, 'sine', 0.1); this.tone(1318, 0.14, 'sine', 0.09, null, 0.08); },
  kiwiIn() { [2200, 2600, 2200].forEach((f, i) => this.tone(f, 0.05, 'sine', 0.08, f * 1.1, i * 0.09)); },
  peck()   { this.tone(1800, 0.03, 'square', 0.08); this.tone(1500, 0.03, 'square', 0.08, null, 0.07); },
  shoo()   { this.noise(0.18, 0.14, 1400, 0.8); this.tone(700, 0.25, 'sawtooth', 0.08, 420); },
  dash()   { this.noise(0.12, 0.08, 1800, 0.8); },
  trash()  { this.noise(0.15, 0.12, 700, 0.9); },
  end()    { this.bgmStop(); this.bgmFast = false; [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.18, null, i * 0.13)); },
  star(i)  { this.tone(880 + i * 220, 0.25, 'square', 0.14, null, 0); },
  meow()   { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
