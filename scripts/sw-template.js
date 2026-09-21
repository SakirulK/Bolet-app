/* global self, caches, __VERSION__, __ASSETS__ */
const CACHE = 'bolet-' + __VERSION__;
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  // Installation is atomic: never advertise offline readiness for a partial bundle.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bolet-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try { const response = await fetch(request); if (response.ok) await cache.put(request, response.clone()); return response; }
      catch {
        const exact = await cache.match(request);
        if (exact) return exact;
        if (url.pathname === '/practice' || /^\/(study|library)\/.+/.test(url.pathname)) return (await cache.match('/offline'));
        return (await cache.match(url.pathname)) || (await cache.match('/offline'));
      }
    })());
  } else if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => { const cache = await caches.open(CACHE); const cached = await cache.match(request); if (cached) return cached; const response = await fetch(request); if (response.ok) await cache.put(request, response.clone()); return response; })());
  } else if (request.headers.get('RSC') === '1') {
    // Next falls back to a document navigation when an RSC navigation fails.
    // Documents use the offline shell above, preserving the requested URL and IDs.
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
  }
});
