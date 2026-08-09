let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): { ctx: AudioContext; masterGain: GainNode } {
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return { ctx, masterGain: masterGain! };
}

function mkNoiseBuffer(audioCtx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playX_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(180, t);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(120, t);
  mod.connect(modGain);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(650, t);
  osc.frequency.exponentialRampToValueAtTime(1250, t + 0.09);
  modGain.connect(osc.frequency);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

  osc.connect(g);
  g.connect(masterGain);

  mod.start(t);
  osc.start(t);
  mod.stop(t + 0.16);
  osc.stop(t + 0.16);
}

export function playO_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(90, t);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(80, t);
  mod.connect(modGain);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(780, t + 0.12);
  modGain.connect(osc.frequency);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

  osc.connect(g);
  g.connect(masterGain);

  mod.start(t);
  osc.start(t);
  mod.stop(t + 0.22);
  osc.stop(t + 0.22);
}

export function playWin_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;
  const freqs = [523.25, 659.25, 783.99, 1046.5];
  freqs.forEach((f, i) => {
    const start = t + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, start);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(6, start);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 0.02, start);
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

    osc.connect(g);
    g.connect(masterGain);

    mod.start(start);
    osc.start(start);
    mod.stop(start + 0.55);
    osc.stop(start + 0.55);
  });
}

export function playReset_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;
  const duration = 0.55;

  const noise = ctx.createBufferSource();
  noise.buffer = mkNoiseBuffer(ctx, duration);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.Q.value = 4.5;
  bandpass.frequency.setValueAtTime(150, t);
  bandpass.frequency.exponentialRampToValueAtTime(5500, t + duration);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.65, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  noise.connect(bandpass);
  bandpass.connect(g);
  g.connect(masterGain);

  noise.start(t);
  noise.stop(t + duration + 0.01);
}

export function playMode_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(500, t + 0.05);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

  osc.connect(g);
  g.connect(masterGain);

  osc.start(t);
  osc.stop(t + 0.08);
}

export function playClick_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, t);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

  osc.connect(g);
  g.connect(masterGain);

  osc.start(t);
  osc.stop(t + 0.04);
}

export function playError_SciFi(): void {
  const { ctx, masterGain } = getAudioContext();
  const t = ctx.currentTime;

  const mod = ctx.createOscillator();
  mod.type = 'square';
  mod.frequency.setValueAtTime(32, t);

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(45, t);
  mod.connect(modGain);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, t);
  modGain.connect(osc.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(650, t);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

  osc.connect(filter);
  filter.connect(g);
  g.connect(masterGain);

  mod.start(t);
  osc.start(t);
  mod.stop(t + 0.19);
  osc.stop(t + 0.19);
}
