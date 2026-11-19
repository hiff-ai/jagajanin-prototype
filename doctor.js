// Jagajanin prototype — tele-specialist (Sp.OG) console.
// Queue of cases from midwives, sorted by risk then waiting time; full assessment + raw sweep
// videos; the specialist validates, picks the nearest available capable facility, and sends
// pre-referral actions back to the midwife.

const DSTR = {
  id: {
    doctor: 'dr. Aditya, Sp.OG (demo)', queue: 'Antrean', done: 'Berjalan', closed_tab: 'Ditutup',
    k_loop: 'Loop lewat batas', k_loop_s: 'dari {n} kasus terbuka', step_now: 'Langkah kini', escalate: 'Eskalasi', escalate_to: 'Eskalasi ke',
    close_nc: 'Tutup sebagai tidak tuntas', close_nc_s: 'Hanya spesialis. Wajib alasan.', reason: 'Alasan', evidence_note: 'Catatan / bukti', close: 'Tutup kasus',
    close_done: 'Tutup sebagai selesai', outcome: 'Hasil', evidence: 'Bukti (no. rekam medis, ringkasan, catatan kunjungan)', hospital_page: 'Halaman RS tujuan', dash: 'Dasbor loop',
    sort_risk: 'Risiko → waktu tunggu', sort_new: 'Terbaru masuk', sort_wait: 'Terlama menunggu',
    tier_urgent: 'GAWAT', tier_rujuk: 'RUJUK', tier_unsure: 'TIDAK YAKIN', tier_hati: 'HATI-HATI', tier_aman: 'AMAN · audit',
    waiting: 'menunggu', overdue: 'lewat target', target: 'target', empty: 'Tidak ada kasus.', pick: 'Pilih kasus dari antrean.',
    ai: 'AI', midwife: 'Bidan', override: 'diubah bidan', received: 'Diterima',
    findings: 'Temuan', params: 'Parameter USG (AI)', clinical: 'Data klinis', videos: 'Video sisiran (mentah)',
    not_uploaded: 'belum terunggah', not_recorded: 'tidak direkam', no_scan: 'Tanpa USG — hanya tanda klinis',
    p_viability: 'Denyut / viabilitas', p_presentation: 'Presentasi', p_placenta: 'Plasenta', p_fetusCount: 'Jumlah janin',
    p_gaWeeks: 'Usia kehamilan', p_efwKg: 'Perkiraan berat janin', quality: 'Kualitas scan',
    age: 'Usia ibu', hpht: 'HPHT', ga_dates: 'UK (HPHT)', bp: 'Tekanan darah', signs: 'Tanda bahaya', none: 'tidak ada',
    validate: 'Validasi spesialis', d_rujuk: 'Konfirmasi RUJUK', d_hati: 'HATI-HATI (pantau)', d_aman: 'AMAN', d_rescan: 'Minta scan ulang',
    timing: 'Waktu rujukan', t_emergency: 'Segera (gawat)', t_scheduled: 'Terjadwal',
    facility: 'Faskes rujukan — terdekat yang tersedia & mampu', nearest: 'Terdekat & tersedia',
    spog_on: 'Sp.OG jaga', spog_off: 'Sp.OG tidak jaga', ponek: 'PONEK (OK + bank darah)', poned: 'PONED', clinic: 'Klinik Sp.OG',
    not_capable: 'tidak sesuai kebutuhan kasus', scheduled_only: 'hanya terjadwal', minutes: 'menit',
    actions: 'Tindakan segera di faskes primer (dikirim ke bidan)', draft: 'Draf protokol — perlu validasi klinis',
    note: 'Catatan untuk bidan', send: 'Kirim ke bidan',
    sent: 'Validasi terkirim', acked: 'Bidan mengonfirmasi', ack_wait: 'Menunggu konfirmasi bidan', actions_done: 'tindakan dicentang',
    urgent_parallel: 'Kasus gawat: bidan sudah diminta merujuk segera. Validasi Anda menentukan tujuan & tindakan.',
    demo: 'DEMO: data dan faskes fiktif. Video adalah klip sintetis kecuali bidan merekam video asli.',
    k_clinics: 'Puskesmas terhubung', k_clinics_s: 'semua kirim ke antrean ini', k_scans: 'Scan 24 jam', k_scans_s: 'total {n} kasus',
    k_pending: 'Menunggu validasi', k_over: 'Lewat target', k_over_s: 'dari {n} menunggu',
    k_resp: 'Respons RUJUK', k_resp_s: 'median, terima → validasi', k_agree: 'AI ↔ bidan sepakat', k_agree_s: '{n} keputusan diubah bidan',
    all_clinics: 'Semua Puskesmas', new: 'BARU',
  },
  en: {
    doctor: 'dr. Aditya, Sp.OG (demo)', queue: 'Queue', done: 'In progress', closed_tab: 'Closed',
    k_loop: 'Loops overdue', k_loop_s: 'of {n} open cases', step_now: 'Current step', escalate: 'Escalate', escalate_to: 'Escalate to',
    close_nc: 'Close as not completed', close_nc_s: 'Specialist only. A reason is required.', reason: 'Reason', evidence_note: 'Note / evidence', close: 'Close case',
    close_done: 'Close as completed', outcome: 'Outcome', evidence: 'Evidence (record number, summary or visit note)', hospital_page: 'Receiving-hospital page', dash: 'Loop dashboard',
    sort_risk: 'Risk → waiting time', sort_new: 'Newest first', sort_wait: 'Longest waiting',
    tier_urgent: 'EMERGENCY', tier_rujuk: 'REFER', tier_unsure: 'NOT SURE', tier_hati: 'CAUTION', tier_aman: 'SAFE · audit',
    waiting: 'waiting', overdue: 'overdue', target: 'target', empty: 'No cases.', pick: 'Select a case from the queue.',
    ai: 'AI', midwife: 'Midwife', override: 'midwife override', received: 'Received',
    findings: 'Findings', params: 'Ultrasound parameters (AI)', clinical: 'Clinical data', videos: 'Raw sweep videos',
    not_uploaded: 'not uploaded yet', not_recorded: 'not recorded', no_scan: 'No ultrasound — clinical signs only',
    p_viability: 'Heartbeat / viability', p_presentation: 'Presentation', p_placenta: 'Placenta', p_fetusCount: 'Number of fetuses',
    p_gaWeeks: 'Gestational age', p_efwKg: 'Estimated fetal weight', quality: 'Scan quality',
    age: 'Mother\'s age', hpht: 'LMP', ga_dates: 'GA (LMP)', bp: 'Blood pressure', signs: 'Danger signs', none: 'none',
    validate: 'Specialist validation', d_rujuk: 'Confirm REFER', d_hati: 'CAUTION (monitor)', d_aman: 'SAFE', d_rescan: 'Request rescan',
    timing: 'Referral timing', t_emergency: 'Immediately (emergency)', t_scheduled: 'Scheduled',
    facility: 'Referral facility — nearest available & capable', nearest: 'Nearest available',
    spog_on: 'Obstetrician on duty', spog_off: 'No obstetrician on duty', ponek: 'PONEK (OR + blood bank)', poned: 'PONED', clinic: 'Obstetric clinic',
    not_capable: 'cannot handle this case', scheduled_only: 'scheduled only', minutes: 'min',
    actions: 'Immediate actions at primary care (sent to midwife)', draft: 'Draft protocol — needs clinical validation',
    note: 'Note to midwife', send: 'Send to midwife',
    sent: 'Validation sent', acked: 'Midwife confirmed', ack_wait: 'Waiting for midwife confirmation', actions_done: 'actions ticked',
    urgent_parallel: 'Emergency: the midwife has already been told to refer now. Your validation sets the destination and actions.',
    demo: 'DEMO: fictional data and facilities. Videos are synthetic clips unless the midwife recorded real video.',
    k_clinics: 'Health sites connected', k_clinics_s: 'all feeding this queue', k_scans: 'Scans, 24 h', k_scans_s: '{n} cases in total',
    k_pending: 'Awaiting validation', k_over: 'Overdue', k_over_s: 'of {n} waiting',
    k_resp: 'REFER response', k_resp_s: 'median, received → validated', k_agree: 'AI ↔ midwife agree', k_agree_s: '{n} midwife overrides',
    all_clinics: 'All health sites', new: 'NEW',
  },
};

let DLANG = new URLSearchParams(location.search).get('lang') || (() => { try { return localStorage.getItem('jj_dlang') || 'id'; } catch { return 'id'; } })();
const d = (k, vars = {}) => String(DSTR[DLANG][k] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? '');
const CLEAN = new URLSearchParams(location.search).has('clean');
const D = { cases: [], tab: 'queue', sort: 'risk', clinic: '', selected: null, form: {}, sig: '' };
const NEW_MS = 3 * 60000;   // freshly arrived cases get a NEW badge

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function mins(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = DLANG === 'en' ? 'h' : 'j';
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}${h} ${m % 60}m` : `${Math.floor(m / 1440)}d`;
}

// One line for a validated case in the list: where the loop stands and who owns the next step.
function loopLine(c, now) {
  const st = loopState(c, now);
  if (st.closed) return `✓ ${lt(DLANG, 'closed')} · ${lt(DLANG, 'out_' + c.loop.closed.outcome)}`;
  const cur = st.current;
  if (!cur) return '✓';
  return `→ ${lt(DLANG, 's_' + cur.key)} · ${lt(DLANG, 'o_' + cur.owner)}${cur.dueAt ? (st.overdue ? ` · ${d('overdue')} ${mins(now - cur.dueAt)}` : ` · ${mins(cur.dueAt - now)}`) : ''}`;
}

function sorted(list) {
  const waitStart = (c) => c.receivedAt || c.at;
  return [...list].sort((a, b) => {
    if (D.sort === 'new') return waitStart(b) - waitStart(a);
    if (D.sort === 'wait') return waitStart(a) - waitStart(b);
    return TIERS[caseTier(a)].rank - TIERS[caseTier(b)].rank || waitStart(a) - waitStart(b);
  });
}

// Caseload at a glance: how many clinics feed the queue, what is waiting, and how fast REFER cases get answered.
function renderStats() {
  const now = Date.now(), wait = (c) => c.receivedAt || c.at;
  const pend = D.cases.filter((c) => !c.validation);
  const over = pend.filter((c) => now - wait(c) > TIERS[caseTier(c)].slaMin * 60000).length;
  const resp = D.cases.filter((c) => c.validation && ['urgent', 'rujuk'].includes(caseTier(c)))
    .map((c) => c.validation.at - wait(c)).sort((x, y) => x - y);
  const agreeN = D.cases.filter((c) => c.final === (c.aiOutcome === 'unsure' ? 'rujuk' : c.aiOutcome)).length;
  const kpi = (k, v, sub, cls = '') => `<div class="kpi ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
  document.getElementById('stats').innerHTML = [
    kpi(d('k_clinics'), new Set(D.cases.map((c) => c.puskesmas).filter(Boolean)).size, d('k_clinics_s')),
    kpi(d('k_scans'), D.cases.filter((c) => now - wait(c) < 864e5).length, d('k_scans_s', { n: D.cases.length })),
    `<div class="kpi"><div class="k">${d('k_pending')}</div><div class="v">${pend.length}</div><div class="tiers">
      ${Object.keys(TIERS).map((k) => [k, pend.filter((c) => caseTier(c) === k).length]).filter(([, n]) => n)
        .map(([k, n]) => `<span class="tag ${k}">${n} ${d('tier_' + k).split(' · ')[0]}</span>`).join('')}</div></div>`,
    kpi(d('k_over'), over, d('k_over_s', { n: pend.length }), over ? 'alert' : 'good'),
    kpi(d('k_resp'), resp.length ? mins(resp[resp.length >> 1]) : '—', d('k_resp_s')),
    (() => { const open = D.cases.filter((c) => c.validation && !c.loop?.closed);
      const ov = open.filter((c) => loopState(c, now).overdue).length;
      return kpi(d('k_loop'), ov, d('k_loop_s', { n: open.length }), ov ? 'alert' : 'good'); })(),
  ].join('');
}

function renderQueue() {
  renderStats();
  const inClinic = (c) => !D.clinic || c.puskesmas === D.clinic;
  const now = Date.now();
  const pending = D.cases.filter((c) => !c.validation && inClinic(c));
  const done = D.cases.filter((c) => c.validation && !c.loop?.closed && inClinic(c));
  const closedList = D.cases.filter((c) => c.loop?.closed && inClinic(c));
  const list = D.tab === 'queue' ? sorted(pending)
    : D.tab === 'done' ? [...done].sort((a, b) => (loopState(b, now).overdue - loopState(a, now).overdue) || ((loopState(a, now).current?.dueAt || 9e15) - (loopState(b, now).current?.dueAt || 9e15)))
    : [...closedList].sort((a, b) => b.loop.closed.at - a.loop.closed.at);
  const clinics = [...new Set(D.cases.map((c) => c.puskesmas).filter(Boolean))].sort();
  let lastTier = null;
  document.getElementById('queue').innerHTML = `
    <div class="qhead">
    ${CLEAN ? '' : `<div class="banner">${d('demo')}</div>`}
    <div class="tabs">
      <button class="${D.tab === 'queue' ? 'sel' : ''}" onclick="D.tab='queue'; renderQueue()">${d('queue')} (${pending.length})</button>
      <button class="${D.tab === 'done' ? 'sel' : ''}" onclick="D.tab='done'; renderQueue()">${d('done')} (${done.length})</button>
      <button class="${D.tab === 'closed' ? 'sel' : ''}" onclick="D.tab='closed'; renderQueue()">${d('closed_tab')} (${closedList.length})</button>
    </div>
    <div class="row" style="margin-bottom:4px; flex-wrap:nowrap">
      <select style="flex:1; min-width:0" onchange="D.sort=this.value; renderQueue()">
        ${['risk', 'wait', 'new'].map((s) => `<option value="${s}" ${D.sort === s ? 'selected' : ''}>${d('sort_' + s)}</option>`).join('')}
      </select>
      <select style="flex:1; min-width:0" onchange="D.clinic=this.value; renderQueue()">
        <option value="">${d('all_clinics')} (${clinics.length})</option>
        ${clinics.map((p) => `<option ${D.clinic === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
    </div></div>
    ${list.length ? list.map((c) => {
      const tier = caseTier(c);
      const waited = now - (c.receivedAt || c.at);
      const over = !c.validation && waited > TIERS[tier].slaMin * 60000;
      const fresh = !c.validation && waited < NEW_MS;
      const ga = c.gaDates != null ? Math.floor(c.gaDates) + 'w' : '';
      const head = D.tab === 'queue' && D.sort === 'risk' && tier !== lastTier
        ? `<div class="grp"><span>${d('tier_' + tier)}</span><span>${pending.filter((x) => caseTier(x) === tier).length}</span></div>` : '';
      lastTier = tier;
      return `${head}<div class="q ${D.selected === c.caseId ? 'active' : ''} ${fresh ? 'new' : ''}" data-id="${c.caseId}" onclick="select('${c.caseId}')">
        <div class="top"><b>${esc(c.id || '—')} ${fresh ? `<span class="tag new">${d('new')}</span>` : ''}</b>
          ${c.validation ? `<span class="tag ${c.validation.decision}">${d('d_' + c.validation.decision)}</span>` : `<span class="tag ${tier}">${d('tier_' + tier)}</span>`}</div>
        <div class="muted">${esc(c.visit?.age || '?')} th · ${ga} · ${esc(c.puskesmas || '')} · ${esc(c.midwife || '')}</div>
        <div class="top"><span class="sla ${over || (c.validation && loopState(c, now).overdue) ? 'over' : ''}">${c.validation ? loopLine(c, now) : `⏱ ${mins(waited)} ${d('waiting')}${over ? ' · ' + d('overdue') : ` · ${d('target')} ${mins(TIERS[tier].slaMin * 60000)}`}`}</span>
          <span class="muted">🎞 ${(c.uploaded || []).length}/${(c.videos || []).length}</span></div>
      </div>`;
    }).join('') : `<div class="empty">${d('empty')}</div>`}`;
}

function select(id) {
  D.selected = id;
  const c = D.cases.find((x) => x.caseId === id);
  const tier = caseTier(c);
  const decision = { urgent: 'rujuk', rujuk: 'rujuk', unsure: 'rescan', hati: 'hati', aman: 'aman' }[tier];
  D.form = { decision, timing: tier === 'urgent' ? 'emergency' : 'scheduled', date: '', facilityId: null, note: '', actions: null };
  D.sig = ''; D.loopForm = null;
  renderQueue(); renderDetail(true);
}

function param(c, key, fmt) {
  const p = c.scan?.[key];
  if (!p) return '';
  const low = p.conf < CONF_MIN;
  return `<div class="kv"><span>${d('p_' + key)}</span><b class="${low ? 'low' : ''}">${esc(fmt(p.value))} <span class="muted">${Math.round(p.conf * 100)}%${low ? ' ⚠' : ''}</span></b></div>`;
}

function renderDetail(force) {
  const el = document.getElementById('detail');
  const c = D.cases.find((x) => x.caseId === D.selected);
  if (!c) { el.innerHTML = `<div class="empty">${d('pick')}</div>`; return; }
  // Only re-render when the case changed, so playing videos and typed notes are not interrupted.
  const sig = JSON.stringify([c.uploaded, c.validation, c.loop, DLANG, Math.floor(Date.now() / 60000)]);
  if (!force && sig === D.sig) return;
  D.sig = sig;

  LANG = DLANG;   // reuse the midwife app's finding strings (i18n.js)
  const tier = caseTier(c);
  const val = c.validation;
  const f = D.form;
  const findings = [...(c.findings || [])].sort((a, b) => ({ rujuk: 0, unsure: 1, hati: 2, ok: 3 })[a.level] - ({ rujuk: 0, unsure: 1, hati: 2, ok: 3 })[b.level]);
  const emergency = f.timing === 'emergency';
  const facs = rankFacilities(c.findings || [], emergency);
  if (f.decision === 'rujuk' && !f.facilityId) f.facilityId = facs.find((x) => x.capable && x.available)?.id;
  if (!f.actions) f.actions = new Set(suggestedActions(c.findings || [], f.decision).map((a) => a.id));
  const suggestions = suggestedActions(c.findings || [], f.decision);
  const signs = (c.visit?.signs || []).map((s) => t('sign_' + s)).join(', ') || d('none');
  const al = DLANG === 'en' ? 'en' : 'id_';

  el.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h2>${esc(c.id || '—')} <span class="tag ${tier}">${d('tier_' + tier)}</span></h2>
        <div class="muted">${esc(c.caseId)} · ${esc(c.midwife || '')}, ${esc(c.puskesmas || '')} · ${d('received')} ${new Date(c.receivedAt || c.at).toLocaleString()}</div></div>
      <div class="row">
        <span class="tag ${c.aiOutcome}">${d('ai')}: ${t('out_' + c.aiOutcome)}</span>
        <span class="tag ${c.final}">${d('midwife')}: ${t('out_' + c.final)}</span>
      </div>
    </div>
    ${c.reason ? `<div class="muted" style="margin-top:6px">✎ ${d('override')}: “${esc(c.reason)}”</div>` : ''}
    ${tier === 'urgent' && !val ? `<div class="urgentbar">⚠ ${d('urgent_parallel')}</div>` : ''}

    <h3>${d('videos')}</h3>
    ${c.scanned === false ? `<div class="box muted">${d('no_scan')}</div>` : `<div class="videos">
      ${[1, 2, 3, 4, 5, 6].map((n) => {
        const has = (c.uploaded || []).includes(n);
        const want = (c.videos || []).includes(n);
        return `<div class="vid"><span class="lbl">${t('sweep')} ${n}</span>
          ${has ? `<video src="api/videos/${c.caseId}/${n}" controls muted loop autoplay playsinline preload="auto"></video>`
            : `<span class="none">${want ? d('not_uploaded') : d('not_recorded')}</span>`}</div>`;
      }).join('')}</div>`}

    <div class="grid2">
      <div><h3>${d('findings')}</h3><div class="box">
        ${findings.map((x) => `<div class="finding"><span class="dot ${x.level}"></span><div>${esc(t('f_' + x.key, { d: x.detail }))}
          <div class="muted">${x.src === 'ai' ? 'AI' : t('src_clinical')}${x.conf != null ? ' · ' + Math.round(x.conf * 100) + '%' : ''}</div></div></div>`).join('') || '—'}
      </div></div>
      <div>
        ${c.scan ? `<h3>${d('params')}</h3><div class="box">
          <div class="kv"><span>${d('quality')}</span><b>${Math.round(c.scan.quality.score * 100)}%</b></div>
          ${param(c, 'viability', (v) => v)}${param(c, 'presentation', (v) => v)}${param(c, 'placenta', (v) => v)}
          ${param(c, 'fetusCount', (v) => v)}${param(c, 'gaWeeks', (v) => v + ' w')}${param(c, 'efwKg', (v) => v + ' kg')}
        </div>` : ''}
        <h3>${d('clinical')}</h3><div class="box">
          <div class="kv"><span>${d('age')}</span><b>${esc(c.visit?.age || '—')}</b></div>
          <div class="kv"><span>${d('hpht')}</span><b>${esc(c.visit?.hpht || '—')}</b></div>
          <div class="kv"><span>${d('ga_dates')}</span><b>${c.gaDates != null ? Math.floor(c.gaDates) + ' w' : '—'}</b></div>
          <div class="kv"><span>${d('bp')}</span><b>${esc(c.visit?.bpSys || '—')}/${esc(c.visit?.bpDia || '—')}</b></div>
          <div class="kv"><span>${d('signs')}</span><b>${esc(signs)}</b></div>
        </div>
      </div>
    </div>

    <h3>${d('validate')}</h3>
    ${val ? `<div class="box">
        <div class="row"><span class="tag ${val.decision}">${d('d_' + val.decision)}</span>
          ${val.facility ? `<b>→ ${esc(val.facility.name)}</b> <span class="muted">(${val.timing === 'emergency' ? d('t_emergency') : d('t_scheduled')})</span>` : ''}</div>
        ${val.actions?.length ? `<ul>${val.actions.map((a) => `<li>${(val.doneActions || []).includes(a.id) ? '✅' : '◻️'} ${esc(a[al])}</li>`).join('')}</ul>` : ''}
        ${val.note ? `<p>“${esc(val.note)}”</p>` : ''}
        <div class="muted">${d('sent')} ${new Date(val.at).toLocaleTimeString()} · ${val.ackAt ? `✓ ${d('acked')} ${new Date(val.ackAt).toLocaleTimeString()} (${(val.doneActions || []).length}/${val.actions?.length || 0} ${d('actions_done')})` : d('ack_wait')}</div>
      </div>
      ${loopPanel(c)}` : `
      <div class="seg">${['rujuk', 'hati', 'aman', 'rescan'].map((x) => `<button class="${f.decision === x ? 'sel' : ''}" onclick="setDecision('${x}')">${d('d_' + x)}</button>`).join('')}</div>
      ${f.decision === 'rujuk' ? `
        <h3>${d('timing')}</h3>
        <div class="row"><div class="seg">
          <button class="${emergency ? 'sel' : ''}" onclick="D.form.timing='emergency'; D.form.facilityId=null; renderDetail(true)">${d('t_emergency')}</button>
          <button class="${!emergency ? 'sel' : ''}" onclick="D.form.timing='scheduled'; D.form.facilityId=null; renderDetail(true)">${d('t_scheduled')}</button></div>
          ${!emergency ? `<input type="date" value="${esc(f.date)}" onchange="D.form.date=this.value">` : ''}</div>
        <h3>${d('facility')}</h3>
        ${facs.map((x, i) => {
          const ok = x.capable && x.available;
          return `<label class="fac ${ok ? '' : 'off'} ${f.facilityId === x.id ? 'chosen' : ''}">
            <input type="radio" name="fac" ${f.facilityId === x.id ? 'checked' : ''} onchange="D.form.facilityId='${x.id}'; renderDetail(true)">
            <div style="flex:1"><div class="row"><b>${esc(x.name)}</b>${ok && i === 0 ? `<span class="badge">${d('nearest')}</span>` : ''}</div>
              <div class="muted">${x.km} km · ±${x.min} ${d('minutes')} · ${d(x.level)}</div>
              <div class="row" style="margin-top:4px"><span class="badge ${x.spog ? '' : 'no'}">${x.spog ? d('spog_on') : d('spog_off')}</span>
                ${!x.capable ? `<span class="badge no">${d('not_capable')}</span>` : ''}
                ${x.scheduledOnly ? `<span class="badge no">${d('scheduled_only')}</span>` : ''}
                ${x.note ? `<span class="muted">${esc(x.note)}</span>` : ''}</div></div>
          </label>`;
        }).join('')}` : ''}
      <h3>${d('actions')} <span class="muted">· ${d('draft')}</span></h3>
      <div class="box">${suggestions.length ? suggestions.map((a) => `<label class="check"><input type="checkbox" ${f.actions.has(a.id) ? 'checked' : ''}
        onchange="toggleAction('${a.id}', this.checked)"> ${esc(a[al])}</label>`).join('') : `<span class="muted">—</span>`}</div>
      <h3>${d('note')}</h3>
      <textarea oninput="D.form.note=this.value">${esc(f.note)}</textarea>
      <button class="primary" ${f.decision === 'rujuk' && !f.facilityId ? 'disabled' : ''} onclick="sendValidation()">${d('send')} →</button>
    `}`;
}

// Case trail after validation: every step, its owner and time target, the activity log, and what
// the specialist can do (escalate an overdue step; close as not completed, with a reason).
function loopPanel(c) {
  const now = Date.now();
  const st = loopState(c, now);
  const dec = c.validation.decision;
  const L = D.loopForm || (D.loopForm = { reason: '', note: '', outcome: '', evidence: '', escalateTo: '' });
  const canCloseDone = !st.closed && ((dec === 'rujuk' && c.loop?.arrived) || (['hati', 'rescan'].includes(dec) && c.loop?.followup) || dec === 'aman');
  return `
    <h3>${lt(DLANG, 'trail')} ${st.closed ? `<span class="tag aman">${lt(DLANG, 'closed')}</span>` : st.overdue ? `<span class="tag rujuk">${d('overdue')}</span>` : ''}</h3>
    <div class="box">${trailHTML(c, DLANG, now)}
      ${c.loop?.informed?.text ? `<details style="margin-top:6px"><summary class="muted">${lt(DLANG, 'mother_msg')}</summary><pre class="slip">${esc(c.loop.informed.text)}</pre></details>` : ''}
      ${dec === 'rujuk' ? `<div class="muted" style="margin-top:6px">${d('hospital_page')}: <a href="hospital.html?f=${esc(c.validation.facility?.id || '')}${DLANG === 'en' ? '&lang=en' : ''}" target="_blank" rel="noopener">${esc(c.validation.facility?.name || '')} ↗</a></div>` : ''}
    </div>
    ${c.loop?.log?.length ? `<h3>${lt(DLANG, 'log')}</h3><div class="box">${logHTML(c, DLANG)}</div>` : ''}
    ${st.closed ? '' : `
      ${st.overdue ? `<div class="box" style="margin-top:10px"><div class="row">
        <b>${d('escalate_to')}</b>
        <select onchange="D.loopForm.escalateTo=this.value"><option value="">—</option>
          ${(DLANG === 'en' ? ['Coordinating midwife', 'Health-site head', 'Backup obstetrician', 'Hospital referral officer'] : ['Bidan koordinator', 'Kepala Puskesmas', 'Sp.OG cadangan', 'Petugas rujukan RS']).map((x) => `<option ${L.escalateTo === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <button onclick="escalateCase()" ${L.escalateTo ? '' : 'disabled'}>${d('escalate')}</button></div></div>` : ''}
      ${canCloseDone ? `<details class="box" style="margin-top:10px"><summary><b>${d('close_done')}</b></summary>
        <div class="row" style="margin-top:8px"><select onchange="D.loopForm.outcome=this.value"><option value="">${d('outcome')}…</option>
          ${LOOP_OUTCOMES[dec].map((o) => `<option value="${o}" ${L.outcome === o ? 'selected' : ''}>${lt(DLANG, 'out_' + o)}</option>`).join('')}</select></div>
        <input style="width:100%;margin-top:8px" placeholder="${d('evidence')}" value="${esc(L.evidence)}" oninput="D.loopForm.evidence=this.value">
        <button class="primary" onclick="closeCase('done')">${d('close')}</button></details>` : ''}
      <details class="box" style="margin-top:10px"><summary><b>${d('close_nc')}</b> <span class="muted">· ${d('close_nc_s')}</span></summary>
        <div class="row" style="margin-top:8px"><select onchange="D.loopForm.reason=this.value"><option value="">${d('reason')}…</option>
          ${DROP_REASONS.map((r) => `<option value="${r}" ${L.reason === r ? 'selected' : ''}>${lt(DLANG, 'r_' + r)}</option>`).join('')}</select></div>
        <textarea placeholder="${d('evidence_note')}" oninput="D.loopForm.note=this.value">${esc(L.note)}</textarea>
        <button class="primary" onclick="closeCase('nc')">${d('close')}</button></details>`}
    <div id="loopmsg" class="muted" style="margin-top:6px"></div>`;
}
async function loopAct(body) {
  const c = D.cases.find((x) => x.caseId === D.selected);
  try {
    await postLoop(c.caseId, { by: d('doctor'), role: 'specialist', ...body });
    D.loopForm = null;
    await refresh(); renderDetail(true);
  } catch (e) { const m = document.getElementById('loopmsg'); if (m) m.textContent = '⚠ ' + e.message; }
}
function escalateCase() { loopAct({ event: 'escalated', to: D.loopForm.escalateTo, note: '' }); }
function closeCase(kind) {
  const L = D.loopForm;
  if (kind === 'nc') loopAct({ event: 'closed', outcome: 'not_completed', dropReason: L.reason, evidence: L.note });
  else loopAct({ event: 'closed', outcome: L.outcome, evidence: L.evidence });
}

function setDecision(x) {
  D.form.decision = x; D.form.actions = null; D.form.facilityId = null;
  renderDetail(true);
}
function toggleAction(id, on) { on ? D.form.actions.add(id) : D.form.actions.delete(id); }

async function sendValidation() {
  const c = D.cases.find((x) => x.caseId === D.selected);
  const f = D.form;
  const fac = f.decision === 'rujuk' ? FACILITIES.find((x) => x.id === f.facilityId) : null;
  const body = {
    doctor: d('doctor'), decision: f.decision,
    timing: f.decision === 'rujuk' ? f.timing : null, date: f.decision === 'rujuk' && f.timing === 'scheduled' ? f.date : null,
    facility: fac ? { id: fac.id, name: fac.name, km: fac.km, min: fac.min } : null,
    actions: suggestedActions(c.findings || [], f.decision).filter((a) => f.actions.has(a.id)),
    note: f.note.trim(),
  };
  const r = await fetch(`api/cases/${c.caseId}/validation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) { await refresh(); renderDetail(true); }
}

async function refresh() {
  try {
    const r = await fetch('api/cases');
    D.cases = await r.json();
    document.getElementById('live').textContent = '● live';
    document.getElementById('live').style.color = 'var(--aman)';
  } catch {
    document.getElementById('live').textContent = '● offline';
    document.getElementById('live').style.color = 'var(--rujuk)';
  }
  renderQueue(); renderDetail(false);
}

document.getElementById('who').innerHTML = `${esc(d('doctor'))} · <a href="loop.html${DLANG === 'en' ? '?lang=en' : ''}" target="_blank" rel="noopener">${d('dash')} ↗</a>`;
if (CLEAN) document.body.insertAdjacentHTML('beforeend', `<div class="democap">${DLANG === 'en' ? 'Demo workflow · illustrative case data' : 'Demo alur kerja · data kasus ilustratif'}</div>`);
const langSel = document.getElementById('lang');
langSel.value = DLANG;
langSel.onchange = () => { DLANG = langSel.value; try { localStorage.setItem('jj_dlang', DLANG); } catch {} renderQueue(); renderDetail(true); };
refresh();
setInterval(refresh, 4000);
