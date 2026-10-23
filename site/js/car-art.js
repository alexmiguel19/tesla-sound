/*
 * car-art.js — side-view car pictures drawn as inline SVG, so the app ships
 * no image files. Each style is a body outline, a glasshouse and two wheel
 * positions in a 400×150 box, car facing right.
 */

const STYLES = {
  // Long-hood GT coupe, rounded roof (Supra MK4, RX-7).
  coupe: {
    body: 'M18 108 C16 96 26 90 44 88 L118 82 C142 64 170 54 206 53 C244 52 270 61 294 78 L352 85 C372 87 384 95 386 106 L386 114 L18 114 Z',
    glass: 'M132 82 C152 66 176 59 206 58 C236 57 260 65 280 79 Z',
    wing: 'M22 88 L22 80 L56 80 L58 86',
    wheels: [94, 306]
  },
  coupe2: {
    body: 'M18 108 C16 98 24 91 42 89 L112 83 C136 64 166 54 204 53 C240 52 266 62 292 79 L356 86 C374 88 386 96 386 107 L386 114 L18 114 Z',
    glass: 'M126 83 C148 66 174 59 204 58 C232 57 256 65 278 80 Z',
    wheels: [92, 308]
  },
  coupe3: {
    body: 'M16 106 C14 94 22 88 42 86 L110 82 C134 62 168 52 210 52 C246 52 272 62 296 80 L356 86 C376 88 386 96 386 106 L386 114 L16 114 Z',
    glass: 'M124 82 C146 64 176 58 210 58 C240 58 262 66 282 80 Z',
    wing: 'M18 86 L20 78 L60 78 L60 84',
    wheels: [94, 306]
  },
  coupe4: {
    body: 'M20 106 C18 96 26 90 46 88 L124 84 C148 66 176 58 210 58 C244 58 270 66 296 82 L358 88 C376 90 386 98 386 108 L386 114 L20 114 Z',
    glass: 'M138 84 C158 69 182 63 210 63 C238 63 260 70 282 82 Z',
    wing: 'M22 88 L24 82 L58 82 L60 87',
    wheels: [96, 306]
  },
  nine11: {
    body: 'M16 108 C14 92 30 84 62 78 C98 58 140 48 190 48 C240 48 282 62 314 82 L362 90 C380 93 388 102 386 112 L386 114 L16 114 Z',
    glass: 'M112 76 C140 58 168 53 196 53 C228 53 256 62 280 78 Z',
    wing: 'M24 76 L24 64 L74 64 L78 70',
    wheels: [96, 304]
  },
  // Low fibreglass fastback on a rear-engined VW floorpan (Puma GTE).
  puma: {
    body: 'M18 108 C16 98 26 92 46 90 L120 86 C146 66 172 58 204 58 C238 58 266 70 292 84 L356 90 C374 92 386 99 386 108 L386 114 L18 114 Z',
    glass: 'M136 86 C156 70 178 64 204 64 C230 64 252 72 274 84 Z',
    wheels: [96, 304]
  },
  muscle: {
    body: 'M14 104 L16 88 C40 84 70 82 106 80 C128 62 152 56 190 56 C228 56 250 62 274 78 L376 82 C385 84 388 92 388 100 L388 114 L14 114 Z',
    glass: 'M120 80 C138 64 160 60 190 60 C222 60 244 66 264 78 Z',
    wheels: [92, 310]
  },
  muscle2: {
    body: 'M14 104 L16 86 C40 82 72 80 110 79 C130 62 154 57 192 57 C226 57 248 62 268 76 L378 80 C386 82 388 90 388 100 L388 114 L14 114 Z',
    glass: 'M124 79 C142 64 162 61 192 61 C222 61 242 66 260 76 Z',
    wheels: [92, 312]
  },
  gt: {
    body: 'M16 106 C16 96 28 90 50 88 L92 84 C112 66 140 56 176 56 C204 56 224 64 246 80 L364 90 C380 92 388 100 386 110 L386 114 L16 114 Z',
    glass: 'M106 84 C124 68 148 61 176 61 C200 61 218 68 234 80 Z',
    wheels: [92, 310]
  },
  supercar: {
    body: 'M14 104 C14 96 22 92 40 90 L122 86 C152 64 192 54 232 56 C264 58 292 70 320 86 L372 94 C384 97 390 103 388 110 L386 114 L14 114 Z',
    glass: 'M152 84 C174 66 202 60 232 62 C256 64 276 72 298 84 Z',
    wing: 'M18 90 L18 82 L54 82 L58 88',
    wheels: [94, 312]
  },
  supercar2: {
    body: 'M14 106 C14 96 22 90 42 88 L120 84 C148 64 186 54 226 55 C260 56 290 68 318 84 L370 92 C384 95 390 102 388 110 L386 114 L14 114 Z',
    glass: 'M148 83 C170 66 198 60 226 61 C252 62 274 70 296 82 Z',
    wing: 'M20 88 L22 80 L60 80 L62 86',
    wheels: [94, 310]
  },
  roadster: {
    body: 'M16 104 C16 96 26 90 46 88 L150 84 L182 82 L262 80 C292 80 322 82 360 86 C378 88 388 96 388 106 L388 114 L16 114 Z',
    glass: 'M184 82 L206 62 L212 62 L196 82 Z',
    hoops: 'M126 84 C126 70 134 66 142 66 C150 66 156 72 156 84',
    wheels: [94, 306]
  },
  sedan: {
    body: 'M14 106 C14 96 22 90 40 88 L96 84 C118 62 144 52 186 52 L236 52 C262 54 280 64 300 80 L364 86 C380 88 388 96 388 106 L388 114 L14 114 Z',
    glass: 'M110 84 C128 64 150 58 186 58 L234 58 C254 60 270 68 286 82 Z',
    pillar: 'M196 58 L194 84',
    wing: 'M18 88 L18 80 L50 80 L52 86',
    wheels: [92, 310]
  },
  sedan2: {
    body: 'M14 106 C14 96 24 90 44 88 L96 84 C120 62 150 52 196 52 C238 52 268 62 296 80 L362 88 C380 90 388 98 388 108 L388 114 L14 114 Z',
    glass: 'M110 84 C130 64 158 57 196 57 C232 57 260 66 282 81 Z',
    pillar: 'M200 57 L198 84',
    wheels: [94, 308]
  }
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Motorcycles: drawn part by part. Wheels are bigger and closer together
// than a car's (wheelbase about 2.4 wheel diameters).
const BIKES = {
  // Cruiser: low seat, teardrop tank, chromed V-twin and long pipes.
  cruiser: {
    wheels: [112, 296],
    draw: id => `
    <path d="M70 100 C70 76 92 64 120 64 L156 66 L156 76 C134 74 116 82 108 100 Z" fill="url(#${id})"/>
    <path d="M140 100 L208 96" stroke="#2a2d33" stroke-width="7"/>
    <path d="M198 68 L216 66 L222 96 L208 98 Z" fill="#8d949e"/>
    <path d="M228 66 L248 68 L236 98 L222 96 Z" fill="#8d949e"/>
    ${[74, 80, 86, 92].map(y => `<path d="M202 ${y} L244 ${y}" stroke="#4a5058" stroke-width="2"/>`).join('')}
    <circle cx="222" cy="100" r="12" fill="#b8bec6"/>
    <path d="M210 102 C190 114 150 116 64 112" fill="none" stroke="#d2d7de" stroke-width="7" stroke-linecap="round"/>
    <path d="M236 102 C214 120 150 124 70 120" fill="none" stroke="#aab0b8" stroke-width="6" stroke-linecap="round"/>
    <path d="M134 62 C148 56 176 54 200 58 L196 68 L140 70 Z" fill="#0c0d10"/>
    <path d="M198 56 C208 42 242 40 262 48 L264 62 L200 66 Z" fill="url(#${id})"/>
    <path d="M262 44 L296 104" stroke="#c9ced6" stroke-width="6" stroke-linecap="round"/>
    <path d="M252 42 L262 30 L280 34" fill="none" stroke="#c9ced6" stroke-width="4" stroke-linecap="round"/>
    <path d="M272 82 C286 72 310 74 320 90" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round"/>
    <circle cx="276" cy="54" r="10" fill="#e9edf2"/><circle cx="276" cy="54" r="6" fill="#fff6d8"/>
    <rect x="64" y="78" width="10" height="5" rx="2" fill="#ff2a2a"/>`
  },
  // Superbike: full fairing, high pointed tail, belly exhaust.
  superbike: {
    wheels: [120, 286],
    draw: id => `
    <path d="M120 104 L196 92" stroke="#3a3f46" stroke-width="8" stroke-linecap="round"/>
    <path d="M88 52 L150 56 L160 70 L110 72 Z" fill="url(#${id})"/>
    <path d="M138 58 L188 54 L192 62 L144 66 Z" fill="#0c0d10"/>
    <path d="M150 70 C160 56 196 48 226 46 L252 40 C270 36 288 46 296 62 C300 76 292 92 276 98 L226 102 C200 104 176 100 160 92 Z" fill="url(#${id})"/>
    <path d="M176 96 L240 100 L232 112 L188 110 Z" fill="#24272d"/>
    <path d="M170 104 L204 106 L206 114 L172 112 Z" fill="#3a3f46"/>
    <path d="M182 72 L244 64" stroke="#ffffff" stroke-width="3" opacity=".75"/>
    <path d="M248 42 L268 26 L282 32 L270 44 Z" fill="#0d1117" opacity=".92"/>
    <path d="M272 52 L286 104" stroke="#d6a51e" stroke-width="6" stroke-linecap="round"/>
    <path d="M284 56 L298 60" stroke="#fff6d8" stroke-width="3" stroke-linecap="round"/>
    <rect x="86" y="50" width="8" height="4" rx="2" fill="#ff2a2a"/>`
  }
};

function bikeSvg(car, id) {
  const c = car.art.color, bike = BIKES[car.art.style], cruiser = car.art.style === 'cruiser';
  const spokes = cruiser ? 28 : 5;
  const wheel = x => `
    <circle cx="${x}" cy="104" r="36" fill="#07080a"/>
    <circle cx="${x}" cy="104" r="29" fill="${cruiser ? '#1b1d22' : '#24272d'}"/>
    ${Array.from({ length: spokes }, (_, i) => `<line x1="${x}" y1="104" x2="${x}" y2="76" stroke="${cruiser ? '#c9ced6' : c}" stroke-width="${cruiser ? 1 : 4}" transform="rotate(${i * 360 / spokes} ${x} 104)"/>`).join('')}
    <circle cx="${x}" cy="104" r="16" fill="none" stroke="#5a6068" stroke-width="2"/>
    <circle cx="${x}" cy="104" r="8" fill="#9aa1aa"/>`;
  return `
  <ellipse cx="204" cy="141" rx="140" ry="5" fill="#000" opacity=".45"/>
  ${bike.wheels.map(wheel).join('')}
  ${bike.draw(id)}`;
}

let uid = 0;

export function carSvg(car) {
  const c0 = car.art.color, id0 = 'g' + (uid++);
  if (BIKES[car.art.style]) {
    return `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${car.name}">
  <defs>
    <linearGradient id="${id0}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(c0, 0.35)}"/>
      <stop offset="0.45" stop-color="${c0}"/>
      <stop offset="1" stop-color="${shade(c0, -0.45)}"/>
    </linearGradient>
  </defs>${bikeSvg(car, id0)}
</svg>`;
  }
  const st = STYLES[car.art.style] || STYLES.coupe;
  const c = car.art.color, id = 'g' + (uid++);
  const wheel = x => `
    <circle cx="${x}" cy="112" r="29" fill="#07080a"/>
    <circle cx="${x}" cy="112" r="24" fill="#16181c"/>
    <circle cx="${x}" cy="112" r="16" fill="#9aa1aa"/>
    <circle cx="${x}" cy="112" r="13" fill="#3a3f46"/>
    ${[0, 72, 144, 216, 288].map(a => `<rect x="${x - 2}" y="99" width="4" height="13" rx="1.5" fill="#b8bec6" transform="rotate(${a} ${x} 112)"/>`).join('')}
    <circle cx="${x}" cy="112" r="4" fill="#d6dae0"/>`;
  return `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${car.name}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(c, 0.35)}"/>
      <stop offset="0.45" stop-color="${c}"/>
      <stop offset="1" stop-color="${shade(c, -0.45)}"/>
    </linearGradient>
  </defs>
  <ellipse cx="200" cy="140" rx="185" ry="7" fill="#000" opacity=".45"/>
  ${st.wing ? `<path d="${st.wing}" fill="none" stroke="${shade(c, -0.5)}" stroke-width="5" stroke-linejoin="round"/>` : ''}
  <path d="${st.body}" fill="url(#${id})"/>
  <path d="${st.glass}" fill="#0d1117" opacity=".92"/>
  ${st.pillar ? `<path d="${st.pillar}" stroke="${shade(c, -0.3)}" stroke-width="5"/>` : ''}
  ${st.hoops ? `<path d="${st.hoops}" fill="none" stroke="#1a1d22" stroke-width="5"/>` : ''}
  <path d="M40 98 L370 98" stroke="${shade(c, 0.5)}" stroke-width="1.5" opacity=".5"/>
  <rect x="372" y="94" width="13" height="5" rx="2" fill="#fff6d8"/>
  <rect x="16" y="94" width="10" height="5" rx="2" fill="#ff2a2a"/>
  ${st.wheels.map(wheel).join('')}
</svg>`;
}
