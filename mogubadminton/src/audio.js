// audio.js — WebAudio 합성 효과음 + 경쾌한 체육관 비트 (외부 파일 없음, 시리즈 공통 방식)
const M = window.MBD;

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

  // ── 배경 비트: 110BPM 가벼운 셔플 (킥·클랩·하이햇 + 마림바풍 음) ──
  beatStart() {
    this.beatStop();
    if (!this.ctx) return;
    const mel = [523, 0, 659, 0, 784, 0, 659, 0, 587, 0, 698, 0, 880, 0, 698, 0];
    this.step = 0;
    this.beatTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const s = this.step % 16;
      if (s % 4 === 0) this.tone(110, 0.14, 'sine', 0.16, 50);
      if (s === 4 || s === 12) this.noise(0.08, 0.08, 2200, 1);
      if (s % 2 === 1) this.noise(0.025, 0.03, 9000, 1, 0, 'highpass');
      if (mel[s] && this.step % 32 < 16) this.tone(mel[s], 0.12, 'triangle', 0.05);
      this.step++;
    }, 136);
  },
  beatStop() { if (this.beatTimer) clearInterval(this.beatTimer); this.beatTimer = null; },

  // ── 효과음 ──
  hit(spd) {                                         // 라켓에 맞는 '퐁' — 빠를수록 날카롭게
    const k = Math.min(1, spd / 40);
    this.noise(0.05, 0.12 + k * 0.12, 1800 + k * 2600, 1.2);
    this.tone(900 + k * 900, 0.05, 'triangle', 0.08 + k * 0.06, 500);
  },
  smash() { this.noise(0.12, 0.26, 3200, 0.8); this.tone(220, 0.15, 'sawtooth', 0.1, 90); },
  swish() { this.noise(0.1, 0.05, 2600, 0.7); },
  net() { this.noise(0.18, 0.12, 700, 0.8); this.tone(160, 0.15, 'triangle', 0.08, 120); },
  land() { this.tone(130, 0.08, 'sine', 0.12, 80); },
  whistle() { this.tone(2600, 0.2, 'square', 0.05); this.tone(2650, 0.2, 'sine', 0.06); },
  point(mine) { (mine ? [784, 988, 1175] : [523, 440]).forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, null, i * 0.08)); },
  clap() { for (let i = 0; i < 8; i++) this.noise(0.04, 0.05, 1500 + Math.random() * 1500, 1, i * 0.05 + Math.random() * 0.03); },
  win() { this.beatStop(); [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.14, null, i * 0.11)); this.clap(); },
  lose() { this.beatStop(); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.18, null, i * 0.2)); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
