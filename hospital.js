// Jagajanin prototype — receiving-hospital page.
// The hospital named in a validated referral accepts it (or redirects it with a reason), records
// that the mother arrived and was seen, and closes the case with an outcome and evidence.

const HSTR = {
  id: {
    title: 'RS Tujuan', staff: 'Petugas rujukan', pick: 'Pilih rujukan dari daftar.', empty: 'Tidak ada rujukan.',
    sec_accept: 'Menunggu diterima', sec_arrive: 'Diterima · menunggu kedatangan', sec_outcome: 'Tiba · menunggu hasil', sec_closed: 'Ditutup',
    from: 'Dari', spec: 'Divalidasi', timing_e: 'Segera (gawat)', timing_s: 'Terjadwal', findings: 'Temuan', actions: 'Tindakan pra-rujukan di faskes primer',
    accept: 'Terima rujukan', redirect: 'Alihkan ke faskes lain', redirect_to: 'Faskes tujuan baru', reason: 'Alasan (mis. NICU penuh, Sp.OG tidak ada)',
    arrived: 'Ibu sudah tiba & diperiksa', outcome: 'Hasil', evidence: 'Bukti: no. rekam medis / ringkasan pulang', clinician: 'Nama klinisi',
    close: 'Tutup kasus dengan bukti', demo: 'DEMO: rujukan dan faskes fiktif.', mother_msg: 'Pesan yang diterima ibu', understood: 'Ibu menyatakan paham',
    need: 'Perlu', by: 'paling lambat', overdue: 'lewat', all: 'Semua faskes',
  },
  en: {
    title: 'Receiving hospital', staff: 'Referral desk', pick: 'Select a referral from the list.', empty: 'No referrals.',
    sec_accept: 'Awaiting acceptance', sec_arrive: 'Accepted · awaiting arrival', sec_outcome: 'Arrived · awaiting outcome', sec_closed: 'Closed',
    from: 'From', spec: 'Validated', timing_e: 'Immediately (emergency)', timing_s: 'Scheduled', findings: 'Findings', actions: 'Pre-referral actions at primary care',
    accept: 'Accept referral', redirect: 'Redirect to another facility', redirect_to: 'New destination', reason: 'Reason (e.g. NICU full, no obstetrician)',
    arrived: 'Mother arrived and was seen', outcome: 'Outcome', evidence: 'Evidence: record number or discharge summary', clinician: 'Clinician name',
    close: 'Close case with evidence', demo: 'DEMO: fictional referrals and facilities.', mother_msg: 'Message the mother received', understood: 'Mother said she understood',
    need: 'Needed', by: 'by', overdue: 'overdue', all: 'All facilities',
  },
};
const P = new URLSearchParams(location.search);
let HL = P.get('lang') || (() => { try { return localStorage.getItem('jj_dlang') || 'id'; } catch { return 'id'; } })();
const h = (k) => HSTR[HL][k] ?? k;
const H = { cases: [], fac: P.get('f') || 'rsud', selected: null, form: {}, sig: '' };
const CLEANH = P.has('clean');
function hesc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
const facName = () => (FACILITIES.find((f) => f.id === H.fac) || {}).name || '';
const staff = () => `${h('staff')} · ${facName()} (demo)`;

function referrals() {
  return H.cases.filter((c) => c.validation?.decision === 'rujuk' && (!H.fac || c.validation.facility?.id === H.fac));
}
function bucket(c) {
  const l = c.loop || {};
  if (l.closed) return 'closed';
  if (l.arrived) return 'outcome';
  if (l.accepted) return 'arrive';
  return 'accept';
}

function renderList() {
  const now = Date.now();
  const list = referrals();
  const groups = ['accept', 'arrive', 'outcome', 'closed'];
  document.getElementById('list').innerHTML = `
    ${CLEANH ? '' : `<div class="banner">${h('demo')}</div>`}
    ${list.length ? groups.map((g) => {
      const items = list.filter((c) => bucket(c) === g)
        .sort((a, b) => g === 'closed' ? b.loop.closed.at - a.loop.closed.at : (loopState(a, now).current?.dueAt || 9e15) - (loopState(b, now).current?.dueAt || 9e15));
      if (!items.length) return '';
      return `<div class="sec"><span>${h('sec_' + g)}</span><span>${items.length}</span></div>` + items.slice(0, g === 'closed' ? 8 : 50).map((c) => {
        const st = loopState(c, now);
        const due = st.current?.dueAt;
        return `<div class="q ${H.selected === c.caseId ? 'active' : ''}" onclick="hselect('${c.caseId}')">
          <div class="top"><b>${hesc(c.id)}</b><span class="tag ${c.validation.timing === 'emergency' ? 'urgent' : 'rujuk'}">${c.validation.timing === 'emergency' ? h('timing_e') : h('timing_s')}</span></div>
          <div class="muted">${hesc(c.visit?.age || '?')} th · ${c.gaDates != null ? Math.floor(c.gaDates) + 'w' : ''} · ${hesc(c.puskesmas || '')}</div>
          ${g === 'closed' ? `<div class="muted">✓ ${lt(HL, 'out_' + c.loop.closed.outcome)}</div>`
            : due ? `<div class="need ${st.overdue ? 'over' : ''}">${lt(HL, 's_' + st.current.key)} · ${st.overdue ? h('overdue') + ' ' + fmtDur(now - due, HL) : h('by') + ' ' + fmtTime(due)}</div>` : ''}
        </div>`;
      }).join('');
    }).join('') : `<div class="empty">${h('empty')}</div>`}`;
}

function hselect(id) { H.selected = id; H.form = { outcome: '', evidence: '', clinician: '', to: '', reason: '' }; H.sig = ''; renderList(); renderDetail(true); }

function renderDetail(force) {
  const el = document.getElementById('detail');
  const c = H.cases.find((x) => x.caseId === H.selected);
  if (!c) { el.innerHTML = `<div class="empty">${h('pick')}</div>`; return; }
  const sig = JSON.stringify([c.loop, c.validation, HL, Math.floor(Date.now() / 60000)]);
  if (!force && sig === H.sig) return;
  H.sig = sig;
  LANG = HL;
  const v = c.validation, l = c.loop || {}, f = H.form, b = bucket(c);
  const al = HL === 'en' ? 'en' : 'id_';
  const findings = (c.findings || []).filter((x) => x.level !== 'ok');
  const others = FACILITIES.filter((x) => x.id !== v.facility?.id && x.level === 'ponek');
  el.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h2>${hesc(c.id)} <span class="tag ${v.timing === 'emergency' ? 'urgent' : 'rujuk'}">${v.timing === 'emergency' ? h('timing_e') : h('timing_s') + (v.date ? ' · ' + hesc(v.date) : '')}</span></h2>
        <div class="muted">${h('from')}: ${hesc(c.midwife || '')}, ${hesc(c.puskesmas || '')} · ${h('spec')}: ${hesc(v.doctor || '')} ${fmtTime(v.at)}</div></div>
    </div>
    <div class="grid2">
      <div><h3>${h('findings')}</h3><div class="box">
        ${findings.map((x) => `<div class="finding"><span class="dot ${x.level}"></span><div>${hesc(t('f_' + x.key, { d: x.detail }))}</div></div>`).join('') || '—'}
        <div class="kv"><span>${HL === 'en' ? 'Age · GA' : 'Usia · UK'}</span><b>${hesc(c.visit?.age || '—')} · ${c.gaDates != null ? Math.floor(c.gaDates) + ' w' : '—'}</b></div>
        <div class="kv"><span>${HL === 'en' ? 'Blood pressure' : 'Tekanan darah'}</span><b>${hesc(c.visit?.bpSys || '—')}/${hesc(c.visit?.bpDia || '—')}</b></div>
      </div>
      ${v.actions?.length ? `<h3>${h('actions')}</h3><div class="box"><ul style="margin:0;padding-left:18px">${v.actions.map((a) => `<li>${(v.doneActions || []).includes(a.id) ? '✅' : '◻️'} ${hesc(a[al])}</li>`).join('')}</ul></div>` : ''}
      ${l.informed?.text ? `<h3>${h('mother_msg')}</h3><div class="box"><pre class="slip" style="margin:0">${hesc(l.informed.text)}</pre>
        ${l.understood?.understood ? `<div class="muted" style="margin-top:6px">✓ ${h('understood')}</div>` : ''}</div>` : ''}
      </div>
      <div><h3>${lt(HL, 'trail')}</h3><div class="box">${trailHTML(c, HL)}</div>
        ${l.log?.length ? `<h3>${lt(HL, 'log')}</h3><div class="box">${logHTML(c, HL)}</div>` : ''}</div>
    </div>
    ${b === 'accept' ? `
      <button class="primary" onclick="hact({ event: 'accepted' })">✓ ${h('accept')}</button>
      <details class="box" style="margin-top:10px"><summary><b>${h('redirect')}</b></summary>
        <div class="row" style="margin-top:8px"><select onchange="H.form.to=this.value"><option value="">${h('redirect_to')}…</option>
          ${others.map((x) => `<option value="${x.id}" ${f.to === x.id ? 'selected' : ''}>${hesc(x.name)} · ${x.km} km</option>`).join('')}</select></div>
        <input class="full" placeholder="${h('reason')}" value="${hesc(f.reason)}" oninput="H.form.reason=this.value">
        <button class="primary" onclick="hredirect()">${h('redirect')}</button></details>` : ''}
    ${b === 'arrive' ? `<button class="primary" onclick="hact({ event: 'arrived' })">✓ ${h('arrived')}</button>` : ''}
    ${b === 'outcome' ? `<h3>${lt(HL, 's_closed')}</h3><div class="box">
        <select onchange="H.form.outcome=this.value"><option value="">${h('outcome')}…</option>
          ${LOOP_OUTCOMES.rujuk.map((o) => `<option value="${o}" ${f.outcome === o ? 'selected' : ''}>${lt(HL, 'out_' + o)}</option>`).join('')}</select>
        <input class="full" placeholder="${h('evidence')}" value="${hesc(f.evidence)}" oninput="H.form.evidence=this.value">
        <input class="full" placeholder="${h('clinician')}" value="${hesc(f.clinician)}" oninput="H.form.clinician=this.value">
        <button class="primary" onclick="hclose()">${h('close')}</button></div>` : ''}
    <div class="err" id="err"></div>`;
}

async function hact(body, by) {
  const c = H.cases.find((x) => x.caseId === H.selected);
  try {
    await postLoop(c.caseId, { by: by || staff(), role: 'hospital', ...body });
    H.form = { outcome: '', evidence: '', clinician: '', to: '', reason: '' };
    await hrefresh(); renderDetail(true);
  } catch (e) { document.getElementById('err').textContent = '⚠ ' + e.message; }
}
function hredirect() {
  const to = FACILITIES.find((x) => x.id === H.form.to);
  hact({ event: 'redirected', to: to ? { id: to.id, name: to.name, km: to.km, min: to.min } : null, reason: H.form.reason });
}
function hclose() {
  const name = H.form.clinician.trim();
  if (!name) { document.getElementById('err').textContent = '⚠ ' + h('clinician'); return; }
  hact({ event: 'closed', outcome: H.form.outcome, evidence: H.form.evidence }, `${name} · ${facName()}`);
}

async function hrefresh() {
  try {
    H.cases = await (await fetch('api/cases')).json();
    document.getElementById('live').textContent = '● live';
  } catch { document.getElementById('live').textContent = '● offline'; }
  renderList(); renderDetail(false);
}

const facSel = document.getElementById('fac');
facSel.innerHTML = FACILITIES.filter((x) => x.level !== 'poned').map((x) => `<option value="${x.id}">${hesc(x.name)}</option>`).join('');
facSel.value = H.fac;
facSel.onchange = () => { H.fac = facSel.value; H.selected = null; renderList(); renderDetail(true); };
document.getElementById('title').textContent = h('title');
const hl = document.getElementById('lang');
hl.value = HL;
hl.onchange = () => { HL = hl.value; try { localStorage.setItem('jj_dlang', HL); } catch {} document.getElementById('title').textContent = h('title'); renderList(); renderDetail(true); };
if (CLEANH) document.body.insertAdjacentHTML('beforeend', `<div class="democap">${HL === 'en' ? 'Demo workflow · illustrative case data' : 'Demo alur kerja · data kasus ilustratif'}</div>`);
hrefresh();
setInterval(hrefresh, 4000);
