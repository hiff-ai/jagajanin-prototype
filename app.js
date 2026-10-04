// Jagajanin prototype — midwife app.
// Intake → (6 sweeps) → on-device analysis → result → midwife decision → save → outbox →
// tele-specialist validation → referral destination + pre-referral actions back to the midwife.

const $app = document.getElementById('app');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ?clean=1 (for recording): swap the demo banner for a small corner caption.
const CLEAN = new URLSearchParams(location.search).has('clean');
let S = freshVisit();
LANG = store.get('jj_lang', 'id');

function freshVisit() {
  return { screen: 'home', scenario: 'noor', visit: { id: '', age: '', hpht: '', bpSys: '', bpDia: '', signs: [] },
    sweep: 0, captured: {}, files: {}, clips: {}, scan: null, result: null, decision: null, overrideTo: null, reason: '' };
}

const visits = () => store.get('jj_visits', []);
const saveVisits = (v) => store.set('jj_visits', v);

// IndexedDB holds sweep videos until they are uploaded (localStorage is too small for video).
const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('jagajanin', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('videos');
      r.onsuccess = () => res(this.db = r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('videos', 'readwrite'); tx.objectStore('videos').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('videos').objectStore('videos').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async del(k) { const db = await this.open(); return new Promise((res) => { const tx = db.transaction('videos', 'readwrite'); tx.objectStore('videos').delete(k); tx.oncomplete = res; tx.onerror = res; }); },
};

function updateVisit(caseId, patch) {
  const all = visits().map((v) => (v.caseId === caseId ? { ...v, ...patch } : v));
  saveVisits(all);
  if (S.saved?.caseId === caseId) S.saved = all.find((v) => v.caseId === caseId);
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
function go(screen) { S.screen = screen; render(); window.scrollTo(0, 0); }

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  // Android ships an offline Indonesian voice. Javanese has no TTS voice yet:
  // production plays pre-recorded clips; here Javanese text is read with the Indonesian voice.
  u.lang = LANG === 'en' ? 'en-US' : 'id-ID';
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

// ---------- header ----------
function header() {
  const pending = visits().filter((v) => !v.synced || (v.videos || []).some((n) => !(v.uploaded || []).includes(n))).length;
  const on = navigator.onLine;
  return `<header class="top">
    <h1>Jagajanin</h1>
    <span class="pill ${on ? 'on' : 'off'}">● ${t(on ? 'online' : 'offline')}${pending ? ` · ${pending} ${t('queued')}` : ''}</span>
    <select class="lang" onchange="setLang(this.value)" aria-label="Language">
      ${['id', 'jv', 'en'].map((l) => `<option value="${l}" ${l === LANG ? 'selected' : ''}>${{ id: 'ID', jv: 'JV', en: 'EN' }[l]}</option>`).join('')}
    </select>
  </header>
  ${CLEAN ? `<div class="democap">${t('demo_caption')}</div>` : `<div class="demo">${t('demo_banner')}</div>`}`;
}
function setLang(l) { LANG = l; store.set('jj_lang', l); document.documentElement.lang = l; render(); }

// ---------- screens ----------
const screens = {
  home() {
    return `${header()}
      <div class="card">
        <h2>${t('welcome')}</h2>
        <p class="muted">${t('app_sub')}</p>
        <button onclick="startVisit()">${t('new_visit')}</button>
        <button class="ghost" onclick="go('history')">${t('history')} (${visits().length})</button>
      </div>
      ${visits().filter((v) => v.validation && !v.validation.ackAt).map((v) => `
        <div class="card" style="border-color:var(--blue)" onclick="openCase('${v.caseId}')">
          <div class="hist"><div><b>📩 ${t('doctor_replied')}</b><div class="meta">${esc(v.id)} · ${new Date(v.validation.at).toLocaleTimeString()}</div></div>
          <span class="tag ${v.validation.decision === 'rescan' ? 'unsure' : v.validation.decision}">${t('dec_' + v.validation.decision)}</span></div>
        </div>`).join('')}`;
  },

  intake() {
    const v = S.visit;
    const signs = ['bleeding', 'headache_vision', 'convulsion', 'fever', 'fluid_leak', 'reduced_movement', 'swelling_face_hands', 'severe_pain'];
    return `${header()}
      <div class="card">
        <label class="f">${t('demo_pick')}</label>
        <select onchange="loadScenario(this.value)">
          ${Object.entries(DEMO_SCENARIOS).map(([k, s]) => `<option value="${k}" ${k === S.scenario ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>
      </div>
      <div class="card">
        <h2>${t('intake_title')}</h2>
        <label class="f">${t('mother_id')}</label>
        <input value="${esc(v.id)}" oninput="S.visit.id=this.value">
        <label class="f">${t('age')}</label>
        <input type="number" inputmode="numeric" value="${esc(v.age)}" oninput="S.visit.age=+this.value||''">
        <label class="f">${t('hpht')}</label>
        <input type="date" value="${esc(v.hpht)}" oninput="S.visit.hpht=this.value">
        <label class="f">${t('bp')}</label>
        <div class="row">
          <input type="number" inputmode="numeric" placeholder="120" value="${esc(v.bpSys)}" oninput="S.visit.bpSys=+this.value||''">
          <span>/</span>
          <input type="number" inputmode="numeric" placeholder="80" value="${esc(v.bpDia)}" oninput="S.visit.bpDia=+this.value||''">
        </div>
      </div>
      <div class="card">
        <h3>${t('signs_title')}</h3>
        ${signs.map((s) => `<label class="check"><input type="checkbox" ${v.signs.includes(s) ? 'checked' : ''}
          onchange="toggleSign('${s}', this.checked)"> ${t('sign_' + s)}</label>`).join('')}
      </div>
      <div class="card">
        <h3>${t('probe_q')}</h3>
        <div class="probe-ok"><span class="led"></span>${t('probe_connected')}</div>
        <button onclick="go('protocol')">${t('probe_yes')}</button>
        <button class="ghost" onclick="S.scan=null; analyse(false)">${t('probe_no')}</button>
        <button class="ghost" onclick="go('home')">${t('back')}</button>
      </div>`;
  },

  // The whole protocol at a glance: six paths on the belly, no image reading involved.
  protocol() {
    return `${header()}
      <div class="card">
        <div class="kick">${t('protocol_kicker')}</div>
        <h2>${t('protocol_title')}</h2>
        <div class="proto">${torso(0)}
          <ol class="swlist">${[1, 2, 3, 4, 5, 6].map((k) => `<li><b>${k}</b><span>${t('sw_short_' + k)}</span></li>`).join('')}</ol>
        </div>
        <p class="muted" style="margin:10px 0 0">${t('protocol_sub')}</p>
        <div class="badges"><span>✓ ${t('b_no_training')}</span><span>🔊 ${t('b_voice')} ID · JV</span><span>✈ ${t('b_offline')}</span></div>
        <div class="probe-ok"><span class="led"></span>${t('probe_connected')}</div>
        <button onclick="S.sweep=1; go('sweep'); speak(t('sweep_1'))">${t('start_sweep1')}</button>
        <button class="ghost" onclick="go('intake')">${t('back')}</button>
      </div>`;
  },

  // One sweep: the path to follow (left) and the scanner's live stream being recorded (right).
  sweep() {
    const n = S.sweep;
    const done = !!S.captured[n];
    return `${header()}
      <div class="card">
        <div class="swtop">
          <div class="chips6">${[1, 2, 3, 4, 5, 6].map((k) => `<span class="${k === n ? 'cur' : S.captured[k] ? 'done' : ''}">${S.captured[k] && k !== n ? '✓' : k}</span>`).join('')}</div>
          <span class="timer" id="timer">00:00</span>
        </div>
        <h2>${t('sweep')} ${n} <span class="of">/ 6</span></h2>
        <div class="swgrid">
          <div>${torso(n, S.captured)}</div>
          <div class="feed"><canvas id="feed" width="300" height="372"></canvas>
            <span class="live">● ${t('live')}</span><span class="sim">${t('sim_label')}</span><span class="fr" id="frames"></span></div>
        </div>
        <p class="instr">${t('sweep_' + n)}</p>
        <div class="recbar ${done ? 'ok' : ''}" id="recbar"><div id="recfill" style="width:${done ? 100 : 0}%"></div>
          <span id="rectxt">${done ? '✓ ' + t('recorded_n', { n }) : '● ' + t('recording')}</span></div>
        <div class="row" style="margin-top:10px">
          <button class="ghost small" onclick="speak(t('sweep_${n}'))">🔊 ${t('play_voice')}</button>
          <span class="probe-ok sm"><span class="led"></span>${t('probe_connected')}</span>
          ${CLEAN ? '' : `<label class="pill" style="cursor:pointer">📷
            <input type="file" accept="video/*,image/*" capture="environment" hidden onchange="captureFile(${n}, this.files[0])"></label>`}
        </div>
        <button id="nextbtn" class="${done ? '' : 'ghost'}" onclick="nextSweep()">${n < 6 ? t('next_sweep', { n: n + 1 }) : t('finish_sweeps')}</button>
        <button class="ghost" onclick="S.sweep>1 ? (S.sweep--, render()) : go('protocol')">${t('back')}</button>
      </div>`;
  },

  // On-device analysis: each sweep and each fetal parameter ticks off as it is read.
  analysing() {
    const params = ['viab', 'count', 'plac', 'pres', 'ga', 'efw'];
    return `${header()}<div class="card">
      <div class="anhead"><div class="spinner sm"></div><div><h3 style="margin:0">${t('analyzing')}</h3>
        <span class="offchip">✈ ${t('an_ondevice')}</span></div></div>
      <div class="angrid">
        <div><div class="ank">${t('an_sweeps')}</div>${[1, 2, 3, 4, 5, 6].map((k, i) => `<div class="anrow" data-i="${i}"><span class="tick"></span>${t('sweep')} ${k}</div>`).join('')}</div>
        <div><div class="ank">${t('an_params')}</div>${params.map((k, i) => `<div class="anrow" data-i="${6 + i}"><span class="tick"></span>${t('an_p_' + k)}</div>`).join('')}</div>
      </div></div>`;
  },

  result() {
    const r = S.result;
    const ai = S.scan;
    const fmtF = (f) => `<div class="finding"><span class="dot ${f.level}"></span><div>
        ${esc(t('f_' + f.key, { d: f.detail }))}
        <div class="meta">${t(f.src === 'ai' ? 'src_ai' : 'src_clinical')}${f.conf != null ? ` · ${t('conf')} ${Math.round(f.conf * 100)}%` : ''}</div>
      </div></div>`;
    const order = { rujuk: 0, unsure: 1, hati: 2, ok: 3 };
    const findings = [...r.findings].sort((a, b) => order[a.level] - order[b.level]);
    const final = !S.decision ? null : finalOutcome();
    const canSave = S.decision === 'agree' || (S.decision === 'override' && S.overrideTo && S.reason.trim().length > 2);

    return `${header()}
      <div class="result ${r.outcome}">
        <div class="big">${t('out_' + r.outcome)}</div>
        <div>${t('out_' + r.outcome + '_sub')}</div>
        ${r.urgent ? `<div class="urgent">${t('urgent')}</div>` : ''}
        ${!r.scanned ? `<div class="muted" style="margin-top:8px">${t('noscan_note')}</div>` : `<div class="rmeta">✓ ${t('result_meta')}</div>`}
      </div>
      <div class="card"><h3>${t('why')}</h3>${findings.map(fmtF).join('') || '<p class="muted">—</p>'}</div>
      ${ai ? `<div class="card"><h3>${t('summary')}</h3>
        <div class="kv"><span>${t('ga_dates')}</span><b>${r.gaDates != null ? Math.floor(r.gaDates) + ' ' + t('weeks') : '—'}</b></div>
        <div class="kv"><span>${t('ga_ai')}</span><b>${ai.gaWeeks.conf >= CONF_MIN ? ai.gaWeeks.value + ' ' + t('weeks') : '?'}</b></div>
        <div class="kv"><span>${t('efw')}</span><b>${ai.efwKg.conf >= CONF_MIN ? ai.efwKg.value + ' kg' : '?'}</b></div>
      </div>` : ''}
      <div class="card">
        <h3>${t('decision_title')}</h3>
        <p class="muted">${t('decision_sub')}</p>
        <div class="seg">
          <button class="${S.decision === 'agree' ? 'sel' : ''}" onclick="S.decision='agree'; render()">✓ ${t('agree')}</button>
          <button class="${S.decision === 'override' ? 'sel' : ''}" onclick="S.decision='override'; render()">✎ ${t('override')}</button>
        </div>
        ${S.decision === 'override' ? `
          <div class="seg">${['aman', 'hati', 'rujuk'].map((o) => `<button class="${S.overrideTo === o ? 'sel' : ''}"
            onclick="S.overrideTo='${o}'; render()">${t('out_' + o)}</button>`).join('')}</div>
          <label class="f">${t('override_reason')}</label>
          <textarea oninput="S.reason=this.value; document.getElementById('savebtn').disabled = !(S.overrideTo && this.value.trim().length>2)">${esc(S.reason)}</textarea>` : ''}
        <button id="savebtn" ${canSave ? '' : 'disabled'} onclick="saveVisit()">${t('save')}${final ? ' — ' + t('out_' + final) : ''}</button>
        ${r.outcome === 'unsure' && r.scanned ? `<button class="ghost" onclick="S.sweep=1; S.captured={}; S.clips={}; go('sweep')">${t('redo')}</button>` : ''}
      </div>`;
  },

  referral() {
    const slip = referralText(S.saved);
    const showSlip = S.saved.final === 'rujuk' && S.saved.urgent;
    return `${header()}
      <div class="result ${S.saved.final}"><div class="big">${t('out_' + S.saved.final)}</div>
        <div>${t('saved')}</div>
        ${S.saved.urgent ? `<div class="urgent">${t('urgent_now')}</div>` : ''}</div>
      ${telemedCard(S.saved)}
      ${showSlip ? `<div class="card"><h3>${t('referral_title')}</h3>
        <pre class="slip">${esc(slip)}</pre>
        <div class="row" style="margin-top:10px">
          <a href="sms:?body=${encodeURIComponent(slip)}" style="flex:1"><button class="small" style="width:100%">✉ ${t('share_sms')}</button></a>
          <button class="ghost small" style="flex:1" onclick="copySlip()">${t('copy')}</button>
        </div></div>` : S.saved.final === 'rujuk' ? '' : `<div class="card"><div class="kv"><span>${t('followup')}</span>
          <b>${t('followup_days', { n: S.saved.final === 'hati' ? 7 : 28 })}</b></div></div>`}
      <button onclick="S = freshVisit(); go('home')">${t('back')}</button>`;
  },

  // Midwife view of one case: telemedicine status and the specialist's validated plan.
  case() {
    const v = S.saved;
    const val = v.validation;
    const lang = LANG === 'en' ? 'en' : 'id_';
    return `${header()}
      <div class="card"><div class="hist"><div><h2 style="margin:0">${esc(v.id || '—')}</h2>
        <div class="meta">${new Date(v.at).toLocaleString()}</div></div>
        <span class="tag ${v.final}">${t('out_' + v.final)}</span></div></div>
      ${telemedCard(v)}
      ${val ? `
        <div class="result ${val.decision === 'rescan' ? 'unsure' : val.decision}">
          <div class="muted" style="color:inherit">${t('validated_by')} ${esc(val.doctor)}</div>
          <div class="big">${t('dec_' + val.decision)}</div>
          ${val.timing === 'emergency' ? `<div class="urgent">${t('urgent_now')}</div>` : ''}
        </div>
        ${val.facility ? `<div class="card"><h3>${t('go_to')}</h3>
          <div style="font-size:18px;font-weight:700">${esc(val.facility.name)}</div>
          <div class="muted">${val.facility.km} km · ±${val.facility.min} ${t('minutes')} · ${val.timing === 'emergency' ? t('timing_emergency') : t('timing_scheduled') + (val.date ? ' ' + esc(val.date) : '')}</div></div>` : ''}
        ${val.actions?.length ? `<div class="card"><h3>${t('do_now')}</h3>
          ${val.actions.map((a) => `<label class="check"><input type="checkbox" ${(S.done || []).includes(a.id) ? 'checked' : ''}
            onchange="toggleDone('${a.id}', this.checked)" ${val.ackAt ? 'disabled' : ''}> ${esc(a[lang] || a.id_)}</label>`).join('')}</div>` : ''}
        ${val.note ? `<div class="card"><h3>${t('doctor_note')}</h3><p style="margin:0">${esc(val.note)}</p></div>` : ''}
        ${val.ackAt ? `<p class="muted" style="text-align:center">✓ ${t('acked')} ${new Date(val.ackAt).toLocaleTimeString()}</p>`
          : `<button onclick="ackCase()">${t('ack')}</button>`}
      ` : ''}
      <button class="ghost" onclick="go('history')">${t('back')}</button>`;
  },

  history() {
    const list = visits().slice().reverse();
    return `${header()}
      <div class="card"><h2>${t('history')}</h2>
        ${list.length ? list.map((v) => `<div class="finding hist" style="cursor:pointer" onclick="openCase('${v.caseId}')">
          <div><b>${esc(v.id || '—')}</b> <span class="muted">${new Date(v.at).toLocaleString()}</span>
            <div class="meta">${t('ai_said')}: ${t('out_' + v.aiOutcome)} → ${t('final')}: ${t('out_' + v.final)}${v.reason ? ' · ' + esc(v.reason) : ''}</div>
            <div class="meta">${statusLine(v)}</div></div>
          <span class="tag ${v.final}">${t('out_' + v.final)}</span></div>`).join('') : `<p class="muted">${t('no_history')}</p>`}
      </div>
      <button class="ghost" onclick="go('home')">${t('back')}</button>`;
  },
};

// ---------- actions ----------
function startVisit() {
  const scenario = S.scenario;
  S = freshVisit(); S.scenario = scenario;
  loadScenario(scenario);
  go('intake');
}
function loadScenario(key) {
  S.scenario = key;
  const v = DEMO_SCENARIOS[key].visit;
  const hpht = new Date(Date.now() - v.gaWeeks * 7 * 86400000).toISOString().slice(0, 10);
  S.visit = { id: DEMO_SCENARIOS[key].name || 'Demo-' + key, age: v.age, hpht, bpSys: v.bpSys, bpDia: v.bpDia, signs: [...v.signs] };
  render();
}
function toggleSign(s, on) {
  S.visit.signs = on ? [...new Set([...S.visit.signs, s])] : S.visit.signs.filter((x) => x !== s);
}
function captureFile(n, file) {
  if (!file) return;
  S.files[n] = file; S.captured[n] = true;
  render();
}
function nextSweep() {
  stopSweepRun();
  if (!S.files[S.sweep] && !S.clips[S.sweep]) S.clips[S.sweep] = demoClip(S.sweep).catch(() => null);
  if (S.sweep < 6) { S.sweep++; render(); window.scrollTo(0, 0); speak(t('sweep_' + S.sweep)); }
  else analyse(true);
}
async function analyse(withScan) {
  go('analysing');
  const minShow = new Promise((r) => setTimeout(r, withScan ? 2800 : 500));
  S.scan = withScan ? (await Promise.all([runScan(S.captured, S.scenario), minShow]))[0] : null;
  if (!withScan) await minShow;
  S.result = assess(S.visit, S.scan);
  S.decision = null; S.overrideTo = null; S.reason = '';
  go('result');
}
// Agreeing with "not sure" means "ask a doctor", so it is recorded as a referral.
function finalOutcome() {
  if (S.decision === 'override') return S.overrideTo;
  return S.result.outcome === 'unsure' ? 'rujuk' : S.result.outcome;
}
async function saveVisit() {
  const r = S.result;
  const final = finalOutcome();
  const caseId = 'JJ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  // Real recordings first; demo placeholder clips for sweeps that were not recorded.
  const videos = [];
  for (let n = 1; n <= 6; n++) {
    const blob = S.files[n] || (S.clips[n] ? await S.clips[n] : null);
    if (blob) { await idb.put(`${caseId}_${n}`, blob).catch(() => {}); videos.push(n); }
  }
  const rec = {
    caseId, id: S.visit.id, at: Date.now(), visit: S.visit, scan: S.scan, findings: r.findings,
    aiOutcome: r.outcome, final, urgent: r.urgent, reason: S.decision === 'override' ? S.reason : '',
    midwife: 'Bidan Sari', puskesmas: 'Puskesmas Ondera', scanned: r.scanned,
    gaDates: r.gaDates, videos, uploaded: [], synced: false, validation: null,
  };
  const all = visits(); all.push(rec); saveVisits(all);
  S.saved = rec;
  go('referral');
  trySync();
}
function openCase(caseId) {
  S.saved = visits().find((v) => v.caseId === caseId);
  if (!S.saved) return;
  S.done = S.saved.validation?.doneActions || [];
  go('case');
}
function toggleDone(id, on) {
  S.done = on ? [...new Set([...(S.done || []), id])] : (S.done || []).filter((x) => x !== id);
}
async function ackCase() {
  const v = S.saved;
  const ackAt = Date.now();
  updateVisit(v.caseId, { validation: { ...v.validation, ackAt, doneActions: S.done || [] } });
  render();
  try {
    await fetch(`api/cases/${v.caseId}/ack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doneActions: S.done || [] }) });
  } catch {}
}
function telemedCard(v) {
  const steps = [
    { ok: true, label: t('tm_saved') },
    { ok: v.synced, label: t('tm_sent') },
    ...(v.videos?.length ? [{ ok: v.videos.every((n) => (v.uploaded || []).includes(n)),
      label: t('tm_videos', { a: (v.uploaded || []).length, b: v.videos.length }) }] : []),
    { ok: !!v.validation, label: v.validation ? t('tm_validated') : t('tm_waiting') },
  ];
  return `<div class="card"><h3>${t('tm_title')}</h3>
    ${steps.map((s) => `<div class="finding"><span class="dot ${s.ok ? 'ok' : 'unsure'}"></span><div>${s.label}</div></div>`).join('')}
    ${v.urgent && !v.validation ? `<p class="muted" style="margin:8px 0 0">${t('urgent_dont_wait')}</p>` : ''}
  </div>`;
}
function statusLine(v) {
  if (v.validation) return `👩‍⚕️ ${t('dec_' + v.validation.decision)}${v.validation.ackAt ? ' · ✓' : ' · ' + t('new_reply')}`;
  if (!v.synced) return '⏳ ' + t('pending');
  return '📤 ' + t('tm_waiting');
}
function referralText(rec) {
  const lines = rec.findings.filter((f) => f.level !== 'ok').map((f) => '- ' + t('f_' + f.key, { d: f.detail }));
  return [
    `JAGAJANIN — ${t('referral_title').toUpperCase()}`,
    t('referral_to'),
    `${t('mother_id')}: ${rec.id || '-'}   ${t('age')}: ${rec.visit.age || '-'}`,
    `HPHT: ${rec.visit.hpht || '-'}   TD: ${rec.visit.bpSys || '-'}/${rec.visit.bpDia || '-'}`,
    `${t('final')}: ${t('out_' + rec.final)}${rec.urgent ? ' (' + t('urgent') + ')' : ''}`,
    `${t('why')}:`, ...(lines.length ? lines : ['-']),
    `${t('ai_said')}: ${t('out_' + rec.aiOutcome)}${rec.reason ? ' · ' + rec.reason : ''}`,
    new Date(rec.at).toLocaleString(),
  ].join('\n');
}
function copySlip() {
  navigator.clipboard?.writeText(referralText(S.saved)).then(() => toast(t('copied')), () => {});
}

// Store-and-forward: cases stay on the phone and go to the tele-specialist when a signal appears.
// Assessment first (a few KB, fits on weak 2G/3G), raw sweep videos after; then poll for the validation.
// Production target: a clinic backend integrated with SATUSEHAT (FHIR).
// Background updates only refresh status screens, never a form or a sweep in progress.
function softRender() {
  if (['home', 'referral', 'case', 'history'].includes(S.screen)) render();
}
let syncing = false;
async function trySync() {
  if (!navigator.onLine || syncing) return;
  syncing = true;
  try {
    for (const v of visits()) {
      const { videos, uploaded, synced, validation, ...payload } = v;
      if (!v.synced) {
        const r = await fetch('api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, videos }) });
        if (!r.ok) throw new Error('case upload failed');
        updateVisit(v.caseId, { synced: true }); softRender();
      }
      for (const n of v.videos || []) {
        if ((visits().find((x) => x.caseId === v.caseId).uploaded || []).includes(n)) continue;
        const blob = await idb.get(`${v.caseId}_${n}`);
        if (!blob) continue;
        const r = await fetch(`api/cases/${v.caseId}/videos/${n}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
        if (!r.ok) throw new Error('video upload failed');
        const up = [...(visits().find((x) => x.caseId === v.caseId).uploaded || []), n];
        updateVisit(v.caseId, { uploaded: up });
        await idb.del(`${v.caseId}_${n}`);   // nothing stays on the phone once it is safely sent
        softRender();
      }
    }
    await pollValidations();
  } catch { /* no server or no signal: keep everything queued, retry later */ }
  syncing = false;
}
async function pollValidations() {
  for (const v of visits().filter((x) => x.synced && !x.validation)) {
    const r = await fetch(`api/cases/${v.caseId}`);
    if (!r.ok) continue;
    const c = await r.json();
    if (c.validation) {
      updateVisit(v.caseId, { validation: c.validation });
      toast('📩 ' + t('doctor_replied') + ': ' + (v.id || ''));
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      softRender();
    }
  }
}
setInterval(trySync, 5000);
window.addEventListener('online', () => { softRender(); trySync(); });
window.addEventListener('offline', softRender);

// ---------- six-sweep illustration ----------
// Mother faces the viewer: her right is the viewer's left.
const SWEEP_PATHS = {
  1: [100, 205, 100, 70], 2: [68, 200, 68, 80], 3: [132, 200, 132, 80],
  4: [58, 192, 142, 192], 5: [50, 140, 150, 140], 6: [62, 92, 138, 92],
};
// cur = 0 draws the whole protocol; otherwise the current sweep is highlighted,
// recorded sweeps turn green and the rest stay faint.
function torso(cur, done = {}) {
  const col = { all: 'var(--blue)', cur: 'var(--blue)', done: 'var(--aman)', todo: '#b9c3d4' };
  const paths = [1, 2, 3, 4, 5, 6].map((k) => {
    const [x1, y1, x2, y2] = SWEEP_PATHS[k];
    const st = cur === 0 ? 'all' : k === cur ? 'cur' : done[k] ? 'done' : 'todo';
    const w = st === 'cur' ? 6 : st === 'all' ? 4 : 3.5;
    const len = Math.hypot(x2 - x1, y2 - y1), bx = x1 - ((x2 - x1) / len) * 11, by = y1 - ((y2 - y1) / len) * 11;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col[st]}" stroke-width="${w}" stroke-linecap="round"
        ${st === 'todo' ? 'stroke-dasharray="2 7"' : ''} opacity="${st === 'done' ? 0.75 : 1}" marker-end="url(#ah-${st})"/>
      <circle cx="${bx}" cy="${by}" r="${st === 'cur' ? 9 : 7.5}" fill="${col[st]}"/>
      <text x="${bx}" y="${by + 3.6}" text-anchor="middle" font-size="${st === 'cur' ? 11 : 9.5}" font-weight="800" fill="#fff">${k}</text>`;
  }).join('');
  const marker = (id, c) => `<marker id="ah-${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`;
  const p = cur ? SWEEP_PATHS[cur] : null;
  return `<svg class="torso" viewBox="0 0 200 240" role="img" aria-label="${cur ? t('sweep') + ' ' + cur : t('protocol_kicker')}">
    <defs>${Object.entries(col).map(([k, c]) => marker(k, c)).join('')}</defs>
    <path d="M70 10 Q60 30 64 45 L136 45 Q140 30 130 10 Q118 22 100 22 Q82 22 70 10z" fill="#f6e3cf"/>
    <path d="M64 45 Q50 60 52 80 Q30 130 40 185 Q48 212 100 216 Q152 212 160 185 Q170 130 148 80 Q150 60 136 45z" fill="#f5cfa0"/>
    <path d="M44 196 Q100 230 156 196 L158 214 Q100 240 42 214z" fill="#f2b39a"/>
    <circle cx="100" cy="150" r="2.5" fill="#d9a77a"/>
    ${paths}
    ${p ? `<g id="probe" transform="translate(${p[0]} ${p[1]})"><rect x="-13" y="-6" width="26" height="12" rx="6" fill="#1d2433" stroke="#fff" stroke-width="2.5"/></g>` : ''}
  </svg>`;
}

// ---------- connected scanner: live stream ----------
// The Puskesmas scanner streams to the phone while the midwife slides the probe; each sweep is
// recorded as a short clip for the on-device model and, later, the tele-specialist.
// DEMO: the stream is SIMULATED speckle (labelled "simulasi" on screen), never patient data.
const SWEEP_MS = 4000;
let SPECKLE = null;
function speckle() {
  if (SPECKLE) return SPECKLE;
  const w = 420, h = 240, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = Math.random(), v = Math.min(255, 40 + 150 * Math.sqrt(-2 * Math.log(1 - r * 0.999)) * 0.55);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (SPECKLE = c);
}
function drawFeed(cv, n, p, now) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, ax = W / 2, ay = 14, R = H - 24;
  const a0 = Math.PI / 2 - 0.62, a1 = Math.PI / 2 + 0.62;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.moveTo(ax, ay); g.arc(ax, ay, R, a0, a1); g.closePath(); g.clip();
  // tissue: speckle texture sliding with the probe, plus a little live shimmer
  const sx = -p * 330 + (Math.sin(now / 90) * 1.5), sy = (n % 3) * 18;
  g.imageSmoothingEnabled = true;
  g.globalAlpha = 0.95; g.drawImage(speckle(), sx, sy - 20, W * 2.2, H * 1.15);
  g.globalAlpha = 1;
  // amniotic fluid (dark) and a fetal structure crossing the field as the probe moves
  const cx = W * (1.05 - p * 0.95) + (n % 2 ? 0 : -30), cy = H * (0.55 + 0.05 * Math.sin(n));
  g.fillStyle = 'rgba(0,0,0,.78)';
  g.beginPath(); g.ellipse(cx, cy, W * 0.36, H * 0.2, 0.15 * n, 0, Math.PI * 2); g.fill();
  g.filter = 'blur(1.5px)';
  g.strokeStyle = 'rgba(235,235,235,.75)'; g.lineWidth = 7;
  g.beginPath(); g.ellipse(cx + 10, cy, W * 0.15, H * 0.11, 0.3 * n, 0, Math.PI * 2); g.stroke();
  if (n % 2) { g.lineWidth = 5; g.beginPath(); g.ellipse(cx - 70, cy + 34, W * 0.12, H * 0.05, -0.2, Math.PI, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(210,210,210,.35)';
  g.fillRect(0, ay + 26 + (n % 3) * 6, W, 18);   // placenta / uterine wall band
  g.filter = 'none';
  // depth attenuation
  const fade = g.createRadialGradient(ax, ay, R * 0.35, ax, ay, R);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,.65)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(ax, ay); g.arc(ax, ay, R, a0, a1); g.closePath(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '600 13px system-ui';
  for (let d = 1; d <= 4; d++) g.fillRect(W - 14, ay + (R / 5) * d, 8, 2);
}

let RUN = null;
function stopSweepRun() {
  if (!RUN) return;
  cancelAnimationFrame(RUN.raf);
  if (RUN.rec && RUN.rec.state === 'recording') { RUN.rec.onstop = null; try { RUN.rec.stop(); } catch {} }
  RUN = null;
}
function startSweepRun() {
  stopSweepRun();
  const cv = document.getElementById('feed');
  if (!cv) return;
  const n = S.sweep, was = !!S.captured[n];
  const run = RUN = { n, t0: performance.now(), raf: 0, rec: null };
  const type = window.MediaRecorder && ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
  if (!was && type && cv.captureStream) {
    const chunks = [];
    run.rec = new MediaRecorder(cv.captureStream(15), { mimeType: type });
    run.rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    run.rec.onstop = () => { if (!S.files[n]) S.clips[n] = Promise.resolve(new Blob(chunks, { type: type.split(';')[0] })); };
    run.rec.start();
  }
  const [x1, y1, x2, y2] = SWEEP_PATHS[n];
  const tick = (now) => {
    if (RUN !== run) return;
    const el = now - run.t0, p = was ? 1 : Math.min(1, el / SWEEP_MS);
    drawFeed(cv, n, p, now);
    const probe = document.getElementById('probe');
    if (probe) probe.setAttribute('transform', `translate(${x1 + (x2 - x1) * p} ${y1 + (y2 - y1) * p})`);
    if (!was) {
      const fill = document.getElementById('recfill'), fr = document.getElementById('frames');
      if (fill) fill.style.width = p * 100 + '%';
      if (fr) fr.textContent = `${Math.round(p * SWEEP_MS * 0.03)} ${t('frames')}`;
      if (p >= 1 && !S.captured[n]) {
        S.captured[n] = true;
        if (run.rec && run.rec.state === 'recording') run.rec.stop();
        document.getElementById('recbar')?.classList.add('ok');
        const tx = document.getElementById('rectxt'); if (tx) tx.textContent = '✓ ' + t('recorded_n', { n });
        document.getElementById('nextbtn')?.classList.remove('ghost');
        document.querySelector('.chips6 .cur')?.classList.add('rec');
      }
    }
    run.raf = requestAnimationFrame(tick);
  };
  run.raf = requestAnimationFrame(tick);
}

// ---------- demo placeholder clip ----------
// When a sweep is not recorded in demo mode, synthesize a 2-second speckle clip so the
// tele-specialist's video panel can be demonstrated WITHOUT any patient data.
function demoClip(n) {
  return new Promise((resolve, reject) => {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return reject(new Error('unsupported'));
    const W = 320, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const og = o.getContext('2d');
    const img = og.createImageData(W, H);
    const type = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    if (!type) return reject(new Error('no codec'));
    const rec = new MediaRecorder(c.captureStream(15), { mimeType: type });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => resolve(new Blob(chunks, { type: type.split(';')[0] }));
    let f = 0;
    const draw = () => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const y = (i / 4 / W) | 0, x = (i / 4) % W;
        const blob = Math.exp(-(((x - 160 - Math.sin(f / 6) * 8) ** 2) / 1800 + ((y - 140) ** 2) / 900));
        const v = (Math.random() * 90 + 40) * (0.35 + 0.65 * (1 - blob));
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      og.putImageData(img, 0, 0);
      // putImageData ignores clipping, so draw the noise through the ultrasound fan via drawImage.
      g.save(); g.beginPath(); g.moveTo(W / 2, 10); g.arc(W / 2, 10, 220, Math.PI * 0.28, Math.PI * 0.72); g.closePath(); g.clip();
      g.drawImage(o, 0, 0); g.restore();
      g.fillStyle = '#ffd34d'; g.font = 'bold 13px sans-serif';
      g.fillText(`DEMO · Sweep ${n} · synthetic, not patient data`, 10, H - 12);
      f++;
    };
    rec.start();
    const iv = setInterval(draw, 66); draw();
    setTimeout(() => { clearInterval(iv); rec.stop(); }, 2000);
  });
}

// ---------- render ----------
let timerInt;
function render() {
  stopSweepRun();
  $app.innerHTML = screens[S.screen]();
  clearInterval(timerInt);
  if (S.screen === 'sweep') startSweepRun();
  if (S.screen === 'analysing') {
    document.querySelectorAll('.anrow').forEach((el) => setTimeout(() => el.classList.add('done'), 250 + +el.dataset.i * 190));
  }
  if (S.screen === 'sweep') {
    const start = Date.now();
    timerInt = setInterval(() => {
      const el = document.getElementById('timer'); if (!el) return;
      const s = Math.floor((Date.now() - start) / 1000);
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.documentElement.lang = LANG;
render();
trySync();
