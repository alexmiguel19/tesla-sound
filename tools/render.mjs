// Offline render of every car through a scripted test drive, to check levels
// and listen to the sounds without a browser.
//   node tools/render.mjs [out-dir] [car-id]
// Writes one 16-bit stereo WAV per car and prints peak / RMS per phase.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARS } from '../site/js/cars.js';
import { Vehicle } from '../site/js/vehicle.js';

const require = createRequire(import.meta.url);
const EngineSynth = require('../site/js/engine-dsp.js');

const SR = 48000, BLOCK = 128;
const outDir = process.argv[2] || 'renders';
const only = process.argv[3];
mkdirSync(outDir, { recursive: true });

// [seconds, label, input]
const SCRIPT = [
  [2.0, 'start', { throttle: 0 }],
  [1.5, 'idle', { throttle: 0 }],
  [2.0, 'rev', { throttle: 0, rev: true }],
  [1.0, 'idle2', { throttle: 0 }],
  [9.0, 'full', { throttle: 1 }],
  [3.0, 'lift', { throttle: 0 }],
  [3.0, 'cruise', { throttle: 0.25 }],
  [4.0, 'brake', { throttle: 0, brake: 0.5 }]
];

function wav(L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return buf;
}

for (const car of CARS) {
  if (only && car.id !== only) continue;
  const synth = new EngineSynth(SR);
  synth.message({ t: 'car', engine: car.engine });
  const veh = new Vehicle();
  veh.setCar(car);
  veh.onClick = () => synth.message({ t: 'click' });
  veh.start();
  const total = SCRIPT.reduce((s, p) => s + p[0], 0);
  const L = new Float32Array(Math.ceil(total * SR) + BLOCK), R = new Float32Array(L.length);
  let pos = 0;
  const report = [];
  for (const [secs, label, inp] of SCRIPT) {
    const end = pos + Math.round(secs * SR);
    let peak = 0, sum = 0, cnt = 0, maxRpm = 0, maxKmh = 0, bad = false;
    while (pos < end) {
      const o = veh.update(BLOCK / SR, { mode: 'drive', throttle: 0, brake: 0, rev: false, ...inp });
      synth.message({ t: 'p', rpm: o.rpm, load: o.load, overrun: o.overrun, cut: o.cut, starter: o.starter });
      const l = L.subarray(pos, pos + BLOCK), r = R.subarray(pos, pos + BLOCK);
      synth.process(l, r, BLOCK);
      for (let i = 0; i < BLOCK; i++) {
        const v = l[i];
        if (!Number.isFinite(v)) bad = true;
        peak = Math.max(peak, Math.abs(v), Math.abs(r[i]));
        sum += v * v; cnt++;
      }
      maxRpm = Math.max(maxRpm, o.rpm); maxKmh = Math.max(maxKmh, o.speed * 3.6);
      pos += BLOCK;
    }
    report.push(`${label}:${bad ? 'NaN!' : ''}pk${peak.toFixed(2)} rms${Math.sqrt(sum / cnt).toFixed(2)} ${Math.round(maxRpm)}rpm ${Math.round(maxKmh)}kmh g${veh.gear}`);
  }
  writeFileSync(join(outDir, car.id + '.wav'), wav(L.subarray(0, pos), R.subarray(0, pos)));
  console.log(car.id.padEnd(26), report.join(' | '));
}
