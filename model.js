// Jagajanin prototype — on-device model adapter.
//
// runScan(frames) takes the frames captured during the 6 sweeps and returns:
// {
//   quality:      { ok: bool, score: 0..1 },
//   viability:    { value: 'present' | 'absent',                 conf },
//   presentation: { value: 'cephalic' | 'breech' | 'transverse', conf },
//   placenta:     { value: 'normal' | 'previa',                  conf },
//   fetusCount:   { value: 1 | 2 | 3,                            conf },
//   gaWeeks:      { value: number,                               conf },
//   efwKg:        { value: number,                               conf },
// }
//
// PRODUCTION: replace runScan with the quantized Jagajanin model running on-device
// (e.g. TFLite / ONNX Runtime Web, int8), loaded from the app cache so it works offline.
//
// HACKATHON DEMO: the outputs below are SCRIPTED scenarios, not real inference.
// They exist so the end-to-end flow (sweep → fusion → fail-safe → referral) can be shown.
// The UI labels them as demo output.

const DEMO_SCENARIOS = {
  normal: {
    name: 'Ayu',
    label: 'Ayu, normal, 32 weeks',
    visit: { age: 27, gaWeeks: 32, bpSys: 110, bpDia: 70, signs: [] },
    scan: {
      quality: { ok: true, score: 0.94 },
      viability: { value: 'present', conf: 0.99 },
      presentation: { value: 'cephalic', conf: 0.95 },
      placenta: { value: 'normal', conf: 0.96 },
      fetusCount: { value: 1, conf: 0.97 },
      gaWeeks: { value: 32, conf: 0.9 },
      efwKg: { value: 1.8, conf: 0.86 },
    },
  },
  noor: {
    name: 'Noor',
    label: 'Noor, 38 y/o, breech at 30 weeks',
    visit: { age: 38, gaWeeks: 30, bpSys: 125, bpDia: 80, signs: [] },
    scan: {
      quality: { ok: true, score: 0.9 },
      viability: { value: 'present', conf: 0.99 },
      presentation: { value: 'breech', conf: 0.88 },
      placenta: { value: 'normal', conf: 0.93 },
      fetusCount: { value: 1, conf: 0.96 },
      gaWeeks: { value: 30, conf: 0.88 },
      efwKg: { value: 1.45, conf: 0.84 },
    },
  },
  previa: {
    name: 'Ratna',
    label: 'Ratna, placenta previa, 34 weeks',
    visit: { age: 31, gaWeeks: 34, bpSys: 118, bpDia: 76, signs: [] },
    scan: {
      quality: { ok: true, score: 0.91 },
      viability: { value: 'present', conf: 0.99 },
      presentation: { value: 'cephalic', conf: 0.92 },
      placenta: { value: 'previa', conf: 0.9 },
      fetusCount: { value: 1, conf: 0.95 },
      gaWeeks: { value: 34, conf: 0.87 },
      efwKg: { value: 2.3, conf: 0.85 },
    },
  },
  twins: {
    name: 'Dewi',
    label: 'Dewi, twins, 28 weeks',
    visit: { age: 29, gaWeeks: 28, bpSys: 120, bpDia: 78, signs: [] },
    scan: {
      quality: { ok: true, score: 0.88 },
      viability: { value: 'present', conf: 0.98 },
      presentation: { value: 'cephalic', conf: 0.81 },
      placenta: { value: 'normal', conf: 0.86 },
      fetusCount: { value: 2, conf: 0.91 },
      gaWeeks: { value: 28, conf: 0.83 },
      efwKg: { value: 1.0, conf: 0.8 },
    },
  },
  unsure: {
    name: 'Lina',
    label: 'Lina, poor sweep, model not sure',
    visit: { age: 24, gaWeeks: 26, bpSys: 112, bpDia: 72, signs: [] },
    scan: {
      quality: { ok: true, score: 0.71 },
      viability: { value: 'present', conf: 0.93 },
      presentation: { value: 'cephalic', conf: 0.58 },
      placenta: { value: 'normal', conf: 0.62 },
      fetusCount: { value: 1, conf: 0.9 },
      gaWeeks: { value: 26, conf: 0.66 },
      efwKg: { value: 0.9, conf: 0.55 },
    },
  },
};

async function runScan(frames, scenarioKey) {
  // Simulate on-device inference latency.
  await new Promise((r) => setTimeout(r, 1600));
  const s = DEMO_SCENARIOS[scenarioKey] || DEMO_SCENARIOS.normal;
  return JSON.parse(JSON.stringify(s.scan));
}
