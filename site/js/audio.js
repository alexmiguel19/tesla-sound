/*
 * audio.js — Web Audio plumbing around the engine synthesizer.
 *
 *   engine (AudioWorklet, or ScriptProcessor fallback)
 *     → compressor (tames peaks on car speakers)
 *     → master gain (volume and fades)
 *     → safety clipper (rounds peaks off instead of hard clipping)
 *     → speakers
 */

const CLIP_RANGE = 2;
const CLIP_KNEE = 0.85;
const CLIP_CEIL = 0.98;

function clipCurve(n = 4096) {
  const c = new Float32Array(n), soft = CLIP_CEIL - CLIP_KNEE;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) * 2 - 1) * CLIP_RANGE, ax = Math.abs(x);
    c[i] = ax <= CLIP_KNEE ? x : Math.sign(x) * (CLIP_KNEE + soft * Math.tanh((ax - CLIP_KNEE) / soft));
  }
  return c;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
  }

  async init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    // Resume while still inside the tap that started us; awaits below may outlive it.
    ctx.resume().catch(() => {});

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.15;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const pre = ctx.createGain();
    pre.gain.value = 1 / CLIP_RANGE;
    const clip = ctx.createWaveShaper();
    clip.curve = clipCurve();
    comp.connect(this.master).connect(pre).connect(clip).connect(ctx.destination);

    const dspUrl = new URL('./engine-dsp.js', import.meta.url).href;
    try {
      if (!ctx.audioWorklet) throw new Error('no AudioWorklet');
      await ctx.audioWorklet.addModule(dspUrl);
      this.node = new AudioWorkletNode(ctx, 'engine-processor', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2]
      });
      this.post = m => this.node.port.postMessage(m);
    } catch (err) {
      console.warn('AudioWorklet unavailable, using ScriptProcessor', err);
      if (!window.EngineSynth) await loadScript(dspUrl);
      const synth = new window.EngineSynth(ctx.sampleRate);
      this.node = ctx.createScriptProcessor(1024, 0, 2);
      this.node.onaudioprocess = ev => {
        const b = ev.outputBuffer;
        synth.process(b.getChannelData(0), b.getChannelData(1), b.length);
      };
      this.post = m => synth.message(m);
    }
    this.node.connect(comp);
  }

  post() {}

  async resume() {
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.on) this.ramp(v, 0.05);
  }

  ramp(v, tau) {
    if (!this.master) return;
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(v, t, tau);
  }

  fadeIn() { this.on = true; this.ramp(this.volume, 0.08); }
  fadeOut(tau = 0.4) { this.on = false; this.ramp(0, tau); }
}
