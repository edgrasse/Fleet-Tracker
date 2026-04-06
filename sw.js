const CACHE_NAME = 'fleet-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './sw.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.log('Cache add error (non-critical):', err);
        // Continue even if some assets fail
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network first strategy for HTML
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname.endsWith('.html'))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(request).then(cached => {
            return cached || new Response('Offline - could not load page', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
    );
    return;
  }

  // Cache first strategy for static assets (fonts, CSS, JS)
  if (request.method === 'GET' && (url.pathname.match(/\.(css|js|woff|woff2|ttf|eot)$/))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network first for everything else (API calls, data)
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});
