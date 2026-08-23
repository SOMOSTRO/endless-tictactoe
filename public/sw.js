// Endless Tic-Tac-Toe — Stale-While-Revalidate PWA Service Worker

const CACHE_NAME = 'endless-ttt-v2.1.1';
const CACHE_PREFIX = 'endless-ttt-';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './site.webmanifest',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-maskable-192.png',
  './images/icon-maskable-512.png'
];

function assetUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function isCacheableRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  return request.mode === 'navigate' || ['style', 'script', 'font', 'image', 'audio', 'video'].includes(request.destination);
}

async function revalidate(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return undefined;
  }
}

// Install: pre-cache the app shell. Vite's hashed files are discovered at
// runtime by the fetch handler and cached on their first request.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS.map(assetUrl)))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove only caches owned by this app, preserving unrelated apps
// sharing the same origin.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate for the app shell and static assets. A cached
// response is returned immediately, while waitUntil keeps the revalidation
// alive after the response has been delivered.
self.addEventListener('fetch', (event) => {
  if (!isCacheableRequest(event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const networkResponse = revalidate(event.request, cache);
      event.waitUntil(networkResponse);

      if (cachedResponse) return cachedResponse;

      const response = await networkResponse;
      if (response) return response;

      if (event.request.mode === 'navigate') {
        const shell = await cache.match(assetUrl('./index.html'));
        if (shell) return shell;
      }

      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});
