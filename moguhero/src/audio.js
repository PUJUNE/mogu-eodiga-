// audio.js — WebAudio 합성 효과음 + 마을·던전 배경음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MHR;

const A = {
  ctx: null, master: null, bgmTimer: null, step: 0, track: null, muted: false,

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.38;
    this.master.connect(this.ctx.destination);
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.38; return this.muted; },

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

  // ── 배경음: 마을(느긋한 오르골) · 던전(낮은 베이스 + 긴장) ──
  bgm(track) {
    if (this.track === track && this.bgmTimer) return;
    this.stopBgm(); this.track = track;
    if (!this.ctx || !track) return;
    const T = {
      village: { ms: 230, mel: [659, 0, 784, 0, 880, 784, 659, 0, 587, 0, 659, 0, 523, 0, 0, 0, 659, 0, 784, 0, 988, 880, 784, 0, 880, 0, 784, 0, 659, 0, 0, 0], bass: [131, 131, 175, 196], type: 'triangle', vol: 0.05 },
      battle:  { ms: 150, mel: [330, 0, 330, 392, 0, 330, 440, 0, 330, 0, 330, 494, 0, 440, 392, 0], bass: [82, 82, 98, 110], type: 'square', vol: 0.035 },
      boss:    { ms: 130, mel: [294, 0, 311, 0, 294, 0, 370, 349, 294, 0, 311, 0, 440, 0, 415, 0], bass: [73, 73, 78, 69], type: 'sawtooth', vol: 0.03 },
    }[track];
    this.step = 0;
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const s = this.step;
      const n = T.mel[s % T.mel.length];
      if (n) this.tone(n, T.ms / 1000 * 1.6, T.type, T.vol);
      if (s % 4 === 0) this.tone(T.bass[(s / 4 | 0) % T.bass.length], T.ms / 1000 * 3, 'sine', 0.09);
      if (track !== 'village' && s % 2 === 1) this.noise(0.03, 0.025, 8000, 1, 0, 'highpass');
      if (track !== 'village' && s % 4 === 0) this.tone(70, 0.12, 'sine', 0.12, 40);
      this.step++;
    }, T.ms);
  },
  stopBgm() { if (this.bgmTimer) clearInterval(this.bgmTimer); this.bgmTimer = null; this.track = null; },

  // ── 효과음 ──
  swing(i) { this.noise(0.09, 0.07 + i * 0.03, 2400 - i * 400, 0.8); },
  hit(crit) { this.noise(0.06, 0.16, crit ? 3200 : 1800, 1.2); this.tone(crit ? 880 : 520, 0.06, 'square', 0.07, 260); },
  heavy() { this.tone(110, 0.18, 'sine', 0.22, 50); this.noise(0.1, 0.12, 600, 0.8); },
  hurt() { this.tone(300, 0.14, 'sawtooth', 0.12, 120); },
  dash() { this.noise(0.14, 0.08, 4000, 0.6); },
  skill() { for (let i = 0; i < 6; i++) this.tone(400 + i * 120, 0.08, 'triangle', 0.08, null, i * 0.03); this.noise(0.3, 0.1, 1200, 0.5); },
  slamWarn() { this.tone(200, 0.3, 'square', 0.06, 260); },
  slam() { this.tone(70, 0.3, 'sine', 0.3, 35); this.noise(0.25, 0.2, 400, 0.7); },
  kill() { this.tone(660, 0.07, 'square', 0.08); this.tone(990, 0.09, 'square', 0.07, null, 0.06); },
  boss() { [196, 185, 175, 165].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.09, null, i * 0.18)); },
  coin() { this.tone(988, 0.07, 'square', 0.08); this.tone(1319, 0.12, 'square', 0.08, null, 0.07); },
  click() { this.tone(700, 0.04, 'triangle', 0.08); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.1, null, i * 0.08)); },
  train() { this.tone(330, 0.08, 'square', 0.08); this.tone(440, 0.08, 'square', 0.08, null, 0.1); this.tone(554, 0.12, 'square', 0.09, null, 0.2); },
  card() { this.noise(0.12, 0.08, 3000, 0.7); this.tone(1200, 0.25, 'sine', 0.06, 1800, 0.1); },
  win() { this.stopBgm(); [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.13, null, i * 0.11)); },
  lose() { this.stopBgm(); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.16, null, i * 0.2)); },
  rewind() { for (let i = 0; i < 10; i++) this.tone(1200 - i * 90, 0.06, 'triangle', 0.06, null, i * 0.04); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
  sleep() { [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.08, null, i * 0.22)); },
};

M.audio = A;
