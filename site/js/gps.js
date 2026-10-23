/*
 * gps.js — speed and acceleration from the browser's Geolocation API.
 *
 * The Tesla browser delivers fixes several times a second, phones about once
 * a second. Acceleration is a least-squares fit over the recent fixes, and
 * between fixes the speed is extrapolated with it so the engine note glides
 * instead of stepping.
 */

const WINDOW_MS = 6000;
const MAX_FIXES = 8;
const MAX_EXTRAPOLATE_S = 1.5;
const STALE_MS = 5000;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export class Gps {
  constructor(onStatus) {
    this.onStatus = onStatus || (() => {});
    this.fixes = [];
    this.watch = null;
    this.a = 0;
    this.vFit = 0;
    this.status = 'off';
  }

  setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    this.onStatus(s);
  }

  start() {
    if (this.watch !== null) return;
    if (!('geolocation' in navigator)) { this.setStatus('unsupported'); return; }
    this.setStatus('waiting');
    this.watch = navigator.geolocation.watchPosition(
      p => this.fix(p),
      err => this.setStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }

  stop() {
    if (this.watch !== null) navigator.geolocation.clearWatch(this.watch);
    this.watch = null;
    this.fixes = [];
    this.a = 0;
    this.setStatus('off');
  }

  fix(p) {
    // Reception time, not p.timestamp: some browsers stamp fixes oddly.
    const now = performance.now(), c = p.coords;
    const last = this.fixes[this.fixes.length - 1];
    let v = c.speed;
    if ((v == null || !isFinite(v)) && last) {
      const dt = (now - last.t) / 1000;
      v = dt > 0.2 ? haversine(last.lat, last.lon, c.latitude, c.longitude) / dt : last.v;
    }
    if (v == null || !isFinite(v) || v < 0) v = 0;
    this.fixes.push({ t: now, v, lat: c.latitude, lon: c.longitude });
    while (this.fixes.length > MAX_FIXES || (this.fixes.length > 2 && now - this.fixes[0].t > WINDOW_MS)) this.fixes.shift();
    this.fit();
    this.setStatus('ok');
  }

  // Least-squares line through the recent fixes: slope = acceleration.
  fit() {
    const f = this.fixes, n = f.length, last = f[n - 1];
    if (n < 2) { this.a = 0; this.vFit = last.v; return; }
    let st = 0, sv = 0, stt = 0, stv = 0;
    for (const x of f) {
      const t = (x.t - last.t) / 1000;
      st += t; sv += x.v; stt += t * t; stv += t * x.v;
    }
    const den = n * stt - st * st;
    if (den < 1e-6) { this.a = 0; this.vFit = last.v; return; }
    const a = (n * stv - st * sv) / den;
    this.a = Math.max(-12, Math.min(12, a));
    this.vFit = (sv - a * st) / n;
  }

  sample(now) {
    const last = this.fixes[this.fixes.length - 1];
    if (!last) return { speed: 0, accel: 0 };
    const age = now - last.t;
    if (age > STALE_MS) { this.setStatus('waiting'); return { speed: last.v, accel: 0 }; }
    const base = 0.5 * (last.v + Math.max(0, this.vFit));
    const dt = Math.min(age / 1000, MAX_EXTRAPOLATE_S);
    return { speed: Math.max(0, base + this.a * dt), accel: this.a };
  }
}
