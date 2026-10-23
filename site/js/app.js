/*
 * app.js — wires the UI, speed source, drivetrain simulation and audio.
 *
 * Everything runs in the browser: no server calls, no accounts, no analytics.
 * The simulation ticks on a timer (it keeps the sound right even when the
 * page isn't painting); the gauge redraws on animation frames.
 */

import { CARS, findCar } from './cars.js';
import { Vehicle } from './vehicle.js';
import { Gps } from './gps.js';
import { EngineAudio } from './audio.js';
import { carSvg } from './car-art.js';
import { PHOTOS } from './photos.js';

const TICK_MS = 20;
const MPH = 2.236936;
const NEW_CARS = new Set(['toyota-supra-mk4', 'toyota-gr-supra', 'puma-gte', 'harley-davidson-m8', 'ducati-panigale-v4']);
const GEARBOX = {
  manual: 'manual', auto: 'automatic', dct: 'dual-clutch', smg: 'sequential',
  quickshift: 'quickshifter', single: 'single-speed'
};

const $ = id => document.getElementById(id);

// ---------- settings ----------
const DEFAULTS = { car: 'toyota-supra-mk4', mode: 'gps', volume: 0.8, crackle: 1, units: 'kmh', autostart: false };
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('revbox') || '{}')); } catch { /* private mode */ }
function save() {
  try { localStorage.setItem('revbox', JSON.stringify(settings)); } catch { /* private mode */ }
}

// ---------- state ----------
let car = findCar(settings.car);
const vehicle = new Vehicle();
vehicle.setCar(car);
const audio = new EngineAudio();
audio.volume = settings.volume;
const gps = new Gps(renderGpsStatus);
const pedal = { gas: 0, brake: 0, rev: false };
let throttle = 0;
let out = vehicle.update(0, { mode: 'drive', throttle: 0, brake: 0 });
let engineOn = false;
let starting = false;
let wakeLock = null;

vehicle.onClick = () => audio.post({ t: 'click' });
// For poking at it from the console.
window.revbox = { audio, vehicle, gps };

// ---------- gauge ----------
const A0 = 135, SWEEP = 270, CX = 200, CY = 200;
let gaugeMax = 8000;
let arcEl, dotEl;

function polar(r, deg) {
  const a = deg * Math.PI / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
function arcPath(r, from, to) {
  const [x0, y0] = polar(r, from), [x1, y1] = polar(r, to);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function buildGauge() {
  const e = car.engine;
  const maxK = Math.ceil((e.limiterRpm + 1) / 1000);
  gaugeMax = maxK * 1000;
  const step = maxK > 12 ? 3 : 1;
  const angle = rpm => A0 + SWEEP * rpm / gaugeMax;
  let svg = `<path d="${arcPath(160, A0, A0 + SWEEP)}" stroke="#1e2128" stroke-width="22" fill="none" stroke-linecap="round"/>`;
  if (e.type !== 'electric') {
    svg += `<path d="${arcPath(160, angle(e.redlineRpm), A0 + SWEEP)}" stroke="#8e1d2a" stroke-width="22" fill="none"/>`;
  }
  svg += `<path id="gArc" d="${arcPath(160, A0, A0 + SWEEP)}" pathLength="1" stroke="url(#gGrad)" stroke-width="22" fill="none" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1"/>`;
  for (let k = 0; k <= maxK * 2; k++) {
    const rpm = k * 500, a = angle(rpm), major = k % 2 === 0;
    const [x0, y0] = polar(major ? 128 : 133, a), [x1, y1] = polar(143, a);
    const red = e.type !== 'electric' && rpm >= e.redlineRpm;
    svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${red ? '#ff4d5a' : major ? '#d5d9df' : '#4a505b'}" stroke-width="${major ? 4 : 2.5}" stroke-linecap="round"/>`;
    if (major && (k / 2) % step === 0) {
      const [tx, ty] = polar(190, a);
      svg += `<text class="num${red ? ' red' : ''}" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${k / 2}</text>`;
    }
  }
  svg += `<text class="label" x="200" y="372">×1000 rpm</text>`;
  svg += `<circle id="gDot" r="13" fill="#ff6a1f" stroke="#0b0c0f" stroke-width="3"/>`;
  $('gauge').innerHTML = `<defs><linearGradient id="gGrad" x1="0" x2="1"><stop offset="0" stop-color="#ff9a3d"/><stop offset="1" stop-color="#ff4a1f"/></linearGradient></defs>${svg}`;
  arcEl = $('gArc');
  dotEl = $('gDot');
}

// ---------- car picker ----------
// A photo when there is one; the drawing if not, or if the photo fails to load.
function carPicture(c, loading) {
  const ph = PHOTOS[c.id];
  if (!ph) return carSvg(c);
  return `<img class="car-photo" src="${loading === 'lazy' ? ph.thumb : ph.src}" alt="${c.name}" data-id="${c.id}" loading="${loading}" decoding="async" ` +
    `style="object-position:${ph.focus || 'center'}">`;
}
document.addEventListener('error', ev => {
  const img = ev.target;
  if (img instanceof HTMLImageElement && img.classList.contains('car-photo')) img.outerHTML = carSvg(findCar(img.dataset.id));
}, true);

function renderCredits() {
  $('credits').innerHTML = CARS.filter(c => PHOTOS[c.id]).map(c => {
    const ph = PHOTOS[c.id];
    return `<li>${c.name}: <a href="${ph.source}" target="_blank" rel="noopener">${ph.author}</a>, ${ph.license}</li>`;
  }).join('');
}

function renderCar() {
  $('carArt').innerHTML = carPicture(car, 'eager');
  const ph = PHOTOS[car.id];
  $('photoCredit').innerHTML = ph
    ? `Photo: <a href="${ph.source}" target="_blank" rel="noopener">${ph.author}</a>, ${ph.license}`
    : '';
  $('carName').textContent = car.name;
  $('carTag').textContent = car.tagline;
  const e = car.engine, v = car.vehicle;
  const chips = [
    `${v.peakPowerKw} kW · ${Math.round(v.peakPowerKw * 1.341)} hp`,
    e.type === 'electric' ? 'electric' : `${e.redlineRpm.toLocaleString('en')} rpm`,
    `${v.ratios.length > 1 ? v.ratios.length + '-speed ' : ''}${GEARBOX[v.gearbox] || v.gearbox}`
  ];
  $('carSpecs').innerHTML = chips.map(c => `<span>${c}</span>`).join('');
  document.querySelectorAll('.card').forEach(el => el.classList.toggle('active', el.dataset.id === car.id));
  buildGauge();
}

function buildGrid() {
  $('carGrid').innerHTML = CARS.map(c =>
    `<button class="card" data-id="${c.id}">${carPicture(c, 'lazy')}<span>${c.name}${NEW_CARS.has(c.id) ? '<span class="new">NEW</span>' : ''}</span></button>`
  ).join('');
  $('carGrid').addEventListener('click', ev => {
    const btn = ev.target.closest('.card');
    if (btn) selectCar(btn.dataset.id);
  });
}

function selectCar(id) {
  if (id === car.id) return;
  car = findCar(id);
  settings.car = car.id;
  save();
  vehicle.setCar(car);
  audio.post({ t: 'car', engine: car.engine });
  renderCar();
}

// ---------- engine on / off ----------
async function startEngine() {
  if (engineOn || starting) return;
  starting = true;
  $('startBtn').disabled = true;
  try {
    await audio.init();
    await audio.resume();
    audio.post({ t: 'car', engine: car.engine });
    audio.post({ t: 'crackle', v: settings.crackle });
    vehicle.setCar(car);
    vehicle.start();
    audio.fadeIn();
    engineOn = true;
    if (settings.mode === 'gps') gps.start();
    requestWakeLock();
  } catch (err) {
    console.error(err);
    alert('Could not start the audio: ' + err.message);
  } finally {
    starting = false;
    $('startBtn').disabled = false;
    renderEngineStatus();
  }
}

function stopEngine() {
  if (!engineOn) return;
  engineOn = false;
  vehicle.stop();
  audio.fadeOut(0.6);
  gps.stop();
  releaseWakeLock();
  renderEngineStatus();
}

function renderEngineStatus() {
  $('startBtn').classList.toggle('on', engineOn);
  $('startLabel').textContent = engineOn ? 'STOP ENGINE' : 'START ENGINE';
  const p = $('enginePill');
  p.className = 'pill' + (engineOn ? ' on' : '');
  p.querySelector('b').textContent = engineOn ? 'Engine on' : 'Engine off';
}

function renderGpsStatus(status) {
  const p = $('gpsPill');
  const map = {
    off: ['GPS off', ''], waiting: ['GPS waiting', ' wait'], ok: ['GPS on', ' on'],
    denied: ['GPS blocked', ' bad'], error: ['GPS error', ' bad'], unsupported: ['No GPS', ' bad']
  };
  const [label, cls] = map[status] || map.off;
  p.className = 'pill' + cls;
  p.querySelector('b').textContent = label;
  $('gpsNotice').classList.toggle('hidden', status === 'ok' || settings.mode !== 'gps');
}

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && engineOn) requestWakeLock();
});

// ---------- mode ----------
function setMode(mode) {
  settings.mode = mode;
  save();
  document.body.classList.toggle('mode-drive', mode === 'drive');
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (engineOn) {
    if (mode === 'gps') gps.start();
    else gps.stop();
  }
  renderGpsStatus(gps.status);
}

// ---------- pedals & keys ----------
function bindPedal(el, onDown, onUp) {
  el.addEventListener('pointerdown', ev => {
    el.setPointerCapture(ev.pointerId);
    el.classList.add('down');
    onDown(ev);
  });
  el.addEventListener('pointermove', ev => { if (el.classList.contains('down')) onDown(ev); });
  const up = () => { el.classList.remove('down'); onUp(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', ev => ev.preventDefault());
}

// Higher on the pedal = more throttle (35 % at the bottom edge, 100 % at the top).
bindPedal($('gasPedal'), ev => {
  const r = $('gasPedal').getBoundingClientRect();
  const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
  pedal.gas = 0.35 + 0.65 * (1 - y);
}, () => { pedal.gas = 0; });
bindPedal($('brakePedal'), () => { pedal.brake = 1; }, () => { pedal.brake = 0; });
bindPedal($('revPedal'), () => { pedal.rev = true; }, () => { pedal.rev = false; });

const KEYS = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', Space: 'rev' };
function onKey(ev, down) {
  const k = KEYS[ev.code];
  if (!k || (ev.target instanceof Element && ev.target.closest('input, select'))) return;
  ev.preventDefault();
  if (k === 'gas') pedal.gas = down && settings.mode === 'drive' ? 1 : 0;
  if (k === 'brake') pedal.brake = down && settings.mode === 'drive' ? 1 : 0;
  if (k === 'rev') pedal.rev = down;
  const el = { gas: 'gasPedal', brake: 'brakePedal', rev: 'revPedal' }[k];
  $(el).classList.toggle('down', down);
}
window.addEventListener('keydown', ev => onKey(ev, true));
window.addEventListener('keyup', ev => onKey(ev, false));

// ---------- loops ----------
let lastTick = performance.now();
function tick() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;
  const target = settings.mode === 'drive' ? pedal.gas : 0;
  throttle += (target - throttle) * Math.min(1, dt * (target > throttle ? 10 : 16));
  const g = settings.mode === 'gps' ? gps.sample(now) : { speed: 0, accel: 0 };
  out = vehicle.update(dt, {
    mode: settings.mode, speed: g.speed, accel: g.accel,
    throttle, brake: pedal.brake, rev: pedal.rev
  });
  if (engineOn || out.rpm > 0) {
    audio.post({ t: 'p', rpm: out.rpm, load: out.load, overrun: out.overrun, cut: out.cut, starter: out.starter });
  }
}
setInterval(tick, TICK_MS);

let shownGear = null, shiftFlash = 0;
function render() {
  const factor = settings.units === 'mph' ? MPH : 3.6;
  $('speed').textContent = Math.round(out.speed * factor);
  const gear = !vehicle.running ? '–' : out.gear === 0 ? 'N' : car.engine.type === 'electric' ? 'D' : String(out.gear);
  if (gear !== shownGear) {
    if (shownGear !== null && /\d/.test(gear)) shiftFlash = performance.now();
    shownGear = gear;
    $('gear').textContent = gear;
  }
  $('gear').classList.toggle('shift', performance.now() - shiftFlash < 350);
  $('rpmText').textContent = `${Math.round(out.rpm / 10) * 10} rpm`;
  const f = Math.min(1, Math.max(0, out.rpm / gaugeMax));
  arcEl.setAttribute('stroke-dashoffset', String(1 - f));
  const [x, y] = polar(160, A0 + SWEEP * f);
  dotEl.setAttribute('cx', x.toFixed(1));
  dotEl.setAttribute('cy', y.toFixed(1));
  $('thBar').style.width = `${Math.round((out.throttle || 0) * 100)}%`;
  requestAnimationFrame(render);
}

// ---------- settings UI ----------
function bindSettings() {
  const vol = $('volume'), cr = $('crackle'), units = $('units'), auto = $('autostart');
  vol.value = settings.volume; cr.value = settings.crackle; units.value = settings.units; auto.checked = settings.autostart;
  vol.addEventListener('input', () => { settings.volume = +vol.value; audio.setVolume(settings.volume); save(); });
  cr.addEventListener('input', () => { settings.crackle = +cr.value; audio.post({ t: 'crackle', v: settings.crackle }); save(); });
  units.addEventListener('change', () => { settings.units = units.value; $('unit').textContent = units.value === 'mph' ? 'mph' : 'km/h'; save(); });
  auto.addEventListener('change', () => { settings.autostart = auto.checked; save(); });
  $('unit').textContent = settings.units === 'mph' ? 'mph' : 'km/h';
}

// ---------- boot ----------
buildGrid();
renderCar();
renderCredits();
bindSettings();
setMode(settings.mode);
renderEngineStatus();
requestAnimationFrame(render);

$('startBtn').addEventListener('click', () => (engineOn ? stopEngine() : startEngine()));
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('fsBtn').addEventListener('click', () => {
  const p = $('gaugePanel');
  if (document.fullscreenElement) document.exitFullscreen();
  else p.requestFullscreen?.().catch(() => {});
});

// Browsers only allow sound after a tap, so "autostart" starts on the first one.
if (settings.autostart) {
  window.addEventListener('pointerdown', ev => {
    if (!ev.target.closest('#startBtn')) startEngine();
  }, { once: true, capture: true });
}

// Not on localhost: there, a cached copy would hide every edit.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
