// Jagajanin prototype — decision rules.
// Fuses the ultrasound model's 5 parameters with clinical danger signs
// into AMAN / HATI-HATI / RUJUK, or TIDAK YAKIN when the evidence is too weak.
// The midwife always makes the final call; these rules only inform it.
// Thresholds are screening heuristics to be validated with the clinical team
// before any field use.

const CONF_MIN = 0.80;          // below this, a parameter counts as "not sure"
const GA_GAP_WEEKS = 2;         // AI GA vs HPHT GA discrepancy that triggers HATI-HATI
const TERM_WEEKS = 36;          // non-cephalic at/after this is a referral
const EFW_LOW_RATIO = 0.85;     // EFW below 85% of the Hadlock median ≈ 10th percentile

// Hadlock median estimated fetal weight (grams) by completed week.
const EFW_MEDIAN_G = {
  20: 331, 21: 399, 22: 478, 23: 568, 24: 670, 25: 785, 26: 913, 27: 1055,
  28: 1210, 29: 1379, 30: 1559, 31: 1751, 32: 1953, 33: 2162, 34: 2377,
  35: 2595, 36: 2813, 37: 3028, 38: 3236, 39: 3435, 40: 3619,
};

// Danger signs from the Buku KIA (Indonesian MCH handbook) / WHO ANC guidance.
const DANGER_SIGNS = [
  'bleeding', 'headache_vision', 'convulsion', 'fever', 'fluid_leak',
  'reduced_movement', 'swelling_face_hands', 'severe_pain',
];

function gaFromHpht(hpht, today = new Date()) {
  if (!hpht) return null;
  const days = (today - new Date(hpht)) / 86400000;
  return days > 0 ? Math.round((days / 7) * 10) / 10 : null;
}

// visit: { age, hpht, bpSys, bpDia, signs: [..] }
// scan:  model output (see model.js) or null when no probe was used
function assess(visit, scan) {
  const findings = [];   // { level: 'rujuk'|'hati'|'unsure'|'ok', key, src, conf?, detail? }
  const add = (level, key, src, extra = {}) => findings.push({ level, key, src, ...extra });

  // --- Clinical signs (no AI) ---
  for (const s of visit.signs || []) {
    if (DANGER_SIGNS.includes(s)) add('rujuk', 'sign_' + s, 'clinical');
  }
  if (visit.bpSys >= 160 || visit.bpDia >= 110) add('rujuk', 'bp_severe', 'clinical', { detail: `${visit.bpSys}/${visit.bpDia}` });
  else if (visit.bpSys >= 140 || visit.bpDia >= 90) add('rujuk', 'bp_high', 'clinical', { detail: `${visit.bpSys}/${visit.bpDia}` });
  if (visit.age >= 35) add('hati', 'age_high', 'clinical', { detail: visit.age });
  else if (visit.age && visit.age < 20) add('hati', 'age_low', 'clinical', { detail: visit.age });

  const gaDates = gaFromHpht(visit.hpht);

  // --- Ultrasound (AI) ---
  if (scan) {
    if (!scan.quality.ok) {
      add('unsure', 'scan_quality', 'ai', { conf: scan.quality.score });
    } else {
      const p = (name) => scan[name];
      const sure = (name) => p(name).conf >= CONF_MIN;
      const unsure = (name) => add('unsure', 'unsure_' + name, 'ai', { conf: p(name).conf });

      if (sure('viability')) {
        if (p('viability').value === 'absent') add('rujuk', 'no_heartbeat', 'ai', { conf: p('viability').conf });
        else add('ok', 'viable', 'ai', { conf: p('viability').conf });
      } else unsure('viability');

      if (sure('fetusCount')) {
        if (p('fetusCount').value > 1) add('rujuk', 'multiple', 'ai', { conf: p('fetusCount').conf, detail: p('fetusCount').value });
        else add('ok', 'singleton', 'ai', { conf: p('fetusCount').conf });
      } else unsure('fetusCount');

      if (sure('placenta')) {
        if (p('placenta').value === 'previa') add('rujuk', 'previa', 'ai', { conf: p('placenta').conf });
        else add('ok', 'placenta_ok', 'ai', { conf: p('placenta').conf });
      } else unsure('placenta');

      const gaAi = sure('gaWeeks') ? p('gaWeeks').value : null;
      const gaRef = gaDates ?? gaAi;

      if (sure('presentation')) {
        if (p('presentation').value !== 'cephalic') {
          const late = gaRef != null && gaRef >= TERM_WEEKS;
          add(late ? 'rujuk' : 'hati', late ? 'malpresentation_term' : 'malpresentation_early', 'ai',
            { conf: p('presentation').conf, detail: p('presentation').value });
        } else add('ok', 'cephalic', 'ai', { conf: p('presentation').conf });
      } else unsure('presentation');

      if (gaAi != null) {
        if (gaDates != null && Math.abs(gaAi - gaDates) > GA_GAP_WEEKS) {
          add('hati', 'ga_mismatch', 'ai', { conf: p('gaWeeks').conf, detail: `${gaAi} vs ${gaDates}` });
        } else add('ok', 'ga_consistent', 'ai', { conf: p('gaWeeks').conf, detail: gaAi });
      } else unsure('gaWeeks');

      if (sure('efwKg') && gaRef != null) {
        const median = EFW_MEDIAN_G[Math.min(40, Math.max(20, Math.floor(gaRef)))];
        if (gaRef >= 20 && p('efwKg').value * 1000 < median * EFW_LOW_RATIO) {
          add('hati', 'efw_low', 'ai', { conf: p('efwKg').conf, detail: p('efwKg').value });
        } else add('ok', 'efw_ok', 'ai', { conf: p('efwKg').conf, detail: p('efwKg').value });
      } else if (!sure('efwKg')) unsure('efwKg');
    }
  }

  // --- Fuse ---
  // A confident RUJUK finding always wins. Otherwise any "not sure" blocks AMAN:
  // the tool never reassures on weak evidence.
  const has = (lvl) => findings.some((f) => f.level === lvl);
  let outcome = 'aman';
  if (has('rujuk')) outcome = 'rujuk';
  else if (has('unsure')) outcome = 'unsure';
  else if (has('hati')) outcome = 'hati';

  const urgent = findings.some((f) => ['no_heartbeat', 'sign_bleeding', 'sign_convulsion', 'bp_severe'].includes(f.key));
  return { outcome, urgent, findings, gaDates, scanned: !!scan };
}

if (typeof module !== 'undefined') module.exports = { assess, gaFromHpht, CONF_MIN };
