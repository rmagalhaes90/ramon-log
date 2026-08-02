const VERSION = '4.0.0-alpha.1';
const SHELL = `kyro-v4-shell-${VERSION}`;
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './version.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('kyro-v4-shell-') && key !== SHELL).map((key) => caches.delete(key)))),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') event.ports?.[0]?.postMessage({ version: VERSION });
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      event.waitUntil(caches.open(SHELL).then((cache) => cache.put('./index.html', copy)));
      return response;
    }).catch(() => caches.match('./index.html')));
  }
});
