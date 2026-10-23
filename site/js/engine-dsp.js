/*
 * engine-dsp.js — procedural engine synthesizer.
 *
 * Loaded two ways, so it uses no import/export and never touches the DOM:
 *   1. as an AudioWorklet module, where it registers "engine-processor";
 *   2. as a classic <script> (ScriptProcessor fallback), where it exposes
 *      globalThis.EngineSynth. Node can require() it for offline renders.
 *
 * Signal path, per sample:
 *   crank angle (one 4-stroke cycle = 720°) → firing events from the car's
 *   firing order → exhaust pressure pulse + noise burst into that cylinder's
 *   bank → per-bank pipe waveguide → stereo pan → exhaust formants
 *   + intake roar → muffler low-pass → body resonance
 *   + supercharger whine, cooling-fan whine, turbo whistle / blow-off,
 *     starter, gear click
 *   → DC block → soft saturation.
 *
 * Parameters arrive as messages from the page ({t: 'p', rpm, load, overrun,
 * cut, starter}) and are smoothed per sample, so the page may send them at
 * any rate. Electric cars (engine.type 'electric') use a motor/inverter voice.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const PULSES = 24;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  // Rational tanh approximation, good enough for a saturator.
  function softclip(x) {
    if (x <= -3) return -1;
    if (x >= 3) return 1;
    const x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
  }

  // xorshift32 noise in [-1, 1).
  class Rng {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      let x = this.s;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.s = x >>> 0;
      return this.s / 2147483648 - 1;
    }
  }

  // RBJ biquad, transposed direct form II. Setting coefficients keeps the
  // filter state, so cutoffs can move while the filter runs.
  class Biquad {
    constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
    set(b0, b1, b2, a0, a1, a2) {
      this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
      return this;
    }
    bandpass(sr, f, q) {
      const w = TAU * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
      return this.set(al, 0, -al, 1 + al, -2 * c, 1 - al);
    }
    lowpass(sr, f, q) {
      const w = TAU * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * (q || 0.707)), c = Math.cos(w);
      return this.set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al);
    }
    highpass(sr, f, q) {
      const w = TAU * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * (q || 0.707)), c = Math.cos(w);
      return this.set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
    }
    peak(sr, f, q, db) {
      const A = Math.pow(10, db / 40), w = TAU * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
      return this.set(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A);
    }
    run(x) {
      const y = this.b0 * x + this.z1;
      this.z1 = this.b1 * x - this.a1 * y + this.z2;
      this.z2 = this.b2 * x - this.a2 * y;
      return y;
    }
  }

  // Exhaust pipe: a feedback comb whose reflection is low-passed (energy
  // lost at the open end), which gives each bank its resonant "tube" tone.
  class Pipe {
    constructor(sr, ms, reflection, damping) {
      this.len = Math.max(2, Math.round(ms * sr / 1000));
      this.buf = new Float32Array(this.len);
      this.i = 0;
      this.refl = reflection;
      this.damp = damping;
      this.lp = 0;
    }
    run(x) {
      const d = this.buf[this.i];
      this.lp += (d - this.lp) * (1 - this.damp);
      const y = x + this.refl * this.lp;
      this.buf[this.i] = y;
      if (++this.i === this.len) this.i = 0;
      return y;
    }
  }

  // Pool of exhaust pulses for one bank. Each pulse is a raised-sine pressure
  // bump followed by a smaller rarefaction, plus a decaying noise burst.
  class PulseBank {
    constructor() {
      this.t = new Float32Array(PULSES);
      this.w = new Float32Array(PULSES);
      this.a = new Float32Array(PULSES);
      this.na = new Float32Array(PULSES);
      this.env = new Float32Array(PULSES);
      this.k = new Float32Array(PULSES);
      this.live = new Uint8Array(PULSES);
      this.next = 0;
    }
    add(w, a, na, decay) {
      let i = this.live.indexOf(0);
      if (i < 0) { i = this.next; this.next = (this.next + 1) % PULSES; }
      this.t[i] = 0; this.w[i] = Math.max(1, w); this.a[i] = a; this.na[i] = na;
      this.env[i] = 1; this.k[i] = Math.exp(-1 / Math.max(1, decay)); this.live[i] = 1;
    }
    run(rng) {
      let y = 0;
      for (let i = 0; i < PULSES; i++) {
        if (!this.live[i]) continue;
        const t = this.t[i], w = this.w[i];
        if (t < w) {
          const s = Math.sin(Math.PI * t / w);
          y += this.a[i] * s * s;
        } else if (t < 2 * w) {
          const s = Math.sin(Math.PI * (t - w) / w);
          y -= 0.3 * this.a[i] * s * s;
        }
        const env = this.env[i];
        y += this.na[i] * env * rng.next();
        this.env[i] = env * this.k[i];
        this.t[i] = t + 1;
        if (t > 2 * w && env < 1e-3) this.live[i] = 0;
      }
      return y;
    }
  }

  class EngineSynth {
    constructor(sampleRate) {
      const sr = this.sr = sampleRate;
      this.rng = new Rng(0x9e3779b9);
      this.rpm = 0; this.load = 0; this.overrun = 0; this.starter = 0; this.cut = 0;
      this.tRpm = 0; this.tLoad = 0; this.tOverrun = 0; this.tStarter = 0;
      this.crackleSetting = 1;
      const k = tau => 1 - Math.exp(-1 / (tau * sr));
      this.kRpm = k(0.03); this.kLoad = k(0.04); this.kOver = k(0.08); this.kSlow = k(0.18);
      this.kStarter = k(0.03); this.kSpool = k(0.45); this.kDump = k(0.12);
      this.kBov = Math.exp(-1 / (0.32 * sr)); this.kClick = Math.exp(-1 / (0.012 * sr));
      this.kVtec = k(0.08);
      this.e = null;
    }

    message(m) {
      if (!m) return;
      switch (m.t) {
        case 'car': this.setEngine(m.engine); break;
        case 'p':
          this.tRpm = m.rpm || 0; this.tLoad = m.load || 0; this.tOverrun = m.overrun || 0;
          this.cut = m.cut ? 1 : 0; this.tStarter = m.starter || 0;
          break;
        case 'crackle': this.crackleSetting = m.v; break;
        case 'click': this.click = 1; break;
      }
    }

    setEngine(e) {
      this.e = e || null;
      if (!e) return;
      const s = e.sound || {}, sr = this.sr, rng = this.rng;
      this.type = e.type || 'combustion';
      const firing = e.firing || [];
      this.fireAngle = firing.map(f => f[0]);
      this.fireBank = firing.map(f => f[1] || 0);
      this.trim = firing.map(() => 1 + (s.cylinderTrim || 0.03) * rng.next());
      const banks = s.banks || [{ pipeMs: 3, pan: 0 }];
      this.banks = banks.map(b => {
        const p = ((b.pan || 0) + 1) * Math.PI / 4;
        return {
          pipe: new Pipe(sr, b.pipeMs, s.reflection ?? -0.5, s.damping ?? 0.3),
          pulses: new PulseBank(),
          gl: Math.cos(p), gr: Math.sin(p)
        };
      });
      const formants = s.formants || [];
      this.formL = formants.map(f => new Biquad().bandpass(sr, f[0], f[1]));
      this.formR = formants.map(f => new Biquad().bandpass(sr, f[0], f[1]));
      this.formGain = formants.map(f => f[2]);
      const body = s.body || [90, 3];
      this.bodyL = new Biquad().peak(sr, body[0], 0.9, body[1]);
      this.bodyR = new Biquad().peak(sr, body[0], 0.9, body[1]);
      this.mufL = new Biquad(); this.mufR = new Biquad(); this.mufCount = 0;
      this.intakeBp = new Biquad().bandpass(sr, s.intakeHz || 800, 1.4);
      this.dcL = new Biquad().highpass(sr, 22); this.dcR = new Biquad().highpass(sr, 22);
      this.hissBp = new Biquad().bandpass(sr, 3000, 6);
      this.bovBp = new Biquad().bandpass(sr, 2400, 0.8);
      this.clickBp = new Biquad().bandpass(sr, 3200, 1.5);
      this.starterLp = new Biquad().lowpass(sr, 700);
      this.elecLp = new Biquad().lowpass(sr, 6000);
      this.span = Math.max(1, (e.redlineRpm || 7000) - (e.idleRpm || 800));
      this.angle = 0; this.loadSlow = 0; this.boost = 0; this.bov = 0; this.vtec = 0; this.click = 0;
      this.fanBp = new Biquad().bandpass(sr, 1800, 1.2);
      this.whinePh = 0; this.fanPh = 0; this.turboPh = 0; this.flutPh = 0; this.starterPh = 0; this.hissCount = 0;
      this.elPh0 = 0; this.elPh1 = 0; this.elPh2 = 0;
    }

    // One cylinder fires (or, with the ignition cut, pumps air and maybe pops).
    fire(k, rpmN) {
      const s = this.e.sound || {}, sr = this.sr, rng = this.rng;
      const bank = this.banks[this.fireBank[k]] || this.banks[0];
      const pIdle = (s.pulseIdleMs ?? 3) * sr / 1000, pRed = (s.pulseRedlineMs ?? 0.8) * sr / 1000;
      const jitter = s.jitter ?? 0.03;
      const w = (pIdle + (pRed - pIdle) * rpmN) * (1 + jitter * rng.next());
      const noise = s.noise ?? 0.5, over = this.overrun, load = this.load;

      if (this.starter > 0.5) {
        // Cranking: compression strokes only, no combustion.
        bank.pulses.add(w * 2, 0.07 * this.trim[k], 0.01, w);
        return;
      }
      if (this.cut) {
        bank.pulses.add(w, 0.04, 0.03 * noise, w);
      } else {
        let amp = (0.22 + 0.78 * load) * this.trim[k] * (1 + jitter * rng.next());
        if (s.lope) amp *= 1 + s.lope * (1 - rpmN) * 3 * rng.next();
        amp *= 1 - 0.45 * over;
        const na = noise * amp * (0.5 + 0.7 * load) + 0.2 * noise * over;
        bank.pulses.add(w, amp, na, w * 1.2 + 0.0015 * sr * (1 - rpmN));
      }

      // Afterfire: unburnt fuel popping in the hot exhaust on overrun or cut.
      const crackle = (s.crackle ?? 0.4) * this.crackleSetting;
      const chance = crackle * (this.cut ? 0.35 : over * 0.16);
      if (chance > 0 && rng.next() * 0.5 + 0.5 < chance) {
        const g = s.pops ?? 0.4;
        bank.pulses.add(sr * 0.0004, g * 1.6 * (0.6 + 0.4 * rng.next()), g * (0.7 + 0.5 * rng.next()), sr * (0.003 + 0.0025 * rng.next()));
      }
    }

    turboSample(t, rpm, load) {
      const sr = this.sr, rng = this.rng;
      const target = load * clamp01((rpm - (t.spoolRpm || 3000)) / (t.spoolRange || 1500));
      this.boost += (target - this.boost) * (target > this.boost ? this.kSpool : this.kDump);
      // Blow-off valve: the throttle snapped shut while the turbo was boosting.
      if (this.loadSlow - load > 0.3 && this.boost > 0.25 && this.bov < 0.15) this.bov = Math.min(1, this.boost * 1.4);

      const wl = t.whistle || [1500, 4000];
      const f = wl[0] + (wl[1] - wl[0]) * this.boost;
      this.turboPh += f / sr;
      if (this.turboPh >= 1) this.turboPh -= 1;
      if (--this.hissCount <= 0) { this.hissCount = 32; this.hissBp.bandpass(sr, f * 1.5, 5); }
      let y = (t.gain || 0.08) * this.boost * (0.3 * Math.sin(TAU * this.turboPh) + 1.2 * this.hissBp.run(rng.next()));
      if (this.bov > 1e-3) {
        let env = this.bov;
        if (t.flutter) {
          // Compressor surge: the air stutters back through the turbo.
          this.flutPh += (11 + 9 * this.bov) / sr;
          const c = 0.5 + 0.5 * Math.cos(TAU * this.flutPh);
          env *= c * c * c;
        }
        y += (t.bov || 0) * env * 2.2 * this.bovBp.run(rng.next());
        this.bov *= this.kBov;
      }
      return y;
    }

    process(L, R, n) {
      const e = this.e;
      if (!e) { for (let i = 0; i < n; i++) { L[i] = 0; R[i] = 0; } return; }
      if (this.type === 'electric') { this.processElectric(L, R, n); return; }
      const s = e.sound || {}, sr = this.sr, rng = this.rng;
      const idle = e.idleRpm || 800;
      const degPerRpm = 6 / sr;
      const intake = s.intake ?? 0.1, whine = s.whine || 0, whineRatio = s.whineRatio || 0;
      const turbo = s.turbo, fan = s.fan, drive = s.drive ?? 3, gain = s.gain ?? 0.5, dry = s.dry ?? 0.5;
      const muf = s.muffler || [1200, 6000], vtecRpm = s.vtecRpm || 0;
      const nb = this.banks.length, nf = this.fireAngle.length, nform = this.formL.length;

      for (let i = 0; i < n; i++) {
        this.rpm += (this.tRpm - this.rpm) * this.kRpm;
        this.load += (this.tLoad - this.load) * this.kLoad;
        this.overrun += (this.tOverrun - this.overrun) * this.kOver;
        this.starter += (this.tStarter - this.starter) * this.kStarter;
        this.loadSlow += (this.load - this.loadSlow) * this.kSlow;
        const rpm = this.rpm, load = this.load;
        const rpmN = clamp01((rpm - idle) / this.span);

        // Crank: fire every cylinder whose angle we passed this sample.
        const prev = this.angle;
        let ang = prev + rpm * degPerRpm;
        const wrapped = ang >= 720;
        if (wrapped) ang -= 720;
        this.angle = ang;
        if (rpm > 30) {
          for (let k = 0; k < nf; k++) {
            const a = this.fireAngle[k];
            if (wrapped ? (a > prev || a <= ang) : (a > prev && a <= ang)) this.fire(k, rpmN);
          }
        }

        let l = 0, r = 0;
        for (let b = 0; b < nb; b++) {
          const bk = this.banks[b];
          const y = bk.pipe.run(bk.pulses.run(rng));
          l += y * bk.gl; r += y * bk.gr;
        }
        let fl = l * dry, fr = r * dry;
        for (let f = 0; f < nform; f++) {
          fl += this.formGain[f] * this.formL[f].run(l);
          fr += this.formGain[f] * this.formR[f].run(r);
        }

        // Intake roar, opened up by a VTEC-style cam switch on cars that have one.
        this.vtec += ((vtecRpm && rpm > vtecRpm ? 1 : 0) - this.vtec) * this.kVtec;
        const ia = intake * (0.15 + load) * (0.3 + rpmN) * (1 + 1.6 * this.vtec) * (1 - this.starter);
        const inn = this.intakeBp.run(rng.next()) * ia;
        fl += inn; fr += inn;

        if (--this.mufCount <= 0) {
          this.mufCount = 32;
          const fc = muf[0] + (muf[1] - muf[0]) * clamp01(0.6 * load + 0.4 * rpmN + 0.3 * this.vtec);
          this.mufL.lowpass(sr, fc, 0.6); this.mufR.lowpass(sr, fc, 0.6);
        }
        fl = this.bodyL.run(this.mufL.run(fl));
        fr = this.bodyR.run(this.mufR.run(fr));

        // Sounds from the engine bay, not the tailpipe: they skip the muffler.
        let bay = 0;
        if (whine) {
          const boost = smoothstep(0.2, 0.75, load) * (0.3 + 0.7 * rpmN);
          this.whinePh += whineRatio * rpm / 60 / sr;
          if (this.whinePh >= 1) this.whinePh -= 1;
          const p = TAU * this.whinePh;
          bay += whine * boost * (Math.sin(p) + 0.8 * Math.sin(2 * p) + 0.35 * Math.sin(3 * p));
        }
        if (fan) {
          this.fanPh += fan.ratio * rpm / 60 / sr;
          if (this.fanPh >= 1) this.fanPh -= 1;
          bay += fan.gain * (0.3 + rpmN) * (Math.sin(TAU * this.fanPh) + 0.4 * this.fanBp.run(rng.next()));
        }
        if (turbo) bay += this.turboSample(turbo, rpm, load);
        if (this.starter > 0.01) {
          this.starterPh += (90 + rpm * 0.2) / sr;
          if (this.starterPh >= 1) this.starterPh -= 1;
          const comp = 0.6 + 0.4 * Math.sin(TAU * ang * Math.max(1, nf) / 720);
          bay += this.starter * 0.16 * comp * this.starterLp.run(this.starterPh < 0.5 ? 1 : -1);
        }
        if (this.click > 1e-4) {
          bay += 0.5 * this.click * this.clickBp.run(rng.next());
          this.click *= this.kClick;
        }
        fl += bay; fr += bay;

        fl = this.dcL.run(fl); fr = this.dcR.run(fr);
        L[i] = softclip(fl * drive) * gain;
        R[i] = softclip(fr * drive) * gain;
      }
    }

    // Electric motor: stator tone at the electrical frequency, slot harmonics
    // under torque and a faint inverter whine. Regen sounds like light load.
    processElectric(L, R, n) {
      const s = this.e.sound || {}, sr = this.sr, rng = this.rng;
      const pp = s.polePairs || 4, slot = s.slotRatio || 6, inv = s.inverterHz || 2400, gain = s.gain ?? 0.4;
      for (let i = 0; i < n; i++) {
        this.rpm += (this.tRpm - this.rpm) * this.kRpm;
        this.load += (this.tLoad - this.load) * this.kLoad;
        this.overrun += (this.tOverrun - this.overrun) * this.kOver;
        const f = this.rpm / 60 * pp;
        const drive = Math.max(this.load, this.overrun * 0.6);
        const amp = (0.1 + 0.9 * drive) * clamp01(this.rpm / 600);
        this.elPh0 += f / sr; if (this.elPh0 >= 1) this.elPh0 -= 1;
        this.elPh1 += f * slot / sr; if (this.elPh1 >= 1) this.elPh1 -= 1;
        this.elPh2 += (inv + f * 0.5) / sr; if (this.elPh2 >= 1) this.elPh2 -= 1;
        const p0 = TAU * this.elPh0;
        let y = amp * (0.5 * Math.sin(p0) + 0.22 * Math.sin(2 * p0) + 0.3 * drive * Math.sin(TAU * this.elPh1) +
          0.06 * Math.sin(TAU * this.elPh2) + 0.03 * rng.next());
        y = this.elecLp.run(y);
        if (this.click > 1e-4) { y += 0.3 * this.click * this.clickBp.run(rng.next()); this.click *= this.kClick; }
        L[i] = R[i] = softclip(y * 1.6) * gain;
      }
    }
  }

  if (typeof registerProcessor === 'function') {
    class EngineProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.synth = new EngineSynth(sampleRate);
        this.port.onmessage = ev => this.synth.message(ev.data);
      }
      process(inputs, outputs) {
        const out = outputs[0];
        const L = out[0], R = out[1] || out[0];
        this.synth.process(L, R, L.length);
        return true;
      }
    }
    registerProcessor('engine-processor', EngineProcessor);
  } else {
    root.EngineSynth = EngineSynth;
    if (typeof module !== 'undefined' && module.exports) module.exports = EngineSynth;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
