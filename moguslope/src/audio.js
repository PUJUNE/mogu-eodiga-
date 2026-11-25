// audio.js — WebAudio 합성 효과음 · 미끄러지는 소리 · 배경음 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MSL;

const A = {
  ctx: null, master: null, bgmTimer: null, step: 0, track: null, muted: false, slideG: null, slideF: null,

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.38;
    this.master.connect(this.ctx.destination);
    // 썰매가 미끄러지는 소리: 걸러 낸 잡음을 계속 틀어 두고 크기만 바꾼다
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.slideF = this.ctx.createBiquadFilter(); this.slideF.type = 'bandpass'; this.slideF.frequency.value = 900; this.slideF.Q.value = 0.7;
    this.slideG = this.ctx.createGain(); this.slideG.gain.value = 0;
    src.connect(this.slideF); this.slideF.connect(this.slideG); this.slideG.connect(this.master); src.start();
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

  // 속도·구역에 따라 미끄러지는 소리 (공중이면 끈다)
  slide(v, air, zone) {
    if (!this.slideG) return;
    const t = this.ctx.currentTime;
    const vol = air || v < 1 ? 0 : Math.min(0.16, v * 0.007);
    this.slideG.gain.setTargetAtTime(vol, t, 0.08);
    this.slideF.frequency.setTargetAtTime((zone === 'tube' ? 500 : zone === 'snow' ? 2200 : 1200) + v * 30, t, 0.1);
  },

  bgm(track) {
    if (this.track === track && this.bgmTimer) return;
    this.stopBgm(); this.track = track;
    if (!this.ctx || !track) return;
    const T = {
      title: { ms: 210, mel: [523, 0, 659, 0, 784, 0, 659, 784, 880, 0, 784, 0, 659, 0, 587, 0], bass: [131, 175, 196, 165], type: 'triangle', vol: 0.05 },
      ride:  { ms: 135, mel: [659, 784, 880, 0, 784, 659, 587, 0, 659, 0, 784, 988, 880, 0, 784, 0, 523, 587, 659, 0, 587, 523, 494, 0, 523, 0, 587, 659, 587, 0, 0, 0], bass: [131, 131, 110, 98], type: 'square', vol: 0.03 },
    }[track];
    this.step = 0;
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const s = this.step, n = T.mel[s % T.mel.length];
      if (n) this.tone(n, T.ms / 1000 * 1.5, T.type, T.vol);
      if (s % 4 === 0) this.tone(T.bass[(s / 4 | 0) % T.bass.length], T.ms / 1000 * 3, 'sine', 0.09);
      if (track === 'ride' && s % 2 === 1) this.noise(0.03, 0.02, 8000, 1, 0, 'highpass');
      this.step++;
    }, T.ms);
  },
  stopBgm() { if (this.bgmTimer) clearInterval(this.bgmTimer); this.bgmTimer = null; this.track = null; },

  fish() { this.tone(988, 0.06, 'square', 0.07); this.tone(1319, 0.1, 'square', 0.07, null, 0.05); },
  heart() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.1, null, i * 0.06)); },
  jump() { this.tone(330, 0.16, 'square', 0.08, 660); },
  ramp() { this.noise(0.35, 0.1, 1800, 0.6); this.tone(392, 0.3, 'triangle', 0.08, 880); },
  land() { this.noise(0.12, 0.14, 500, 0.8); this.tone(90, 0.1, 'sine', 0.15, 50); },
  trick(n) { [523, 659, 784, 1047, 1319].slice(0, 2 + n).forEach((f, i) => this.tone(f, 0.12, 'square', 0.09, null, i * 0.06)); },
  crash() { this.noise(0.3, 0.25, 400, 0.6); this.tone(200, 0.3, 'sawtooth', 0.12, 70); },
  boost() { for (let i = 0; i < 5; i++) this.tone(440 + i * 150, 0.07, 'square', 0.06, null, i * 0.035); this.noise(0.4, 0.08, 3000, 0.5); },
  beep(hi) { this.tone(hi ? 1047 : 523, hi ? 0.4 : 0.16, 'square', 0.1); },
  click() { this.tone(700, 0.04, 'triangle', 0.08); },
  finish() { this.stopBgm(); [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'square', 0.11, null, i * 0.1)); },
  over() { this.stopBgm(); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.15, null, i * 0.2)); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.09, 420); },
};

M.audio = A;
