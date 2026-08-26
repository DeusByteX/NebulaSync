const CACHE_NAME = 'nebulasync-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('NebulaSync PWA caching static shell assets...');
      return cache.addAll(ASSETS).catch(err => console.log('PWA cache pre-load error ignored:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('PWA cleaning old shell cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Ignore API requests and WebSockets
  if (e.request.url.includes('/api/') || e.request.url.includes('socket.io')) {
    return;
  }

  // Network-First Strategy: Fetch from network first, dynamically update cache, fall back to cache when offline
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache successful static GET requests
        if (response.ok && e.request.method === 'GET' && e.request.url.startsWith(self.location.origin)) {
          const cacheCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, cacheCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(e.request);
      })
  );
});
