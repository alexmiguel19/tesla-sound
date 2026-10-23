/*
 * vehicle.js — virtual drivetrain.
 *
 * Turns road speed into what a combustion car would be doing at that speed:
 * gear, engine rpm, combustion load, overrun and ignition cut. Speed comes
 * from GPS (throttle estimated from acceleration) or, in test-drive mode,
 * from a small physics model driven by the on-screen pedals.
 */

const G = 9.81;
const RHO = 1.2;
const TAU = Math.PI * 2;
// Seconds for a gear change: [ignition cut / clutch phase, total].
const SHIFT = {
  dct: [0.06, 0.1],
  quickshift: [0.05, 0.07],
  smg: [0.12, 0.18],
  auto: [0.1, 0.3],
  manual: [0.35, 0.55]
};

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const approach = (x, target, step) => (x < target ? Math.min(target, x + step) : Math.max(target, x - step));

export class Vehicle {
  constructor() {
    this.state = 'off';
    this.speed = 0;
    this.accel = 0;
    this.rpm = 0;
    this.gear = 0;
    this.th = 0;
    this.onClick = null;
  }

  setCar(car) {
    this.car = car;
    this.e = car.engine;
    this.v = car.vehicle;
    this.electric = this.e.type === 'electric';
    this.gear = this.state === 'off' ? 0 : 1;
    this.shiftT = 0;
    this.sinceShift = 1;
    this.limiterCut = false;
    if (this.state === 'running' && !this.electric) this.rpm = Math.max(this.rpm, this.e.idleRpm);
  }

  get running() { return this.state !== 'off'; }

  start() {
    if (this.state !== 'off') return;
    this.state = this.electric ? 'running' : 'cranking';
    this.t = 0;
    this.gear = 1;
  }

  stop() {
    this.state = 'off';
    this.gear = 0;
  }

  // Engine torque (Nm) at rpm, from a simple curve capped by peak power.
  torque(rpm) {
    const e = this.e, v = this.v;
    let f;
    if (this.electric) f = 1;
    else {
      const flat = e.flatTorque;
      const pr = flat ? flat[0] : e.peakTorqueRpm;
      const end = flat ? flat[1] : e.peakTorqueRpm;
      if (rpm < pr) { const x = clamp(rpm / pr, 0, 1); f = 0.55 + 0.45 * (1 - (1 - x) * (1 - x)); }
      else if (rpm <= end) f = 1;
      else f = 1 - 0.3 * Math.pow((rpm - end) / Math.max(1, e.redlineRpm - end), 2);
    }
    const w = Math.max(rpm, 300) * TAU / 60;
    return Math.min(e.peakTorqueNm * f, v.peakPowerKw * 1000 / w);
  }

  ratio(gear) {
    const v = this.v;
    return v.ratios[clamp(gear, 1, v.ratios.length) - 1] * v.finalDrive;
  }

  wheelRpm() { return this.speed / this.v.tireM * 60; }

  resistance(speed) {
    const v = this.v;
    return 0.5 * RHO * v.cdA * speed * speed + (speed > 0.05 ? v.crr * v.massKg * G : 0);
  }

  // Gear-change thresholds for a given throttle (0..1).
  upshiftRpm(th) {
    const e = this.e;
    const full = e.upshiftRpm || e.redlineRpm * 0.97;
    const light = Math.max(e.idleRpm * 2.6, 2300);
    return light + (full - light) * Math.pow(th, 1.3);
  }

  downshiftRpm(th) {
    const e = this.e;
    const low = Math.max(e.idleRpm * 1.45, 1150);
    return low + (this.upshiftRpm(1) * 0.62 - low) * Math.pow(th, 1.5);
  }

  /*
   * Advance by dt seconds. inp: {mode: 'gps'|'drive', speed, accel (GPS),
   * throttle, brake (pedals, 0..1), rev (REV button held)}.
   * Returns what the synth and the gauge need.
   */
  update(dt, inp) {
    const e = this.e;
    const out = { rpm: 0, load: 0, overrun: 0, cut: false, starter: 0, gear: this.gear, speed: this.speed, throttle: 0 };

    if (inp.mode === 'gps') {
      this.speed = inp.speed < 0.6 ? 0 : inp.speed;
      this.accel = inp.accel;
    }

    if (this.state === 'off') {
      this.rpm = approach(this.rpm, 0, 2500 * dt);
      if (inp.mode === 'drive') this.coast(dt, inp.brake);
      out.rpm = this.rpm; out.speed = this.speed; out.gear = 0;
      return out;
    }

    if (this.state === 'cranking') {
      this.t += dt;
      const idle = e.idleRpm;
      if (this.t < 0.75) {
        this.rpm = 200 + 40 * Math.sin(this.t * 40);
        out.starter = 1;
      } else if (this.t < 1.5) {
        // Catches and flares up before settling to idle.
        const flare = idle * (e.startFlare || 1.7);
        this.rpm = this.t < 1.0 ? approach(this.rpm, flare, 9000 * dt) : approach(this.rpm, idle, 2200 * dt);
        out.load = this.t < 1.0 ? 0.55 : 0.15;
      } else {
        this.state = 'running';
      }
      out.rpm = this.rpm; out.speed = this.speed; out.gear = this.gear;
      return out;
    }

    // Throttle: the pedal in test drive, estimated from acceleration on GPS.
    let th;
    if (inp.mode === 'drive') th = inp.throttle;
    else th = this.estimateThrottle(dt);
    this.th = th;

    const freeRev = this.speed < 0.5 && (inp.rev || (inp.mode === 'drive' && inp.brake > 0.1 && inp.throttle > 0));
    if (freeRev) return this.revInNeutral(dt, Math.max(inp.rev ? 1 : 0, inp.mode === 'drive' ? inp.throttle : 0), out);

    if (this.electric) return this.electricStep(dt, th, inp, out);
    return this.gearedStep(dt, th, inp, out);
  }

  estimateThrottle(dt) {
    const v = this.v;
    const r = v.tireM / TAU;
    const need = v.massKg * this.accel + this.resistance(this.speed);
    const rpm = Math.max(this.rpm, this.electric ? 1000 : this.e.idleRpm);
    const avail = this.torque(rpm) * this.ratio(Math.max(1, this.gear)) * v.drivetrainEff / r;
    const target = this.speed < 0.6 && this.accel < 0.3 ? 0 : clamp(need / avail, 0, 1);
    this.thEst = (this.thEst || 0) + (target - (this.thEst || 0)) * Math.min(1, dt / 0.2);
    return this.thEst;
  }

  // Parked: the engine revs freely, bouncing off the limiter.
  revInNeutral(dt, th, out) {
    const e = this.e;
    const top = this.electric ? 0 : e.limiterRpm;
    if (this.electric) {
      this.rpm = approach(this.rpm, th * 6000, 9000 * dt);
      out.rpm = this.rpm; out.load = th; out.gear = 0; out.speed = this.speed; out.throttle = th;
      return out;
    }
    if (this.rpm >= top) this.limiterCut = true;
    else if (this.rpm < top - 280) this.limiterCut = false;
    const target = th > 0.02 && !this.limiterCut ? e.idleRpm + th * (top + 200 - e.idleRpm) : e.idleRpm;
    const rate = target > this.rpm ? (e.revRise || 9000) * Math.max(th, 0.3) : (e.revFall || 5000);
    this.rpm = approach(this.rpm, target, rate * dt);
    out.rpm = this.rpm;
    out.cut = this.limiterCut;
    out.load = this.limiterCut ? 0 : th > 0.02 ? 0.25 + 0.75 * th : 0.12;
    out.overrun = th < 0.05 ? clamp((this.rpm - e.idleRpm * 1.3) / 2000, 0, 1) : 0;
    out.gear = 0; out.speed = this.speed; out.throttle = th;
    this.gear = 1;
    return out;
  }

  electricStep(dt, th, inp, out) {
    const v = this.v, e = this.e;
    this.gear = 1;
    if (inp.mode === 'drive') {
      const r = v.tireM / TAU;
      let F = this.torque(this.rpm) * th * this.ratio(1) * v.drivetrainEff / r;
      if (th < 0.05 && this.speed > 1) F -= (e.engineBrakeNm || 150) * this.ratio(1) / r * clamp(this.speed / 8, 0, 1);
      this.integrate(dt, F, inp.brake);
    }
    this.rpm = this.wheelRpm() * this.ratio(1);
    out.rpm = this.rpm;
    out.load = th;
    out.overrun = th < 0.05 && this.speed > 2 ? clamp(-this.accel / 2.5, 0.15, 1) : 0;
    out.gear = 1; out.speed = this.speed; out.throttle = th;
    return out;
  }

  gearedStep(dt, th, inp, out) {
    const e = this.e, v = this.v;
    const idle = e.idleRpm, lim = e.limiterRpm;
    const box = SHIFT[v.gearbox] || SHIFT.auto;
    const nGears = v.ratios.length;
    this.sinceShift += dt;
    if (this.gear < 1) this.gear = 1;
    if (this.speed < 1 && this.gear > 1 && this.shiftT <= 0) this.gear = 1;

    // Gear selection (starts a shift; the shift itself plays out below).
    let geared = this.wheelRpm() * this.ratio(this.gear);
    if (this.shiftT <= 0 && this.sinceShift > 0.5) {
      // A driver with a manual box stays in gear when lifting off, unless it's near the limiter.
      const holdGear = v.gearbox === 'manual' && th < 0.1 && geared < this.upshiftRpm(1);
      if (this.gear < nGears && geared > this.upshiftRpm(th) && !holdGear) this.beginShift(1, th, box);
      else if (this.gear > 1) {
        const lower = this.wheelRpm() * this.ratio(this.gear - 1);
        const kick = th > 0.85 && lower < this.upshiftRpm(1) * 0.92 && geared < this.upshiftRpm(1) * 0.68;
        if ((geared < this.downshiftRpm(th) && lower < this.upshiftRpm(th) * 0.85) || kick) this.beginShift(-1, th, box);
      }
    }
    geared = this.wheelRpm() * this.ratio(this.gear);

    let load, cut = false, engaged = true, target;
    if (this.shiftT > 0) {
      this.shiftT -= dt;
      const inCut = this.shiftT > box[1] - box[0];
      if (v.gearbox === 'manual') {
        // Clutch in: the revs drop (or are blipped up on a downshift), no drive.
        engaged = !inCut;
        target = inCut ? (this.shiftDir > 0 ? Math.max(idle, geared) : geared * 1.05) : geared;
        load = inCut ? (this.shiftDir < 0 ? 0.35 : 0) : th;
        if (!inCut && !this.clicked) { this.clicked = true; this.onClick && this.onClick(); }
      } else {
        cut = inCut && this.shiftDir > 0 && th > 0.55;
        engaged = !inCut;
        target = geared;
        load = cut ? 0 : th;
      }
    } else {
      // Below the gear's idle speed the clutch / converter slips.
      const slip = idle + th * ((e.launchRpm || idle * 3) - idle);
      target = Math.max(geared, th > 0.05 && this.gear === 1 ? slip : idle);
      load = th;
    }

    // Rev limiter in gear.
    if (this.rpm >= lim) this.limiterCut = true;
    else if (this.rpm < lim - 250) this.limiterCut = false;
    if (this.limiterCut && th > 0.1) { cut = true; load = 0; }

    if (inp.mode === 'drive') {
      const r = v.tireM / TAU, ratio = this.ratio(this.gear);
      let F = 0;
      if (engaged) {
        F = cut ? 0 : this.torque(this.rpm) * th * ratio * v.drivetrainEff / r;
        if (th < 0.05) F -= (e.engineBrakeNm || 60) * (this.rpm / e.redlineRpm) * ratio / r;
      }
      this.integrate(dt, F, inp.brake);
      geared = this.wheelRpm() * ratio;
      if (this.shiftT <= 0) target = Math.max(geared, target);
    }

    const up = this.shiftT > 0 && v.gearbox !== 'manual' ? 30000 : 14000;
    this.rpm = approach(this.rpm, Math.min(target, lim + 150), up * dt);
    if (this.rpm < idle && target <= idle) this.rpm = approach(this.rpm, idle, 3000 * dt);

    const atIdle = this.rpm < idle * 1.2;
    out.rpm = this.rpm;
    out.load = Math.max(load, atIdle ? 0.12 : 0);
    out.overrun = th < 0.06 && !atIdle ? clamp((this.rpm - idle * 1.25) / 1600, 0, 1) * (1 - th / 0.06) : 0;
    out.cut = cut;
    out.gear = this.gear;
    out.speed = this.speed;
    out.throttle = th;
    return out;
  }

  beginShift(dir, th, box) {
    this.gear += dir;
    this.shiftDir = dir;
    this.shiftT = box[1];
    this.sinceShift = 0;
    this.clicked = false;
  }

  integrate(dt, F, brake) {
    const v = this.v;
    const brakeF = brake * 0.95 * v.massKg * G;
    let a = (F - this.resistance(this.speed) - (this.speed > 0 ? brakeF : 0)) / v.massKg;
    a = Math.min(a, v.maxAccel);
    this.speed = Math.max(0, this.speed + a * dt);
    if (this.speed === 0 && a < 0) a = 0;
    this.accel = a;
  }

  coast(dt, brake) { this.integrate(dt, 0, brake); }
}
