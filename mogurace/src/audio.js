// audio.js — WebAudio 합성 효과음 + 속도에 따라 도는 엔진음 (외부 파일 없음)
const M = window.MRC;

const A = {
  ctx: null, master: null,
  eng: null, engGain: null, engFilter: null, wind: null, windGain: null,

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

  // ── 엔진 + 주행풍 (주행 중 계속 돌고, 속도·엑셀에 따라 음정·음량이 변한다) ──
  engineOn() {
    if (!this.ctx || this.eng) return;
    this.eng = this.ctx.createOscillator();
    this.eng.type = 'sawtooth';
    this.eng.frequency.value = 60;
    this.engFilter = this.ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 700;
    this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.eng.start();

    const len = Math.ceil(this.ctx.sampleRate * 2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.wind = this.ctx.createBufferSource();
    this.wind.buffer = buf; this.wind.loop = true;
    const wf = this.ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 1100; wf.Q.value = 0.6;
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
    this.wind.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master);
    this.wind.start();
  },
  engineOff() {
    if (this.eng) { try { this.eng.stop(); } catch (e) {} this.eng = null; }
    if (this.wind) { try { this.wind.stop(); } catch (e) {} this.wind = null; }
    this.engGain = this.windGain = this.engFilter = null;
  },
  // 실제 기어의 rpm에서 음정을 만든다 — 변속하면 음이 뚝 떨어졌다 다시 차오른다
  engineUpdate(rpm01, speedPct, throttle) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime;
    const r = Math.max(0, Math.min(1.15, rpm01));
    this.eng.frequency.setTargetAtTime(48 + r * 165, t, 0.04);
    this.engFilter.frequency.setTargetAtTime(420 + r * 2400, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.05 + throttle * 0.1 + r * 0.05, t, 0.08);
    this.windGain.gain.setTargetAtTime(speedPct * speedPct * 0.14, t, 0.1);
  },
  shift() { this.noise(0.06, 0.16, 1800, 1.6); this.tone(170, 0.07, 'square', 0.09, 110); },

  // ── 효과음 ──
  countdown(last) { this.tone(last ? 880 : 520, last ? 0.4 : 0.16, 'square', 0.2); },
  start() { this.noise(0.5, 0.2, 420, 0.7); this.tone(180, 0.35, 'sawtooth', 0.16, 420); },
  hit() { this.noise(0.26, 0.34, 380, 0.8); this.tone(160, 0.22, 'square', 0.2, 70); },
  rail() { this.noise(0.4, 0.36, 2200, 2.4); this.tone(220, 0.3, 'sawtooth', 0.18, 80); },
  offroad() { this.noise(0.3, 0.2, 260, 0.5); },
  brake() { this.noise(0.34, 0.22, 2800, 3.2); },
  checkpoint() { [660, 880, 1180].forEach((f, i) => this.tone(f, 0.13, 'square', 0.2, null, i * 0.07)); },
  finish(n) {
    const seq = n >= 3 ? [523, 659, 784, 1047, 1319] : n >= 2 ? [523, 659, 784, 1047] : [523, 659, 784];
    seq.forEach((f, i) => this.tone(f, 0.17, 'square', 0.19, null, i * 0.11));
  },
  timeout() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.18, null, i * 0.19)); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
