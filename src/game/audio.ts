// Suara mesin & decit ban sederhana lewat Web Audio (tanpa file audio).

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Harus dipanggil dari aksi pengguna (klik / tombol) agar browser mengizinkan suara. */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 600;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0.0;
      this.osc1 = ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc2 = ctx.createOscillator();
      this.osc2.type = 'square';
      this.osc1.connect(this.filter);
      this.osc2.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(this.master);
      this.osc1.start();
      this.osc2.start();

      // noise untuk decit ban
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 1.2;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0;
      src.connect(bp);
      bp.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      src.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  update(rpm: number, throttle: number, slip: number, running: boolean) {
    if (!this.ctx || !this.osc1 || !this.osc2 || !this.gain || !this.filter || !this.noiseGain) return;
    const t = this.ctx.currentTime;
    const f = 48 + rpm * 190;
    this.osc1.frequency.setTargetAtTime(f, t, 0.04);
    this.osc2.frequency.setTargetAtTime(f * 1.5, t, 0.04);
    this.filter.frequency.setTargetAtTime(350 + rpm * 700 + throttle * 1400, t, 0.05);
    this.gain.gain.setTargetAtTime(running ? 0.05 + throttle * 0.07 + rpm * 0.03 : 0, t, 0.08);
    this.noiseGain.gain.setTargetAtTime(running ? Math.max(0, slip - 0.3) * 0.18 : 0, t, 0.05);
  }

  /** Dentuman benturan; kekuatan dalam m/s kecepatan benturan. */
  impact(strength: number) {
    if (!this.ctx || !this.master) return;
    try {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * 0.3);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 350 + Math.min(1, strength / 20) * 1400;
      const g = ctx.createGain();
      g.gain.value = 0.15 + Math.min(1, strength / 20) * 0.6;
      src.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      src.start();
    } catch {
      /* abaikan */
    }
  }

  suspend() {
    if (this.ctx) void this.ctx.suspend();
  }
  resume() {
    if (this.ctx) void this.ctx.resume();
  }

  dispose() {
    try {
      this.osc1?.stop();
      this.osc2?.stop();
      void this.ctx?.close();
    } catch {
      /* abaikan */
    }
    this.ctx = null;
  }
}
