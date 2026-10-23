/*
 * Service worker: serves the app from the cache straight away (fast start,
 * works with no signal) and refreshes the cache in the background, so the
 * next visit gets any new release. Bump VERSION on every release to drop
 * the old cache.
 */
const VERSION = 'revbox-v1';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/cars.js',
  'js/vehicle.js',
  'js/gps.js',
  'js/audio.js',
  'js/car-art.js',
  'js/engine-dsp.js',
  'icon.svg',
  'manifest.webmanifest'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      if (cached) { ev.waitUntil(fresh); return cached; }
      return fresh;
    })
  );
});
