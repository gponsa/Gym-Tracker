/* Gym Tracker service worker.
   Caches the app shell only. Data lives in IndexedDB and syncs through the
   Apps Script endpoint, so this never caches API responses: a stale cached
   next_session would be worse than no session at all. */

const CACHE = 'gym-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never touch the sync endpoint. Let it fail honestly when offline so the
  // app falls back to its queue instead of replaying a stale response.
  if (url.hostname.includes('script.google') || url.hostname.includes('googleusercontent')) {
    return;
  }
  if (e.request.method !== 'GET') return;

  // Shell: cache first, network as backfill.
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
