/*
 * Car profiles. Each has an `engine` block (synth in engine-dsp.js and
 * drivetrain in vehicle.js), a `vehicle` block (gearbox and physics) and an
 * `art` block (body style and paint for car-art.js).
 *
 * engine.firing lists one entry per cylinder firing in a 720° cycle:
 * [crank angle in degrees, exhaust bank]. Angles follow each engine's real
 * firing order and crank layout; the bank says which pipe the pulse goes to.
 *
 * engine.sound:
 *   banks        one exhaust pipe per bank: pipeMs (length), pan (-1..1)
 *   reflection   pipe end reflection (-1..1), damping (0..1 loss per pass)
 *   formants     [hz, q, gain] resonances of the exhaust system; dry = unfiltered share
 *   pulse*Ms     exhaust pulse width at idle / redline
 *   noise        turbulence in each pulse; jitter, cylinderTrim, lope = irregularity
 *   muffler      low-pass cutoff [closed, wide open]; body = [hz, dB] cabin boom
 *   intake       intake roar level and intakeHz; vtecRpm opens the intake up
 *   whine        supercharger whine level, whineRatio = whine Hz per crank rev/s
 *   turbo        {gain, spoolRpm, spoolRange, whistle: [Hz idle, Hz full boost],
 *                 bov (blow-off level), flutter (compressor surge)}
 *   fan          air-cooling fan: {gain, ratio = blade-pass Hz per crank rev/s}
 *   crackle      afterfire pop rate on overrun / shifts; pops = pop level
 *   drive, gain  saturation drive and output level
 *
 * To add a car, append another object with the same shape.
 */

export const CARS = [
  {
    id: 'toyota-supra-mk4',
    name: 'Toyota Supra MK4',
    tagline: '3.0 L 2JZ-GTE twin-turbo inline-6 · 6-speed manual',
    art: { style: 'coupe', color: '#e8761c' },
    engine: {
      idleRpm: 800,
      redlineRpm: 6800,
      limiterRpm: 7000,
      upshiftRpm: 6600,
      launchRpm: 3200,
      peakTorqueNm: 451,
      peakTorqueRpm: 4000,
      engineBrakeNm: 55,
      // Inline-6, firing order 1-5-3-6-2-4, every 120°. The two 3-into-1
      // manifold halves (cyl 1-3 and 4-6) merge into one big single exhaust.
      firing: [[0, 0], [120, 1], [240, 0], [360, 1], [480, 0], [600, 1]],
      sound: {
        banks: [{ pipeMs: 3.6, pan: -0.12 }, { pipeMs: 3.9, pan: 0.12 }],
        reflection: -0.5,
        damping: 0.3,
        formants: [[120, 1.0, 0.9], [420, 1.6, 0.8], [1150, 2.2, 0.7], [2500, 2.5, 0.3]],
        dry: 0.45,
        pulseIdleMs: 3.2,
        pulseRedlineMs: 0.8,
        noise: 0.55,
        jitter: 0.02,
        cylinderTrim: 0.02,
        muffler: [900, 6000],
        body: [80, 4],
        intake: 0.12,
        intakeHz: 700,
        // Sequential twin turbos: the second comes in around 4,000 rpm.
        turbo: { gain: 0.1, spoolRpm: 2800, spoolRange: 1600, whistle: [1600, 4200], bov: 0.55, flutter: true },
        crackle: 0.35,
        pops: 0.35,
        drive: 3,
        gain: 0.55
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 1570,
      cdA: 0.65,
      crr: 0.012,
      maxAccel: 6.5,
      peakPowerKw: 239,
      drivetrainEff: 0.86,
      // Getrag V160.
      ratios: [3.827, 2.36, 1.685, 1.312, 1.0, 0.793],
      finalDrive: 3.266,
      tireM: 2.0
    }
  },
  {
    id: 'toyota-gr-supra',
    name: 'Toyota GR Supra',
    tagline: '3.0 L turbo inline-6 · 8-speed automatic · sport exhaust',
    art: { style: 'coupe2', color: '#f2c200' },
    engine: {
      idleRpm: 700,
      redlineRpm: 6500,
      limiterRpm: 6700,
      launchRpm: 3000,
      peakTorqueNm: 500,
      flatTorque: [1800, 5000],
      engineBrakeNm: 60,
      // B58 inline-6, 1-5-3-6-2-4.
      firing: [[0, 0], [120, 1], [240, 0], [360, 1], [480, 0], [600, 1]],
      sound: {
        banks: [{ pipeMs: 3.4, pan: -0.3 }, { pipeMs: 3.6, pan: 0.3 }],
        reflection: -0.52,
        damping: 0.32,
        formants: [[110, 1.0, 1.0], [380, 1.4, 0.8], [950, 2.0, 0.6], [2200, 2.5, 0.3]],
        dry: 0.4,
        pulseIdleMs: 3.4,
        pulseRedlineMs: 0.85,
        noise: 0.5,
        jitter: 0.02,
        cylinderTrim: 0.02,
        muffler: [800, 5200],
        body: [70, 5],
        intake: 0.08,
        intakeHz: 650,
        turbo: { gain: 0.06, spoolRpm: 1600, spoolRange: 1400, whistle: [1800, 4600], bov: 0.15, flutter: false },
        crackle: 0.9,
        pops: 0.55,
        drive: 3,
        gain: 0.55
      }
    },
    vehicle: {
      gearbox: 'auto',
      massKg: 1540,
      cdA: 0.62,
      crr: 0.011,
      maxAccel: 7.5,
      peakPowerKw: 285,
      drivetrainEff: 0.88,
      // ZF 8HP.
      ratios: [5.25, 3.36, 2.17, 1.72, 1.32, 1.0, 0.82, 0.64],
      finalDrive: 3.15,
      tireM: 2.12
    }
  },
  {
    id: 'porsche-911-gt3',
    name: 'Porsche 911 GT3',
    tagline: '4.0 L flat-six · 9,000 rpm · 7-speed PDK',
    art: { style: 'nine11', color: '#e9eef2' },
    engine: {
      idleRpm: 850,
      redlineRpm: 9000,
      limiterRpm: 9200,
      launchRpm: 4000,
      peakTorqueNm: 470,
      peakTorqueRpm: 6100,
      engineBrakeNm: 55,
      // Flat-six 1-6-2-4-3-5, cylinders 1-3 left bank, 4-6 right bank.
      firing: [[0, 0], [120, 1], [240, 0], [360, 1], [480, 0], [600, 1]],
      sound: {
        banks: [{ pipeMs: 4.6, pan: -0.4 }, { pipeMs: 4.8, pan: 0.4 }],
        reflection: -0.45,
        damping: 0.3,
        formants: [[150, 1.0, 0.8], [620, 2.2, 0.6], [1900, 2.5, 0.45], [3200, 3.0, 0.25]],
        dry: 0.4,
        pulseIdleMs: 3.0,
        pulseRedlineMs: 0.65,
        noise: 0.5,
        jitter: 0.025,
        cylinderTrim: 0.03,
        muffler: [1200, 8000],
        body: [110, 2],
        intake: 0.18,
        intakeHz: 1100,
        crackle: 0.5,
        pops: 0.4,
        drive: 3.2,
        gain: 0.55
      }
    },
    vehicle: {
      gearbox: 'dct',
      massKg: 1435,
      cdA: 0.68,
      crr: 0.011,
      maxAccel: 8.0,
      peakPowerKw: 375,
      drivetrainEff: 0.9,
      ratios: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84],
      finalDrive: 4.45,
      tireM: 2.25
    }
  },
  {
    id: 'ford-mustang-gt',
    name: 'Ford Mustang GT',
    tagline: '5.0 L Coyote V8 · crossplane burble · 6-speed manual',
    art: { style: 'muscle', color: '#1f4fa8' },
    engine: {
      idleRpm: 700,
      redlineRpm: 7500,
      limiterRpm: 7600,
      upshiftRpm: 7100,
      launchRpm: 2800,
      peakTorqueNm: 569,
      peakTorqueRpm: 4600,
      engineBrakeNm: 75,
      // Ford 1-5-4-8-6-3-7-2, cylinders 1-4 right bank, 5-8 left bank.
      // Crossplane: each bank fires unevenly, hence the burble.
      firing: [[0, 0], [90, 1], [180, 0], [270, 1], [360, 1], [450, 0], [540, 1], [630, 0]],
      sound: {
        banks: [{ pipeMs: 3.2, pan: -0.55 }, { pipeMs: 3.0, pan: 0.55 }],
        reflection: -0.55,
        damping: 0.3,
        formants: [[60, 1.1, 1.0], [200, 1.0, 1.0], [650, 1.5, 1.3], [1300, 1.8, 1.1], [2600, 2.0, 0.3]],
        dry: 0.38,
        pulseIdleMs: 5.0,
        pulseRedlineMs: 0.55,
        noise: 0.75,
        jitter: 0.03,
        cylinderTrim: 0.07,
        lope: 0.05,
        muffler: [1000, 6500],
        body: [55, 8],
        intake: 0.1,
        intakeHz: 600,
        crackle: 0.7,
        pops: 0.5,
        drive: 2,
        gain: 0.58
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 1750,
      cdA: 0.8,
      crr: 0.012,
      maxAccel: 6.5,
      peakPowerKw: 343,
      drivetrainEff: 0.86,
      ratios: [3.66, 2.43, 1.69, 1.32, 1.0, 0.65],
      finalDrive: 3.73,
      tireM: 2.13
    }
  },
  {
    id: 'dodge-challenger-hellcat',
    name: 'Dodge Challenger Hellcat',
    tagline: '6.2 L supercharged HEMI V8 · blower whine · 6-speed manual',
    art: { style: 'muscle2', color: '#6b2a8c' },
    engine: {
      idleRpm: 750,
      redlineRpm: 6200,
      limiterRpm: 6400,
      upshiftRpm: 5900,
      launchRpm: 2500,
      peakTorqueNm: 881,
      peakTorqueRpm: 4800,
      engineBrakeNm: 80,
      // HEMI 1-8-4-3-6-5-7-2, odd cylinders left bank, even right bank.
      firing: [[0, 0], [90, 1], [180, 1], [270, 0], [360, 1], [450, 0], [540, 0], [630, 1]],
      sound: {
        banks: [{ pipeMs: 2.8, pan: -0.55 }, { pipeMs: 2.5, pan: 0.55 }],
        reflection: -0.55,
        damping: 0.3,
        formants: [[48, 1.2, 1.0], [180, 0.9, 1.0], [700, 1.4, 1.8], [1450, 1.6, 2.2], [2700, 2.2, 0.3]],
        dry: 0.38,
        pulseIdleMs: 5.5,
        pulseRedlineMs: 0.5,
        noise: 0.8,
        jitter: 0.03,
        cylinderTrim: 0.08,
        lope: 0.08,
        muffler: [1300, 8000],
        body: [55, 9],
        intake: 0.08,
        intakeHz: 640,
        // Twin-screw blower: about 2 kHz of whine at 6,000 rpm.
        whine: 0.09,
        whineRatio: 20,
        crackle: 0.2,
        pops: 0.3,
        drive: 1.9,
        gain: 0.58
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 2020,
      cdA: 0.85,
      crr: 0.012,
      maxAccel: 6.8,
      peakPowerKw: 527,
      drivetrainEff: 0.85,
      // Tremec TR6060.
      ratios: [2.97, 2.1, 1.46, 1.0, 0.74, 0.5],
      finalDrive: 3.7,
      tireM: 2.29
    }
  },
  {
    id: 'ferrari-812',
    name: 'Ferrari 812 Superfast',
    tagline: '6.5 L V12 · 8,900 rpm · 7-speed dual-clutch',
    art: { style: 'gt', color: '#c4161c' },
    engine: {
      idleRpm: 1000,
      redlineRpm: 8900,
      limiterRpm: 9000,
      launchRpm: 4000,
      peakTorqueNm: 718,
      peakTorqueRpm: 7000,
      engineBrakeNm: 70,
      // 65° V12, 1-7-4-10-2-8-6-12-3-9-5-11: banks alternate every 60°.
      firing: [
        [0, 0], [60, 1], [120, 0], [180, 1], [240, 0], [300, 1],
        [360, 0], [420, 1], [480, 0], [540, 1], [600, 0], [660, 1]
      ],
      sound: {
        banks: [{ pipeMs: 2.4, pan: -0.35 }, { pipeMs: 2.5, pan: 0.35 }],
        reflection: -0.48,
        damping: 0.28,
        formants: [[220, 1.0, 0.7], [900, 2.0, 0.8], [2400, 2.5, 0.6], [4000, 3.0, 0.3]],
        dry: 0.42,
        pulseIdleMs: 2.4,
        pulseRedlineMs: 0.45,
        noise: 0.4,
        jitter: 0.02,
        cylinderTrim: 0.02,
        muffler: [1500, 9500],
        body: [120, 2],
        intake: 0.16,
        intakeHz: 1300,
        crackle: 0.4,
        pops: 0.35,
        drive: 3,
        gain: 0.52
      }
    },
    vehicle: {
      gearbox: 'dct',
      massKg: 1630,
      cdA: 0.7,
      crr: 0.011,
      maxAccel: 8.0,
      peakPowerKw: 588,
      drivetrainEff: 0.9,
      ratios: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.72],
      finalDrive: 5.0,
      tireM: 2.29
    }
  },
  {
    id: 'lamborghini-huracan',
    name: 'Lamborghini Huracán',
    tagline: '5.2 L V10 · 8,500 rpm · 7-speed dual-clutch',
    art: { style: 'supercar', color: '#78c22c' },
    engine: {
      idleRpm: 950,
      redlineRpm: 8500,
      limiterRpm: 8700,
      launchRpm: 4000,
      peakTorqueNm: 600,
      peakTorqueRpm: 6500,
      engineBrakeNm: 65,
      // 90° V10, 1-6-5-10-2-7-3-8-4-9, even fire every 72°, banks alternate.
      firing: [[0, 0], [72, 1], [144, 0], [216, 1], [288, 0], [360, 1], [432, 0], [504, 1], [576, 0], [648, 1]],
      sound: {
        banks: [{ pipeMs: 3.0, pan: -0.45 }, { pipeMs: 3.15, pan: 0.45 }],
        reflection: -0.52,
        damping: 0.28,
        formants: [[160, 1.0, 0.8], [720, 1.8, 0.9], [1700, 2.2, 0.7], [3300, 2.6, 0.35]],
        dry: 0.4,
        pulseIdleMs: 2.8,
        pulseRedlineMs: 0.5,
        noise: 0.65,
        jitter: 0.03,
        cylinderTrim: 0.04,
        muffler: [1300, 8500],
        body: [90, 4],
        intake: 0.15,
        intakeHz: 1000,
        crackle: 0.9,
        pops: 0.6,
        drive: 2.9,
        gain: 0.54
      }
    },
    vehicle: {
      gearbox: 'dct',
      massKg: 1422,
      cdA: 0.72,
      crr: 0.011,
      maxAccel: 8.5,
      peakPowerKw: 470,
      drivetrainEff: 0.88,
      ratios: [3.13, 2.29, 1.73, 1.39, 1.16, 0.98, 0.84],
      finalDrive: 4.05,
      tireM: 2.17
    }
  },
  {
    id: 'lexus-lfa',
    name: 'Lexus LFA',
    tagline: '4.8 L V10 · 9,000 rpm · the F1-style howl',
    art: { style: 'supercar2', color: '#f5f5f5' },
    engine: {
      idleRpm: 1000,
      redlineRpm: 9000,
      limiterRpm: 9200,
      launchRpm: 4200,
      peakTorqueNm: 480,
      peakTorqueRpm: 6800,
      engineBrakeNm: 55,
      revRise: 14000,
      // 72° V10, even fire.
      firing: [[0, 0], [72, 1], [144, 0], [216, 1], [288, 0], [360, 1], [432, 0], [504, 1], [576, 0], [648, 1]],
      sound: {
        banks: [{ pipeMs: 2.2, pan: -0.35 }, { pipeMs: 2.3, pan: 0.35 }],
        reflection: -0.45,
        damping: 0.26,
        formants: [[240, 1.0, 0.6], [1000, 2.0, 0.9], [2600, 2.5, 0.8], [4400, 3.0, 0.35]],
        dry: 0.4,
        pulseIdleMs: 2.2,
        pulseRedlineMs: 0.4,
        noise: 0.35,
        jitter: 0.015,
        cylinderTrim: 0.015,
        muffler: [1600, 10000],
        body: [120, 2],
        intake: 0.2,
        intakeHz: 1500,
        crackle: 0.3,
        pops: 0.3,
        drive: 3,
        gain: 0.5
      }
    },
    vehicle: {
      gearbox: 'smg',
      massKg: 1480,
      cdA: 0.66,
      crr: 0.011,
      maxAccel: 8.0,
      peakPowerKw: 412,
      drivetrainEff: 0.88,
      ratios: [3.231, 2.188, 1.609, 1.233, 1.0, 0.848],
      finalDrive: 4.3,
      tireM: 2.17
    }
  },
  {
    id: 'nissan-gtr-r35',
    name: 'Nissan GT-R (R35)',
    tagline: '3.8 L twin-turbo V6 · 6-speed dual-clutch',
    art: { style: 'coupe3', color: '#9aa3ad' },
    engine: {
      idleRpm: 750,
      redlineRpm: 7100,
      limiterRpm: 7200,
      launchRpm: 3800,
      peakTorqueNm: 652,
      flatTorque: [3600, 5600],
      engineBrakeNm: 60,
      // VR38 60° V6, 1-2-3-4-5-6, odd cylinders right bank, even left.
      firing: [[0, 0], [120, 1], [240, 0], [360, 1], [480, 0], [600, 1]],
      sound: {
        banks: [{ pipeMs: 3.4, pan: -0.3 }, { pipeMs: 3.5, pan: 0.3 }],
        reflection: -0.5,
        damping: 0.32,
        formants: [[110, 1.0, 0.9], [480, 1.6, 0.7], [1250, 2.0, 0.5], [2600, 2.5, 0.2]],
        dry: 0.45,
        pulseIdleMs: 3.4,
        pulseRedlineMs: 0.8,
        noise: 0.55,
        jitter: 0.02,
        cylinderTrim: 0.03,
        muffler: [700, 4800],
        body: [75, 5],
        intake: 0.1,
        intakeHz: 800,
        turbo: { gain: 0.12, spoolRpm: 2600, spoolRange: 1600, whistle: [1800, 4800], bov: 0.35, flutter: false },
        crackle: 0.25,
        pops: 0.3,
        drive: 3,
        gain: 0.56
      }
    },
    vehicle: {
      gearbox: 'dct',
      massKg: 1750,
      cdA: 0.71,
      crr: 0.012,
      maxAccel: 9.0,
      peakPowerKw: 441,
      drivetrainEff: 0.86,
      ratios: [4.06, 2.3, 1.59, 1.25, 1.0, 0.8],
      finalDrive: 3.7,
      tireM: 2.22
    }
  },
  {
    id: 'mazda-rx7-fd',
    name: 'Mazda RX-7 (FD)',
    tagline: '1.3 L 13B twin-rotor · sequential turbos · brap-brap idle',
    art: { style: 'coupe4', color: '#b5121b' },
    engine: {
      type: 'rotary',
      idleRpm: 850,
      redlineRpm: 8000,
      limiterRpm: 8200,
      upshiftRpm: 7600,
      launchRpm: 3800,
      peakTorqueNm: 294,
      peakTorqueRpm: 5000,
      engineBrakeNm: 35,
      revRise: 13000,
      // Twin rotor: each rotor fires once per shaft turn, rotors 180° apart.
      firing: [[0, 0], [180, 1], [360, 0], [540, 1]],
      sound: {
        banks: [{ pipeMs: 2.6, pan: -0.08 }, { pipeMs: 2.7, pan: 0.08 }],
        reflection: -0.6,
        damping: 0.25,
        formants: [[100, 1.0, 1.0], [350, 1.2, 1.0], [900, 1.6, 1.1], [2000, 2.0, 0.4]],
        dry: 0.45,
        // Wide-open exhaust ports: long, noisy pulses.
        pulseIdleMs: 4.5,
        pulseRedlineMs: 1.2,
        noise: 1.0,
        jitter: 0.04,
        cylinderTrim: 0.05,
        lope: 0.12,
        muffler: [900, 6500],
        body: [65, 6],
        intake: 0.1,
        intakeHz: 700,
        turbo: { gain: 0.09, spoolRpm: 3000, spoolRange: 1800, whistle: [1500, 3800], bov: 0.6, flutter: true },
        crackle: 1.0,
        pops: 0.7,
        drive: 2.1,
        gain: 0.55
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 1280,
      cdA: 0.58,
      crr: 0.012,
      maxAccel: 6.5,
      peakPowerKw: 206,
      drivetrainEff: 0.87,
      ratios: [3.483, 2.015, 1.391, 1.0, 0.719],
      finalDrive: 4.1,
      tireM: 1.98
    }
  },
  {
    id: 'honda-s2000',
    name: 'Honda S2000',
    tagline: '2.0 L F20C inline-4 · VTEC kicks in at 6,000 · 9,000 rpm',
    art: { style: 'roadster', color: '#c8102e' },
    engine: {
      idleRpm: 850,
      redlineRpm: 9000,
      limiterRpm: 9100,
      upshiftRpm: 8700,
      launchRpm: 4500,
      peakTorqueNm: 208,
      peakTorqueRpm: 7500,
      engineBrakeNm: 30,
      revRise: 13000,
      // Inline-4 1-3-4-2 every 180°, 4-2-1 header pairs 1+4 and 2+3.
      firing: [[0, 0], [180, 1], [360, 0], [540, 1]],
      sound: {
        banks: [{ pipeMs: 4.0, pan: -0.1 }, { pipeMs: 4.2, pan: 0.1 }],
        reflection: -0.5,
        damping: 0.3,
        formants: [[180, 1.0, 0.7], [800, 2.0, 0.8], [2100, 2.4, 0.6], [3600, 3.0, 0.3]],
        dry: 0.45,
        pulseIdleMs: 3.0,
        pulseRedlineMs: 0.7,
        noise: 0.5,
        jitter: 0.02,
        cylinderTrim: 0.03,
        muffler: [1100, 7500],
        body: [100, 3],
        intake: 0.14,
        intakeHz: 1000,
        vtecRpm: 5900,
        crackle: 0.3,
        pops: 0.3,
        drive: 3.2,
        gain: 0.56
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 1260,
      cdA: 0.6,
      crr: 0.012,
      maxAccel: 6.0,
      peakPowerKw: 177,
      drivetrainEff: 0.88,
      ratios: [3.133, 2.045, 1.481, 1.161, 0.97, 0.81],
      finalDrive: 4.1,
      tireM: 1.98
    }
  },
  {
    id: 'bmw-m3-e46',
    name: 'BMW M3 (E46)',
    tagline: '3.2 L S54 inline-6 · individual throttle bodies · 8,000 rpm',
    art: { style: 'coupe2', color: '#2b5fb5' },
    engine: {
      idleRpm: 850,
      redlineRpm: 8000,
      limiterRpm: 8100,
      upshiftRpm: 7800,
      launchRpm: 3500,
      peakTorqueNm: 365,
      peakTorqueRpm: 4900,
      engineBrakeNm: 55,
      // Inline-6 1-5-3-6-2-4, split manifold.
      firing: [[0, 0], [120, 1], [240, 0], [360, 1], [480, 0], [600, 1]],
      sound: {
        banks: [{ pipeMs: 3.8, pan: -0.3 }, { pipeMs: 4.0, pan: 0.3 }],
        reflection: -0.48,
        damping: 0.3,
        formants: [[140, 1.0, 0.8], [560, 1.8, 0.8], [1500, 2.2, 0.6], [2900, 2.6, 0.3]],
        dry: 0.42,
        pulseIdleMs: 3.0,
        pulseRedlineMs: 0.7,
        noise: 0.5,
        jitter: 0.02,
        cylinderTrim: 0.025,
        muffler: [1100, 7500],
        body: [85, 3],
        intake: 0.22,
        intakeHz: 1200,
        crackle: 0.3,
        pops: 0.3,
        drive: 3.1,
        gain: 0.55
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 1570,
      cdA: 0.65,
      crr: 0.012,
      maxAccel: 6.0,
      peakPowerKw: 252,
      drivetrainEff: 0.87,
      ratios: [4.23, 2.53, 1.67, 1.23, 1.0, 0.83],
      finalDrive: 3.62,
      tireM: 2.08
    }
  },
  {
    id: 'subaru-wrx-sti',
    name: 'Subaru WRX STI',
    tagline: '2.5 L turbo boxer-4 · unequal-length header rumble',
    art: { style: 'sedan', color: '#1d3f9a' },
    engine: {
      idleRpm: 800,
      redlineRpm: 6700,
      limiterRpm: 6900,
      upshiftRpm: 6500,
      launchRpm: 3500,
      peakTorqueNm: 393,
      peakTorqueRpm: 4000,
      engineBrakeNm: 45,
      // Boxer 1-3-2-4. The unequal-length header delays some pulses, so
      // they reach the collector unevenly: the classic boxer rumble.
      firing: [[0, 0], [195, 1], [360, 1], [555, 0]],
      sound: {
        banks: [{ pipeMs: 3.0, pan: -0.35 }, { pipeMs: 4.4, pan: 0.35 }],
        reflection: -0.55,
        damping: 0.3,
        formants: [[80, 1.0, 1.0], [260, 1.2, 1.1], [700, 1.6, 0.9], [1600, 2.0, 0.4]],
        dry: 0.42,
        pulseIdleMs: 4.2,
        pulseRedlineMs: 1.0,
        noise: 0.7,
        jitter: 0.03,
        cylinderTrim: 0.05,
        lope: 0.06,
        muffler: [800, 5500],
        body: [60, 6],
        intake: 0.1,
        intakeHz: 700,
        turbo: { gain: 0.08, spoolRpm: 3000, spoolRange: 1400, whistle: [1500, 3600], bov: 0.8, flutter: false },
        crackle: 0.5,
        pops: 0.4,
        drive: 2.5,
        gain: 0.56
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 1530,
      cdA: 0.72,
      crr: 0.012,
      maxAccel: 7.0,
      peakPowerKw: 224,
      drivetrainEff: 0.82,
      ratios: [3.636, 2.235, 1.59, 1.137, 0.891, 0.707],
      finalDrive: 3.9,
      tireM: 2.05
    }
  },
  {
    id: 'puma-gte',
    name: 'Puma GTE',
    tagline: '1.6 L air-cooled VW boxer-4 · twin carbs · 4-speed manual',
    art: { style: 'puma', color: '#d9472b' },
    engine: {
      idleRpm: 900,
      redlineRpm: 5200,
      limiterRpm: 5500,
      upshiftRpm: 4900,
      launchRpm: 2400,
      peakTorqueNm: 118,
      peakTorqueRpm: 3000,
      engineBrakeNm: 25,
      revRise: 7000,
      startFlare: 1.9,
      // VW Type 1 boxer, 1-4-3-2 every 180°: cylinders 1+2 on the right,
      // 3+4 on the left, both into one short free-flowing exhaust.
      firing: [[0, 0], [180, 1], [360, 1], [540, 0]],
      sound: {
        banks: [{ pipeMs: 2.4, pan: -0.2 }, { pipeMs: 2.9, pan: 0.2 }],
        reflection: -0.58,
        damping: 0.28,
        formants: [[95, 1.0, 1.0], [320, 1.3, 1.1], [850, 1.7, 1.0], [1900, 2.2, 0.45]],
        dry: 0.45,
        // Carburetted and air-cooled: lumpy, rattly pulses.
        pulseIdleMs: 4.0,
        pulseRedlineMs: 1.3,
        noise: 0.85,
        jitter: 0.045,
        cylinderTrim: 0.09,
        lope: 0.05,
        muffler: [700, 4500],
        body: [70, 5],
        intake: 0.13,
        intakeHz: 750,
        // The cooling fan spins at about 1.8× the crank: its blades whine.
        fan: { gain: 0.035, ratio: 50 },
        crackle: 0.45,
        pops: 0.4,
        drive: 2.6,
        gain: 0.56
      }
    },
    vehicle: {
      gearbox: 'manual',
      massKg: 760,
      cdA: 0.6,
      crr: 0.013,
      maxAccel: 4.0,
      peakPowerKw: 52,
      drivetrainEff: 0.88,
      ratios: [3.8, 2.06, 1.32, 0.89],
      finalDrive: 4.125,
      tireM: 1.85
    }
  },
  {
    id: 'harley-davidson-m8',
    name: 'Harley-Davidson Fat Boy',
    tagline: 'Milwaukee-Eight 114 · 1.9 L 45° V-twin · potato-potato idle',
    art: { style: 'cruiser', color: '#1b1d22' },
    engine: {
      idleRpm: 850,
      redlineRpm: 5500,
      limiterRpm: 5600,
      upshiftRpm: 4800,
      launchRpm: 2000,
      peakTorqueNm: 155,
      peakTorqueRpm: 3250,
      engineBrakeNm: 35,
      revRise: 6500,
      revFall: 3500,
      startFlare: 1.6,
      // 45° V-twin on a single crankpin: the rear cylinder fires 315° after
      // the front, then 405° until the front again. That gap is the lope.
      firing: [[0, 0], [315, 1]],
      sound: {
        banks: [{ pipeMs: 5.6, pan: -0.15 }, { pipeMs: 6.2, pan: 0.15 }],
        reflection: -0.6,
        damping: 0.25,
        formants: [[45, 1.2, 1.0], [140, 1.0, 1.2], [450, 1.4, 1.1], [1100, 1.8, 0.6], [2400, 2.2, 0.2]],
        dry: 0.45,
        // Huge cylinders: long, fat pulses.
        pulseIdleMs: 7.5,
        pulseRedlineMs: 2.2,
        noise: 0.9,
        jitter: 0.05,
        cylinderTrim: 0.1,
        lope: 0.12,
        muffler: [600, 4200],
        body: [50, 8],
        intake: 0.12,
        intakeHz: 500,
        crackle: 0.6,
        pops: 0.5,
        drive: 1.8,
        gain: 0.6
      }
    },
    vehicle: {
      gearbox: 'manual',
      // Bike plus rider.
      massKg: 400,
      cdA: 0.75,
      crr: 0.014,
      maxAccel: 5.0,
      peakPowerKw: 70,
      drivetrainEff: 0.9,
      // Overall ratios, primary and belt drive included.
      ratios: [9.311, 6.454, 4.793, 3.882, 3.307, 2.79],
      finalDrive: 1,
      tireM: 2.02
    }
  },
  {
    id: 'ducati-panigale-v4',
    name: 'Ducati Panigale V4 S',
    tagline: '1.1 L Desmosedici Stradale V4 · twin-pulse · 14,000 rpm',
    art: { style: 'superbike', color: '#d4141c' },
    engine: {
      idleRpm: 1300,
      redlineRpm: 14000,
      limiterRpm: 14500,
      upshiftRpm: 13600,
      launchRpm: 6000,
      peakTorqueNm: 124,
      peakTorqueRpm: 9500,
      engineBrakeNm: 20,
      revRise: 22000,
      revFall: 9000,
      // 90° V4 with a 70° crank offset, 1-2-4-3: the front pair fires close
      // together, then the rear pair (the "Twin Pulse" from MotoGP).
      firing: [[0, 0], [90, 0], [290, 1], [380, 1]],
      sound: {
        banks: [{ pipeMs: 1.7, pan: -0.2 }, { pipeMs: 1.9, pan: 0.2 }],
        reflection: -0.5,
        damping: 0.26,
        formants: [[180, 1.0, 0.8], [700, 1.6, 1.0], [1800, 2.2, 0.8], [3500, 2.8, 0.4]],
        dry: 0.42,
        pulseIdleMs: 2.4,
        pulseRedlineMs: 0.35,
        noise: 0.6,
        jitter: 0.03,
        cylinderTrim: 0.04,
        lope: 0.03,
        muffler: [1500, 9000],
        body: [110, 2],
        // Airbox roar right under the rider's chest.
        intake: 0.25,
        intakeHz: 1400,
        crackle: 0.8,
        pops: 0.5,
        drive: 2.8,
        gain: 0.55
      }
    },
    vehicle: {
      gearbox: 'quickshift',
      massKg: 280,
      cdA: 0.36,
      crr: 0.014,
      // Wheelie control keeps it near 1 g.
      maxAccel: 10,
      peakPowerKw: 158,
      drivetrainEff: 0.92,
      ratios: [2.4, 2.0, 1.737, 1.524, 1.364, 1.269],
      // Primary 1.80 × chain 42/15.
      finalDrive: 5.04,
      tireM: 2.11
    }
  },
  {
    id: 'electric',
    name: 'Electric Motor',
    tagline: 'Spaceship whine · rises with speed · near-silent regen',
    art: { style: 'sedan2', color: '#e31937' },
    engine: {
      type: 'electric',
      idleRpm: 0,
      redlineRpm: 18000,
      limiterRpm: 18000,
      peakTorqueNm: 420,
      peakTorqueRpm: 0,
      engineBrakeNm: 180,
      sound: { polePairs: 4, slotRatio: 6, inverterHz: 2400, gain: 0.4 }
    },
    vehicle: {
      gearbox: 'single',
      massKg: 1850,
      cdA: 0.58,
      crr: 0.01,
      maxAccel: 9.0,
      peakPowerKw: 330,
      drivetrainEff: 0.92,
      ratios: [1],
      finalDrive: 9.0,
      tireM: 2.1
    }
  }
];

export const DEFAULT_CAR = 'toyota-supra-mk4';

export function findCar(id) {
  return CARS.find(c => c.id === id) || CARS.find(c => c.id === DEFAULT_CAR);
}
