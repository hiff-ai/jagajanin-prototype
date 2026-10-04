// Jagajanin prototype — shared by the midwife app and the tele-specialist console.
// Priority tiers, demo referral facilities, and pre-referral actions for primary care.
//
// The action lists are a DRAFT for clinical validation against the Kemenkes PONED-PONEK
// protocols. The tele-specialist picks and edits what is sent;
// nothing here is shown to the midwife without a doctor's validation.

const TIERS = {
  urgent: { rank: 0, slaMin: 15 },
  rujuk: { rank: 1, slaMin: 60 },
  unsure: { rank: 2, slaMin: 120 },
  hati: { rank: 3, slaMin: 24 * 60 },
  aman: { rank: 4, slaMin: 72 * 60 },   // sampled audit, catches false reassurance
};

// The queue uses the MORE severe of the AI outcome and the midwife's decision.
function caseTier(c) {
  if (c.urgent) return 'urgent';
  const sev = ['rujuk', 'unsure', 'hati', 'aman'];
  return sev[Math.min(sev.indexOf(c.aiOutcome), sev.indexOf(c.final))];
}

// Demo facilities (fictional). Production: live availability from the referral system (SISRUTE).
// level: clinic = outpatient Sp.OG; poned = Puskesmas with basic emergency obstetric care;
// ponek = hospital with comprehensive emergency obstetric care (OR + blood bank).
const FACILITIES = [
  { id: 'poned', name: 'Puskesmas PONED Sukamaju', level: 'poned', km: 8, min: 20, spog: false, or: false, blood: false, nicu: false, open: true },
  { id: 'klinik', name: 'Klinik Sp.OG dr. Rahma', level: 'clinic', km: 18, min: 35, spog: true, or: false, blood: false, nicu: false, open: true, scheduledOnly: true },
  { id: 'rsmedika', name: 'RS Medika Utama', level: 'ponek', km: 25, min: 45, spog: false, or: true, blood: true, nicu: false, open: true, note: 'Sp.OG on call from 16:00' },
  { id: 'rsud', name: 'RSUD Kabupaten', level: 'ponek', km: 32, min: 55, spog: true, or: true, blood: true, nicu: false, open: true },
  { id: 'rsup', name: 'RSUP Provinsi', level: 'ponek', km: 110, min: 150, spog: true, or: true, blood: true, nicu: true, open: true },
];

// What each finding needs from the receiving facility.
const NEEDS = {
  previa: 'ponek', no_heartbeat: 'ponek', bp_severe: 'ponek', sign_bleeding: 'ponek', sign_convulsion: 'ponek',
  malpresentation_term: 'ponek', multiple: 'ponek', bp_high: 'ponek', sign_headache_vision: 'ponek',
  sign_fluid_leak: 'ponek', sign_severe_pain: 'ponek', sign_fever: 'ponek', sign_reduced_movement: 'ponek',
  sign_swelling_face_hands: 'ponek',
  efw_low: 'clinic', ga_mismatch: 'clinic', malpresentation_early: 'clinic', scan_quality: 'clinic',
};

function requiredLevel(findings) {
  const keys = findings.filter((f) => f.level !== 'ok').map((f) => f.key);
  if (keys.some((k) => NEEDS[k] === 'ponek')) return 'ponek';
  return 'clinic';
}

// Nearest AVAILABLE facility that can handle the case: capable + Sp.OG present, then by travel time.
function rankFacilities(findings, emergency) {
  const need = requiredLevel(findings);
  return FACILITIES
    .map((f) => {
      const capable = need === 'ponek' ? f.level === 'ponek' : f.spog;
      const available = f.open && f.spog && !(emergency && f.scheduledOnly);
      return { ...f, capable, available };
    })
    .sort((a, b) => (b.capable && b.available) - (a.capable && a.available) || a.min - b.min);
}

// Pre-referral actions for the midwife / Puskesmas, keyed by finding.
const ACTIONS = {
  _rujuk: [
    { id: 'kia', id_: 'Bawa Buku KIA dan surat rujukan', en: 'Bring the MCH handbook and referral letter' },
    { id: 'transport', id_: 'Siapkan transportasi (ambulans desa / ambulans Puskesmas)', en: 'Arrange transport (village / Puskesmas ambulance)' },
    { id: 'escort', id_: 'Ibu didampingi bidan dan keluarga selama rujukan', en: 'Midwife and family accompany the mother' },
  ],
  previa: [
    { id: 'no_vt', id_: 'JANGAN lakukan periksa dalam (VT)', en: 'Do NOT perform a vaginal examination' },
    { id: 'iv', id_: 'Pasang infus (cairan kristaloid)', en: 'Insert an IV line (crystalloid)' },
    { id: 'donor', id_: 'Siapkan calon donor darah dari keluarga', en: 'Identify family blood donors' },
    { id: 'bleed_edu', id_: 'Edukasi: perdarahan sekecil apa pun = segera ke RS', en: 'Educate: any bleeding = go to hospital immediately' },
  ],
  sign_bleeding: [
    { id: 'no_vt', id_: 'JANGAN lakukan periksa dalam (VT)', en: 'Do NOT perform a vaginal examination' },
    { id: 'iv', id_: 'Pasang infus (cairan kristaloid)', en: 'Insert an IV line (crystalloid)' },
    { id: 'lateral', id_: 'Posisi miring kiri, pantau tanda vital tiap 15 menit', en: 'Left lateral position, vital signs every 15 min' },
  ],
  bp_severe: [
    { id: 'mgso4', id_: 'MgSO4 dosis awal sesuai protokol PONED, atas instruksi dokter', en: 'MgSO4 loading dose per PONED protocol, on doctor\'s instruction' },
    { id: 'bp15', id_: 'Ukur tekanan darah tiap 15 menit', en: 'Measure BP every 15 minutes' },
    { id: 'iv', id_: 'Pasang infus (cairan kristaloid)', en: 'Insert an IV line (crystalloid)' },
  ],
  bp_high: [
    { id: 'bp_repeat', id_: 'Ulangi ukur tekanan darah setelah istirahat 15 menit', en: 'Repeat BP after 15 minutes\' rest' },
    { id: 'pe_signs', id_: 'Periksa tanda preeklamsia: sakit kepala, pandangan kabur, nyeri ulu hati, protein urin', en: 'Check pre-eclampsia signs: headache, blurred vision, epigastric pain, urine protein' },
  ],
  sign_convulsion: [
    { id: 'mgso4', id_: 'MgSO4 dosis awal sesuai protokol PONED, atas instruksi dokter', en: 'MgSO4 loading dose per PONED protocol, on doctor\'s instruction' },
    { id: 'airway', id_: 'Amankan jalan napas, posisi miring kiri', en: 'Secure airway, left lateral position' },
  ],
  no_heartbeat: [
    { id: 'doppler', id_: 'Konfirmasi ulang denyut jantung janin dengan Doppler bila ada', en: 'Re-check fetal heartbeat with Doppler if available' },
    { id: 'support', id_: 'Berikan dukungan psikologis untuk ibu dan keluarga', en: 'Provide emotional support to mother and family' },
  ],
  malpresentation_term: [
    { id: 'no_ecv', id_: 'Jangan lakukan versi luar di faskes primer', en: 'Do not attempt external version at primary care' },
    { id: 'labour_edu', id_: 'Edukasi: kontraksi atau ketuban pecah = langsung ke RS', en: 'Educate: contractions or waters breaking = go straight to hospital' },
    { id: 'birth_plan', id_: 'Rencanakan persalinan di RS', en: 'Plan delivery at hospital' },
  ],
  malpresentation_early: [
    { id: 'rescan36', id_: 'USG ulang pada usia kehamilan 36 minggu', en: 'Repeat scan at 36 weeks' },
  ],
  multiple: [
    { id: 'anc_spog', id_: 'ANC lanjutan oleh Sp.OG', en: 'Continue antenatal care with an obstetrician' },
    { id: 'birth_plan', id_: 'Rencanakan persalinan di RS', en: 'Plan delivery at hospital' },
    { id: 'preterm_edu', id_: 'Edukasi tanda persalinan prematur', en: 'Educate on preterm labour signs' },
  ],
  efw_low: [
    { id: 'rescan2w', id_: 'USG ulang oleh Sp.OG dalam 1–2 minggu', en: 'Repeat scan by obstetrician within 1–2 weeks' },
    { id: 'nutrition', id_: 'Evaluasi gizi ibu (LILA, Hb), beri TTD dan PMT', en: 'Assess maternal nutrition (MUAC, Hb), give iron and supplementary food' },
    { id: 'kick', id_: 'Ajarkan ibu menghitung gerak janin', en: 'Teach fetal kick counting' },
  ],
  ga_mismatch: [
    { id: 'rescan2w', id_: 'USG ulang oleh Sp.OG dalam 1–2 minggu', en: 'Repeat scan by obstetrician within 1–2 weeks' },
    { id: 'lmp_check', id_: 'Konfirmasi ulang HPHT dengan ibu', en: 'Re-confirm last period date with the mother' },
  ],
  unsure: [
    { id: 'resweep', id_: 'Ulangi 6 sisiran', en: 'Repeat the 6 sweeps' },
    { id: 'scan_spog', id_: 'Jadwalkan USG oleh Sp.OG', en: 'Schedule a scan by an obstetrician' },
  ],
  sign_reduced_movement: [
    { id: 'doppler', id_: 'Periksa denyut jantung janin dengan Doppler bila ada', en: 'Check fetal heartbeat with Doppler if available' },
  ],
  age_high: [
    { id: 'anc_freq', id_: 'Kunjungan ANC lebih sering', en: 'More frequent antenatal visits' },
  ],
};

function suggestedActions(findings, decision) {
  const keys = new Set(findings.filter((f) => f.level !== 'ok').map((f) => f.key.startsWith('unsure_') ? 'unsure' : f.key));
  if (decision === 'rescan') keys.add('unsure');
  const out = new Map();
  const add = (list) => (list || []).forEach((a) => out.set(a.id, a));
  for (const k of keys) add(ACTIONS[k]);
  if (decision === 'rujuk') add(ACTIONS._rujuk);
  return [...out.values()];
}
