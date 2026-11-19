// Jagajanin prototype — closing the loop after a specialist validates a case.
// Shared by the midwife app, the tele-specialist console, the receiving-hospital page and the
// loop dashboard. Every validated case follows a path of steps; each step has an owner and a
// time target, and a case only closes with an outcome, evidence and an authorised person.
//
// Time targets are DRAFT values for the demo, pending agreement with the referral network.

const LOOP_PATHS = {
  rujuk: ['validated', 'acknowledged', 'informed', 'accepted', 'arrived', 'closed'],
  hati: ['validated', 'acknowledged', 'informed', 'followup', 'closed'],
  rescan: ['validated', 'acknowledged', 'informed', 'followup', 'closed'],
  aman: ['validated', 'acknowledged', 'informed', 'closed'],
};

// Who must act at each step. Closing a referral belongs to the receiving hospital.
const LOOP_OWNER = {
  validated: 'specialist', acknowledged: 'midwife', informed: 'midwife', accepted: 'hospital',
  arrived: 'hospital', followup: 'midwife',
};
function closeOwner(c) { return c.validation?.decision === 'rujuk' ? 'hospital' : 'midwife'; }

// Outcomes that complete the loop, per decision. 'not_completed' is always possible but only a
// specialist may record it, with a reason (an authorised human decision, never automatic).
const LOOP_OUTCOMES = {
  rujuk: ['admitted', 'treated_discharged', 'delivered', 'referred_on'],
  hati: ['followup_done', 'escalated_referral'],
  rescan: ['followup_done', 'escalated_referral'],
  aman: ['routine_anc'],
};
const DROP_REASONS = ['lost_contact', 'declined', 'cost', 'transport', 'went_elsewhere', 'other'];
// Roles allowed to close as completed, per decision.
const CLOSE_ROLES = { rujuk: ['hospital', 'specialist'], hati: ['midwife', 'specialist'], rescan: ['midwife', 'specialist'], aman: ['midwife', 'specialist'] };

const MIN_MS = 60000;
function loopDecision(c) { return c.validation?.decision || null; }
function loopPath(c) { return LOOP_PATHS[loopDecision(c)] || []; }
function isEmergency(c) { return c.validation?.timing === 'emergency' || !!c.urgent; }

function stageAt(c, s) {
  const v = c.validation, l = c.loop || {};
  if (!v) return null;
  return {
    validated: v.at, acknowledged: v.ackAt || null, informed: l.informed?.at || null,
    accepted: l.accepted?.at || null, arrived: l.arrived?.at || null, followup: l.followup?.at || null,
    closed: l.closed?.at || null,
  }[s] ?? null;
}

// [clock starts at step, minutes allowed]
function stageTarget(c, s) {
  const em = isEmergency(c), d = loopDecision(c);
  switch (s) {
    case 'acknowledged': return ['validated', em ? 10 : 60];
    case 'informed': return ['acknowledged', em ? 15 : 120];
    case 'accepted': return ['validated', em ? 30 : 24 * 60];
    case 'arrived': {
      if (em) return ['accepted', (c.validation?.facility?.min || 60) + 60];
      if (c.validation?.date) {
        const end = new Date(c.validation.date + 'T23:59:00').getTime();
        const from = stageAt(c, 'accepted');
        return ['accepted', from ? Math.max(60, Math.round((end - from) / MIN_MS)) : 7 * 1440];
      }
      return ['accepted', 7 * 1440];
    }
    case 'followup': return ['informed', d === 'rescan' ? 3 * 1440 : 7 * 1440];
    case 'closed': return [d === 'rujuk' ? 'arrived' : d === 'aman' ? 'informed' : 'followup', 24 * 60];
    default: return null;
  }
}

// Full state of one case's loop: each step with its owner, completion time, due time and status.
function loopState(c, now = Date.now()) {
  const path = loopPath(c);
  const l = c.loop || {};
  const dropped = l.closed?.outcome === 'not_completed';
  const steps = path.map((s) => {
    const at = stageAt(c, s);
    const tgt = stageTarget(c, s);
    const from = tgt ? stageAt(c, tgt[0]) : null;
    const dueAt = from ? from + tgt[1] * MIN_MS : null;
    const owner = s === 'closed' ? closeOwner(c) : LOOP_OWNER[s];
    return { key: s, at, owner, dueAt, late: !!(at && dueAt && at > dueAt) };
  });
  const closed = !!l.closed;
  const cur = closed ? null : steps.find((x) => !x.at) || null;
  const overdue = !!(cur && cur.dueAt && now > cur.dueAt);
  return { path, steps, closed, dropped, current: cur, owner: cur?.owner || null, overdue,
    understood: l.understood?.understood ?? null, escalations: l.escalations || [] };
}

// Plain-language message to the mother, by decision. Bahasa Indonesia and English;
// production adds recorded audio and local languages (strings are per language).
function motherMessage(c, lang) {
  const v = c.validation || {};
  const name = c.id || c.visit?.id || 'Ibu';
  const fac = v.facility?.name || '';
  const when = v.timing === 'emergency' ? null : v.date || null;
  const en = lang === 'en';
  const reply = en ? 'Reply 1 if you understand, 2 if you have a question.' : 'Balas 1 bila sudah paham, 2 bila ada pertanyaan.';
  const danger = en ? 'If you have bleeding, a bad headache or the baby moves less, go to the hospital straight away.'
    : 'Bila ada perdarahan, sakit kepala hebat atau gerak janin berkurang, segera ke rumah sakit.';
  let body;
  if (v.decision === 'rujuk' && v.timing === 'emergency') {
    body = en ? `${name}, today's scan needs an obstetrician NOW. Go to ${fac} today with your midwife. Bring your MCH handbook.`
      : `${name}, hasil USG hari ini perlu diperiksa dokter kandungan SEGERA. Berangkat ke ${fac} hari ini bersama bidan. Bawa Buku KIA.`;
  } else if (v.decision === 'rujuk') {
    body = en ? `${name}, today's scan needs a check by an obstetrician. Your appointment: ${fac}${when ? ', ' + when : ', within 7 days'}. Bring your MCH handbook.`
      : `${name}, hasil USG hari ini perlu diperiksa dokter kandungan. Jadwal Anda: ${fac}${when ? ', ' + when : ', dalam 7 hari'}. Bawa Buku KIA.`;
  } else if (v.decision === 'hati') {
    body = en ? `${name}, your scan needs closer watching. Please see your midwife again within 7 days.`
      : `${name}, hasil USG Anda perlu dipantau. Mohon kontrol ke bidan lagi dalam 7 hari.`;
  } else if (v.decision === 'rescan') {
    body = en ? `${name}, the scan was not clear enough. Please come back within 3 days to repeat it.`
      : `${name}, hasil USG belum cukup jelas. Mohon datang lagi dalam 3 hari untuk USG ulang.`;
  } else {
    body = en ? `${name}, today's scan looks normal. Keep your regular antenatal visits.`
      : `${name}, hasil USG hari ini baik. Tetap periksa kehamilan sesuai jadwal.`;
  }
  return `${body}\n${danger}\n${reply}`;
}

const LSTR = {
  id: {
    s_validated: 'Divalidasi spesialis', s_acknowledged: 'Bidan konfirmasi', s_informed: 'Ibu diberi tahu',
    s_accepted: 'RS menerima rujukan', s_arrived: 'Ibu tiba & diperiksa', s_followup: 'Kontrol ulang selesai', s_closed: 'Ditutup dengan bukti',
    o_specialist: 'Spesialis', o_midwife: 'Bidan', o_hospital: 'RS tujuan',
    owner: 'Penanggung jawab', due: 'batas', late: 'terlambat', overdue: 'lewat batas', done_at: 'selesai', waiting_for: 'Menunggu',
    trail: 'Jejak kasus', log: 'Riwayat aktivitas', closed: 'Ditutup', open: 'Terbuka',
    out_admitted: 'Dirawat inap', out_treated_discharged: 'Ditangani, pulang', out_delivered: 'Melahirkan di RS',
    out_referred_on: 'Dirujuk lanjut', out_followup_done: 'Kontrol ulang dilakukan', out_escalated_referral: 'Dinaikkan ke rujukan',
    out_routine_anc: 'ANC rutin berlanjut', out_not_completed: 'Tidak tuntas',
    r_lost_contact: 'Tidak bisa dihubungi', r_declined: 'Keluarga menolak', r_cost: 'Biaya', r_transport: 'Transportasi',
    r_went_elsewhere: 'Berobat ke tempat lain', r_other: 'Lainnya',
    understood_yes: 'Ibu paham (teach-back)', understood_no: 'Ibu punya pertanyaan',
    escalated: 'Dieskalasi', mother_msg: 'Pesan untuk ibu',
  },
  en: {
    s_validated: 'Specialist validated', s_acknowledged: 'Midwife confirmed', s_informed: 'Mother informed',
    s_accepted: 'Hospital accepted', s_arrived: 'Arrived and seen', s_followup: 'Follow-up done', s_closed: 'Closed with evidence',
    o_specialist: 'Specialist', o_midwife: 'Midwife', o_hospital: 'Receiving hospital',
    owner: 'Owner', due: 'due', late: 'late', overdue: 'overdue', done_at: 'done', waiting_for: 'Waiting for',
    trail: 'Case trail', log: 'Activity log', closed: 'Closed', open: 'Open',
    out_admitted: 'Admitted', out_treated_discharged: 'Treated and discharged', out_delivered: 'Delivered at hospital',
    out_referred_on: 'Referred onward', out_followup_done: 'Follow-up visit done', out_escalated_referral: 'Escalated to referral',
    out_routine_anc: 'Routine antenatal care continues', out_not_completed: 'Not completed',
    r_lost_contact: 'Could not be reached', r_declined: 'Family declined', r_cost: 'Cost', r_transport: 'Transport',
    r_went_elsewhere: 'Went elsewhere', r_other: 'Other',
    understood_yes: 'Mother understood (teach-back)', understood_no: 'Mother has questions',
    escalated: 'Escalated', mother_msg: 'Message to the mother',
  },
};
function lt(lang, k) { return (LSTR[lang === 'en' ? 'en' : 'id'] || LSTR.id)[k] ?? k; }

function fmtDur(ms, lang) {
  const m = Math.max(0, Math.round(ms / MIN_MS));
  const h = lang === 'en' ? 'h' : 'j';
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}${h} ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}${h}`;
}
function fmtTime(ts) {
  const d = new Date(ts), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// The trail as HTML (shared look; each page supplies the CSS classes .trail .st .st.done .st.cur .st.over).
function trailHTML(c, lang, now = Date.now()) {
  const st = loopState(c, now);
  if (!st.path.length) return '';
  return `<ol class="trail">${st.steps.map((s) => {
    const cls = s.at ? 'done' : st.current?.key === s.key ? (st.overdue ? 'cur over' : 'cur') : '';
    let meta;
    if (s.at) meta = `${lt(lang, 'done_at')} ${fmtTime(s.at)}${s.late ? ` · <span class="late">${lt(lang, 'late')}</span>` : ''}`;
    else if (st.current?.key === s.key && s.dueAt) meta = `${lt(lang, 'due')} ${fmtTime(s.dueAt)}${st.overdue ? ` · <b class="late">${lt(lang, 'overdue')} ${fmtDur(now - s.dueAt, lang)}</b>` : ` · ${fmtDur(s.dueAt - now, lang)}`}`;
    else meta = '';
    const extra = s.key === 'informed' && st.understood !== null
      ? ` · ${st.understood ? '✓ ' + lt(lang, 'understood_yes') : '? ' + lt(lang, 'understood_no')}` : '';
    const closedNote = s.key === 'closed' && c.loop?.closed
      ? ` · ${lt(lang, 'out_' + c.loop.closed.outcome)}${c.loop.closed.dropReason ? ' (' + lt(lang, 'r_' + c.loop.closed.dropReason) + ')' : ''}` : '';
    return `<li class="st ${cls}"><span class="dot"></span><div><b>${lt(lang, 's_' + s.key)}</b>
      <span class="own">${lt(lang, 'o_' + s.owner)}</span><div class="meta">${meta}${extra}${closedNote}</div></div></li>`;
  }).join('')}</ol>`;
}

function logHTML(c, lang) {
  const log = c.loop?.log || [];
  if (!log.length) return '';
  return `<ul class="loglist">${log.slice().reverse().map((e) => `<li><span>${fmtTime(e.at)}</span> <b>${loopEsc(e.by || '')}</b>
    <span class="muted">(${lt(lang, 'o_' + e.role)})</span> · ${loopEsc(e.summary || e.event)}</li>`).join('')}</ul>`;
}

async function postLoop(caseId, body) {
  const r = await fetch(`api/cases/${caseId}/loop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'failed');
  return j;
}

// CSS shared by the pages that show a trail.
const TRAIL_CSS = `
  .trail { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
  .trail .st { display: grid; grid-template-columns: 18px 1fr; gap: 8px; position: relative; padding-bottom: 10px; }
  .trail .st:not(:last-child)::after { content: ""; position: absolute; left: 6px; top: 16px; bottom: 0; width: 2px; background: var(--line); }
  .trail .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line); background: var(--card); margin-top: 3px; z-index: 1; }
  .trail .st.done .dot { background: var(--aman); border-color: var(--aman); }
  .trail .st.cur .dot { border-color: var(--blue); background: var(--blue-soft); }
  .trail .st.over .dot { border-color: var(--rujuk); background: var(--rujuk-bg); }
  .trail .own { font-size: 11px; font-weight: 700; color: var(--muted); margin-left: 6px; text-transform: uppercase; letter-spacing: .3px; }
  .trail .meta { font-size: 13px; color: var(--muted); }
  .trail .late { color: var(--rujuk); }
  .trail .st:not(.done):not(.cur) b { color: var(--muted); font-weight: 600; }
  .loglist { list-style: none; margin: 0; padding: 0; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
  .loglist span:first-child { color: var(--muted); font-variant-numeric: tabular-nums; }
`;
if (typeof document !== 'undefined') {
  const st = document.createElement('style'); st.textContent = TRAIL_CSS; document.head.appendChild(st);
}
function loopEsc(s) { return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
