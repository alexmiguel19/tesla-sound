# tesla-sound (RevBox)

Engine sounds for your Tesla, driven by your real GPS speed. A static web app that runs in the Tesla browser, hosted on GitHub Pages.

**Live:** https://alexmiguel19.github.io/tesla-sound/

## How it works

- **Engine synth** ([site/js/engine-dsp.js](site/js/engine-dsp.js)): an AudioWorklet that synthesizes the sound live from each engine's firing order, crank layout, exhaust pipes and resonances, plus turbo whistle / blow-off, supercharger whine, VTEC intake, afterfire pops. No recordings.
- **Drivetrain** ([site/js/vehicle.js](site/js/vehicle.js)): turns speed into gear, rpm, load, overrun and ignition cut, with real gear ratios per car. Test-drive mode adds a physics model driven by on-screen pedals.
- **GPS** ([site/js/gps.js](site/js/gps.js)): speed from the Geolocation API, acceleration from a least-squares fit, extrapolated between fixes so the sound glides.
- **Cars and bikes** ([site/js/cars.js](site/js/cars.js)): 17 profiles, including the Toyota Supra MK4 (2JZ-GTE), GR Supra, Puma GTE, a Harley-Davidson Fat Boy and a Ducati Panigale V4 S.
- **Photos** ([site/js/photos.js](site/js/photos.js), [site/img](site/img)): freely licensed Wikimedia Commons photos, credited in the app; the drawings in car-art.js are the fallback.

There are no server or API calls at runtime: no accounts, no paywall checks, no analytics. A service worker serves the app from cache first, so it opens instantly and works without signal after the first visit.

## Run locally

```bash
npx serve site
```

Render every car to WAV files (and check levels) without a browser:

```bash
node tools/render.mjs renders
```

## Deploy

Pushing to `main` runs [.github/workflows/pages.yml](.github/workflows/pages.yml), which publishes `site/` to GitHub Pages. One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

## Add a car

Append a profile to `CARS` in [site/js/cars.js](site/js/cars.js) (the header comment documents every field). Nothing else is needed: car pictures are drawn by [site/js/car-art.js](site/js/car-art.js) from the profile's `art` block. Bump `VERSION` in [site/sw.js](site/sw.js) on each release.
