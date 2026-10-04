// Network-first service worker with cache fallback: always fresh when online, and after one load
// the whole app (and, in production, the model file) works offline.
const CACHE = 'jagajanin-v4';
const ASSETS = ['./', 'index.html', 'app.js', 'rules.js', 'model.js', 'i18n.js', 'manifest.json', 'icon.svg', 'protocols.js', 'doctor.html', 'doctor.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  // Telemedicine API is always live; only the app shell is served from cache.
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
