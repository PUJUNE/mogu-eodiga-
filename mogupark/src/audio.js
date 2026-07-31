// audio.js — WebAudio 합성 효과음 + 아이들 엔진 + R기어 후진 경고음 (외부 파일 없음)
const M = window.MPK;

const A = {
  ctx: null, master: null,
  eng: null, engGain: null, engFilter: null,
  beepTimer: null,

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

  // ── 아이들 엔진 (주차 속도라 낮게 웅웅거리기만) ──
  engineOn() {
    if (!this.ctx || this.eng) return;
    this.eng = this.ctx.createOscillator();
    this.eng.type = 'sawtooth';
    this.eng.frequency.value = 44;
    this.engFilter = this.ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 320;
    this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.eng.start();
  },
  engineOff() {
    if (this.eng) { try { this.eng.stop(); } catch (e) {} this.eng = null; }
    this.engGain = this.engFilter = null;
    if (this.beepTimer) { clearInterval(this.beepTimer); this.beepTimer = null; }
  },
  engineUpdate(speedPct, throttle, gear) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime;
    this.eng.frequency.setTargetAtTime(42 + speedPct * 70 + throttle * 26, t, 0.06);
    this.engGain.gain.setTargetAtTime(0.045 + throttle * 0.08 + speedPct * 0.03, t, 0.1);
    // R기어 후진 경고음 (삑-삑) — 후방카메라 없는 차의 유일한 후진 보조
    const wantBeep = gear === 'R';
    if (wantBeep && !this.beepTimer) {
      this.beepTimer = setInterval(() => this.tone(980, 0.14, 'square', 0.08), 620);
    } else if (!wantBeep && this.beepTimer) { clearInterval(this.beepTimer); this.beepTimer = null; }
  },

  // ── 효과음 ──
  gear() { this.noise(0.05, 0.14, 1600, 1.4); this.tone(240, 0.06, 'square', 0.08, 180); },
  curb() { this.noise(0.2, 0.3, 200, 0.7); this.tone(90, 0.16, 'sine', 0.24, 55); },
  crash() { this.noise(0.4, 0.42, 320, 0.7); this.tone(140, 0.32, 'square', 0.24, 50); },
  parked(n) {
    const seq = n >= 3 ? [523, 659, 784, 1047, 1319] : n >= 2 ? [523, 659, 784, 1047] : [523, 659, 784];
    seq.forEach((f, i) => this.tone(f, 0.17, 'square', 0.19, null, i * 0.11));
  },
  timeout() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.18, null, i * 0.19)); },
  holdTick() { this.tone(1240, 0.05, 'square', 0.06); },
  meow() { this.tone(700, 0.28, 'sawtooth', 0.1, 420); },
};

M.audio = A;
