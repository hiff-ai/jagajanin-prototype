// Jagajanin prototype — one navigation bar across the demo screens, so a single link
// (the demo home) reaches the midwife app, the specialist console, the receiving hospital
// and the loop dashboard. Keeps ?lang and ?clean when switching screens.
(() => {
  const params = new URLSearchParams(location.search);
  const keep = new URLSearchParams();
  keep.set('lang', params.get('lang') || 'en');
  if (params.has('clean')) keep.set('clean', params.get('clean'));
  const q = keep.toString() ? '?' + keep : '';
  const en = (params.get('lang') || 'en') === 'en';
  const page = location.pathname.split('/').pop() || 'demo.html';
  const items = [
    ['demo.html', en ? 'Start here' : 'Mulai', '●'],
    ['index.html', en ? '1 · Midwife app' : '1 · Aplikasi bidan'],
    ['doctor.html', en ? '2 · Specialist console' : '2 · Konsol spesialis'],
    ['hospital.html', en ? '3 · Receiving hospital' : '3 · RS tujuan'],
    ['loop.html', en ? '4 · Loop dashboard' : '4 · Dasbor loop'],
  ];
  const css = `
    #jjnav { position: relative; z-index: 50; display: flex; align-items: center; gap: 6px; overflow-x: auto;
      padding: 8px max(12px, env(safe-area-inset-left, 0px)); background: #0b2447; color: #fff;
      font: 600 13px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; scrollbar-width: none; }
    #jjnav::-webkit-scrollbar { display: none; }
    #jjnav .brand { white-space: nowrap; margin-right: 6px; opacity: .9; }
    #jjnav .brand b { color: #8fbaf5; }
    #jjnav a { color: #dbe7fb; text-decoration: none; white-space: nowrap; padding: 6px 11px; border-radius: 999px; }
    #jjnav a:hover { background: rgba(255,255,255,.1); }
    #jjnav a.on { background: #2f7de1; color: #fff; }
    #jjnav a:focus-visible { outline: 2px solid #8fbaf5; outline-offset: 1px; }
    #jjnav .lang { margin-left: auto; white-space: nowrap; opacity: .85; padding-left: 8px; }
    #jjnav .lang a { padding: 6px 8px; }`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  const nav = document.createElement('nav');
  nav.id = 'jjnav';
  nav.setAttribute('aria-label', en ? 'Demo screens' : 'Layar demo');
  const swap = (lang) => { const p = new URLSearchParams(keep); p.set('lang', lang); return page + '?' + p; };
  nav.innerHTML = `<span class="brand"><b>JagaJanin</b> ${en ? 'demo' : 'demo'}</span>` +
    items.map(([href, label]) => `<a href="${href}${q}" class="${href === page ? 'on' : ''}" ${href === page ? 'aria-current="page"' : ''}>${label}</a>`).join('') +
    `<span class="lang"><a href="${swap('en')}" class="${en ? 'on' : ''}">EN</a><a href="${swap('id')}" class="${en ? '' : 'on'}">ID</a></span>`;
  document.body.insertBefore(nav, document.body.firstChild);
})();
