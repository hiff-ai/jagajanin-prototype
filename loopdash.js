// Jagajanin prototype — loop dashboard.
// For every actionable result the specialist validated: is it closed, who owns the next step,
// what is past its time target, how long each step takes, and why mothers drop off.
// Everything is computed live from the same case records the other screens use.

const LDS = {
  id: {
    title: 'Dasbor loop', demo: 'DATA DEMO: kasus fiktif. Angka di halaman ini bukan hasil lapangan.',
    k_open: 'Kasus terbuka', k_open_s: 'divalidasi, belum ditutup', k_over: 'Lewat batas', k_over_s: 'langkah kini melewati target',
    k_comp: 'Rujukan tuntas', k_comp_s: '{a} dari {b} rujukan ditutup dengan bukti', k_drop: 'Tidak tuntas', k_drop_s: 'ditutup dengan alasan',
    k_under: 'Ibu paham', k_under_s: '{a} dari {b} ibu yang diberi tahu', k_care: 'Scan → diperiksa di RS', k_care_s: 'median, rujukan yang tuntas',
    owners: 'Kasus terbuka per penanggung jawab', overdue: 'lewat batas', times: 'Waktu tiap langkah (median, rujukan)',
    reasons: 'Alasan tidak tuntas', none: 'Belum ada', sites: 'Per health site', site: 'Health site', refs: 'Rujukan', done: 'Tuntas',
    open: 'Terbuka', over: 'Lewat', unresolved: 'Belum selesai dan lewat batas', case_: 'Kasus', step: 'Langkah kini', owner: 'Penanggung jawab', late: 'Terlambat',
    console: 'Konsol spesialis', hospital: 'Halaman RS',
  },
  en: {
    title: 'Loop dashboard', demo: 'DEMO DATA: fictional cases. Numbers on this page are not field results.',
    k_open: 'Open cases', k_open_s: 'validated, not yet closed', k_over: 'Past target', k_over_s: 'current step is overdue',
    k_comp: 'Referrals completed', k_comp_s: '{a} of {b} referrals closed with evidence', k_drop: 'Not completed', k_drop_s: 'closed with a reason',
    k_under: 'Mother understood', k_under_s: '{a} of {b} mothers informed', k_care: 'Scan → seen at hospital', k_care_s: 'median, completed referrals',
    owners: 'Open cases by owner', overdue: 'overdue', times: 'Time per step (median, referrals)',
    reasons: 'Why referrals were not completed', none: 'None yet', sites: 'By health site', site: 'Health site', refs: 'Referrals', done: 'Completed',
    open: 'Open', over: 'Overdue', unresolved: 'Open and past target', case_: 'Case', step: 'Current step', owner: 'Owner', late: 'Late by',
    console: 'Specialist console', hospital: 'Hospital page',
  },
};
let DL = new URLSearchParams(location.search).get('lang') || (() => { try { return localStorage.getItem('jj_dlang') || 'id'; } catch { return 'id'; } })();
const ld = (k, v = {}) => String(LDS[DL][k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const CLEAND = new URLSearchParams(location.search).has('clean');
let CASES = [];
function e(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
const median = (xs) => { const a = xs.filter((x) => x != null && x >= 0).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };

function render() {
  const now = Date.now();
  const val = CASES.filter((c) => c.validation);
  const open = val.filter((c) => !c.loop?.closed);
  const states = new Map(val.map((c) => [c.caseId, loopState(c, now)]));
  const over = open.filter((c) => states.get(c.caseId).overdue);
  const refs = val.filter((c) => c.validation.decision === 'rujuk');
  const refsClosed = refs.filter((c) => c.loop?.closed);
  const refsDone = refsClosed.filter((c) => c.loop.closed.outcome !== 'not_completed');
  const dropped = val.filter((c) => c.loop?.closed?.outcome === 'not_completed');
  const informed = val.filter((c) => c.loop?.informed);
  const understood = informed.filter((c) => c.loop?.understood?.understood);
  const scanToCare = median(refsDone.map((c) => c.loop.arrived?.at - (c.receivedAt || c.at)));

  const kpi = (k, v, s, cls = '') => `<div class="kpi ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');

  // open cases by owner, with overdue share
  const owners = ['specialist', 'midwife', 'hospital'];
  const pending = CASES.filter((c) => !c.validation);
  const pendOver = pending.filter((c) => now - (c.receivedAt || c.at) > TIERS[caseTier(c)].slaMin * 60000);
  const byOwner = owners.map((o) => {
    const mine = open.filter((c) => states.get(c.caseId).owner === o);
    const n = mine.length + (o === 'specialist' ? pending.length : 0);
    const ov = mine.filter((c) => states.get(c.caseId).overdue).length + (o === 'specialist' ? pendOver.length : 0);
    return { o, n, ov };
  });
  const maxOwner = Math.max(1, ...byOwner.map((x) => x.n));

  // median minutes between steps, referrals only
  const pairs = [['validated', 'acknowledged'], ['acknowledged', 'informed'], ['validated', 'accepted'], ['accepted', 'arrived'], ['arrived', 'closed']];
  const times = pairs.map(([a, b]) => ({ a, b, m: median(refs.map((c) => (stageAt(c, b) && stageAt(c, a)) ? stageAt(c, b) - stageAt(c, a) : null)) }));
  const maxT = Math.max(1, ...times.map((x) => x.m || 0));

  const reasons = DROP_REASONS.map((r) => [r, dropped.filter((c) => c.loop.closed.dropReason === r).length]).filter(([, n]) => n);
  const sites = [...new Set(refs.map((c) => c.puskesmas).filter(Boolean))].sort().map((s) => {
    const rs = refs.filter((c) => c.puskesmas === s);
    return { s, n: rs.length, done: rs.filter((c) => c.loop?.closed && c.loop.closed.outcome !== 'not_completed').length,
      open: rs.filter((c) => !c.loop?.closed).length, over: rs.filter((c) => !c.loop?.closed && states.get(c.caseId).overdue).length };
  });
  const unresolved = over.map((c) => ({ c, st: states.get(c.caseId) }))
    .sort((a, b) => (a.st.current.dueAt - b.st.current.dueAt)).slice(0, 12);

  document.getElementById('dash').innerHTML = `
    ${CLEAND ? '' : `<div class="banner" style="margin:0">${ld('demo')}</div>`}
    <div class="kpis">
      ${kpi(ld('k_open'), open.length, ld('k_open_s'))}
      ${kpi(ld('k_over'), over.length, ld('k_over_s'), over.length ? 'alert' : 'good')}
      ${kpi(ld('k_comp'), pct(refsDone.length, refs.length), ld('k_comp_s', { a: refsDone.length, b: refs.length }))}
      ${kpi(ld('k_drop'), dropped.length, ld('k_drop_s'), dropped.length ? 'alert' : '')}
      ${kpi(ld('k_under'), pct(understood.length, informed.length), ld('k_under_s', { a: understood.length, b: informed.length }))}
      ${kpi(ld('k_care'), scanToCare != null ? fmtDur(scanToCare, DL) : '—', ld('k_care_s'))}
    </div>
    <div class="cols">
      <section class="panel"><h2>${ld('owners')}</h2>
        ${byOwner.map((x) => `<div class="bar"><span>${lt(DL, 'o_' + x.o)}</span>
          <div class="track" style="display:flex"><div class="fill" style="width:${((x.n - x.ov) / maxOwner) * 100}%;border-radius:0"></div><div class="fill over" style="width:${(x.ov / maxOwner) * 100}%;border-radius:0"></div></div>
          <b>${x.n}${x.ov ? ` <span class="muted">· ${x.ov} ${ld('overdue')}</span>` : ''}</b></div>`).join('')}
      </section>
      <section class="panel"><h2>${ld('times')}</h2>
        ${times.map((x) => `<div class="bar"><span>${lt(DL, 's_' + x.b)}</span>
          <div class="track"><div class="fill" style="width:${((x.m || 0) / maxT) * 100}%"></div></div>
          <b>${x.m != null ? fmtDur(x.m, DL) : '—'}</b></div>`).join('')}
      </section>
      <section class="panel"><h2>${ld('reasons')}</h2>
        ${reasons.length ? reasons.map(([r, n]) => `<div class="bar"><span>${lt(DL, 'r_' + r)}</span>
          <div class="track"><div class="fill over" style="width:${(n / Math.max(...reasons.map((z) => z[1]))) * 100}%"></div></div><b>${n}</b></div>`).join('')
          : `<p class="muted">${ld('none')}</p>`}
      </section>
      <section class="panel"><h2>${ld('sites')}</h2><div class="tw"><table>
        <thead><tr><th>${ld('site')}</th><th class="n">${ld('refs')}</th><th class="n">${ld('done')}</th><th class="n">${ld('open')}</th><th class="n">${ld('over')}</th></tr></thead>
        <tbody>${sites.map((x) => `<tr><td>${e(x.s)}</td><td class="n">${x.n}</td><td class="n">${x.done}</td><td class="n">${x.open}</td><td class="n">${x.over}</td></tr>`).join('')}</tbody></table></div>
      </section>
    </div>
    <section class="panel"><h2>${ld('unresolved')}</h2><div class="tw"><table>
      <thead><tr><th>${ld('case_')}</th><th>${ld('site')}</th><th>${lt(DL, 'trail')}</th><th>${ld('step')}</th><th>${ld('owner')}</th><th class="n">${ld('late')}</th></tr></thead>
      <tbody>${unresolved.map(({ c, st }) => `<tr><td><b>${e(c.id)}</b></td><td>${e(c.puskesmas || '')}</td>
        <td><span class="tag ${c.validation.decision === 'rescan' ? 'unsure' : c.validation.decision}">${e(c.validation.decision.toUpperCase())}</span></td>
        <td>${lt(DL, 's_' + st.current.key)}</td><td>${lt(DL, 'o_' + st.owner)}</td><td class="n">${fmtDur(now - st.current.dueAt, DL)}</td></tr>`).join('')
        || `<tr><td colspan="6" class="muted">${ld('none')}</td></tr>`}</tbody></table></div>
    </section>`;
}

async function refreshD() {
  try {
    CASES = await (await fetch('api/cases')).json();
    document.getElementById('live').textContent = '● live';
  } catch { document.getElementById('live').textContent = '● offline'; }
  render();
}
function setTitle() {
  document.getElementById('title').textContent = ld('title');
  const q = DL === 'en' ? '?lang=en' : '';
  document.getElementById('who').innerHTML = `<a href="doctor.html${q}">${ld('console')}</a> · <a href="hospital.html${q}">${ld('hospital')}</a>`;
}
const sel = document.getElementById('lang');
sel.value = DL;
sel.onchange = () => { DL = sel.value; try { localStorage.setItem('jj_dlang', DL); } catch {} setTitle(); render(); };
setTitle();
refreshD();
setInterval(refreshD, 5000);
