class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(m: boolean) {
    this.muted = m;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public playLaser(weapon: 'pulse' | 'rail', isLocal: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    if (weapon === 'pulse') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isLocal ? 920 : 680, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2.5, now);

      gain.gain.setValueAtTime(isLocal ? 0.14 : 0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      // Heavy Precision Rail discharge
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isLocal ? 1400 : 980, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.34);

      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(180, now);
      sub.frequency.exponentialRampToValueAtTime(42, now + 0.32);

      gain.gain.setValueAtTime(isLocal ? 0.24 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc.connect(gain);
      sub.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.37);
      sub.stop(now + 0.37);
    }
  }

  public playHitConfirm(headshot: boolean, eliminated: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = headshot ? 1560 : 1080;
    osc.frequency.setValueAtTime(baseFreq, now);
    if (eliminated) {
      osc.frequency.setValueAtTime(baseFreq * 1.25, now + 0.05);
    }

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (eliminated ? 0.18 : 0.09));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playDamageTaken(eliminated: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(eliminated ? 240 : 170, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + (eliminated ? 0.42 : 0.14));

    gain.gain.setValueAtTime(eliminated ? 0.18 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (eliminated ? 0.44 : 0.15));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playJumpPad() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.22);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playPickup(kind: 'shield' | 'overdrive') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = kind === 'overdrive' ? [523, 659, 988] : [440, 660];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.055;
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.17);
    });
  }
}

export const soundEngine = new SoundEngine();
