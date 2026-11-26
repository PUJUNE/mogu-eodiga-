// audio.js — WebAudio 합성 효과음 · 배경음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MWT;

const A = {
  ctx: null, master: null, bgmTimer: null, step: 0, track: null, muted: false, last: {},

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.36;
    this.master.connect(this.ctx.destination);
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.36; return this.muted; },
  // 같은 소리가 한꺼번에 쏟아지지 않게 간격을 둔다
  gate(k, gap) { const t = this.ctx ? this.ctx.currentTime : 0; if (this.last[k] && t - this.last[k] < gap) return false; this.last[k] = t; return true; },

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

  bgm(track) {
    if (this.track === track && this.bgmTimer) return;
    this.stopBgm(); this.track = track;
    if (!this.ctx || !track) return;
    const T = {
      title:  { ms: 230, mel: [392, 0, 523, 0, 659, 587, 523, 0, 440, 0, 523, 587, 523, 0, 392, 0], bass: [131, 110, 147, 98], type: 'triangle', vol: 0.05 },
      battle: { ms: 170, mel: [523, 0, 523, 659, 784, 0, 659, 0, 587, 0, 587, 698, 659, 0, 523, 0, 440, 0, 440, 523, 587, 0, 523, 0, 494, 0, 523, 587, 523, 0, 0, 0], bass: [131, 131, 110, 98], type: 'square', vol: 0.028 },
      boss:   { ms: 150, mel: [440, 0, 466, 0, 440, 0, 392, 0, 440, 523, 0, 466, 440, 0, 0, 0], bass: [110, 110, 104, 98], type: 'sawtooth', vol: 0.025 },
    }[track];
    this.step = 0;
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const s = this.step, n = T.mel[s % T.mel.length];
      if (n) this.tone(n, T.ms / 1000 * 1.5, T.type, T.vol);
      if (s % 4 === 0) this.tone(T.bass[(s / 4 | 0) % T.bass.length], T.ms / 1000 * 3, 'sine', 0.09);
      if (track !== 'title' && s % 2 === 1) this.noise(0.03, 0.018, 7000, 1, 0, 'highpass');
      this.step++;
    }, T.ms);
  },
  stopBgm() { if (this.bgmTimer) clearInterval(this.bgmTimer); this.bgmTimer = null; this.track = null; },

  yarn() { if (this.gate('yarn', 0.06)) this.tone(660, 0.05, 'triangle', 0.05, 900); },
  can() { if (this.gate('can', 0.1)) { this.tone(160, 0.12, 'square', 0.07, 90); this.noise(0.08, 0.06, 600); } },
  laser() { if (this.gate('laser', 0.08)) this.tone(1400, 0.16, 'sawtooth', 0.04, 500); },
  boom() { if (this.gate('boom', 0.08)) { this.noise(0.3, 0.16, 500, 0.6); this.tone(110, 0.25, 'sine', 0.14, 50); } },
  squeak() { if (this.gate('squeak', 0.05)) this.tone(1800 + Math.random() * 500, 0.07, 'square', 0.035, 2400); },
  coin() { if (this.gate('coin', 0.05)) { this.tone(1319, 0.05, 'square', 0.04); this.tone(1760, 0.08, 'square', 0.04, null, 0.04); } },
  leak() { this.tone(440, 0.18, 'triangle', 0.12, 220); this.tone(330, 0.25, 'triangle', 0.1, 160, 0.12); },
  horn(boss) { const f = boss ? [220, 208, 196] : [392, 523]; f.forEach((n, i) => this.tone(n, 0.35, 'sawtooth', 0.08, null, i * 0.22)); if (boss) this.noise(0.8, 0.08, 200, 0.5); },
  build() { this.noise(0.06, 0.12, 1200, 1); this.noise(0.06, 0.12, 1000, 1, 0.12); this.tone(523, 0.12, 'triangle', 0.08, null, 0.22); },
  upgrade() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.06, null, i * 0.06)); },
  sell() { [784, 659, 523].forEach((f, i) => this.tone(f, 0.08, 'triangle', 0.08, null, i * 0.06)); },
  scratch() { if (this.gate('scratch', 0.12)) this.noise(0.06, 0.06, 2600, 2); },
  gas() { this.noise(0.5, 0.1, 300, 0.4); this.tone(120, 0.4, 'sawtooth', 0.04, 80); },
  emp() { this.tone(200, 0.5, 'sawtooth', 0.08, 1200); this.noise(0.4, 0.08, 3000, 0.5); },
  hop() { if (this.gate('hop', 0.1)) this.tone(300, 0.15, 'triangle', 0.06, 700); },
  early() { [659, 784, 988].forEach((f, i) => this.tone(f, 0.08, 'square', 0.06, null, i * 0.05)); },
  click() { this.tone(700, 0.04, 'triangle', 0.08); },
  deny() { this.tone(180, 0.12, 'square', 0.06); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.09, 420); },
  win() { this.stopBgm(); [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'square', 0.1, null, i * 0.1)); },
  lose() { this.stopBgm(); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.14, null, i * 0.2)); },
};

M.audio = A;
