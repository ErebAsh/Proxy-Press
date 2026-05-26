const CACHE_NAME = 'proxy-press-v1.0.0.6';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/favicon.ico',
];

// Install event - caching basic assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
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

// Fetch event with hybrid strategy (Network-First for HTML/Pages, Stale-While-Revalidate for static assets)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const isPage = event.request.mode === 'navigate' || 
                 (event.request.headers.get('accept')?.includes('text/html')) ||
                 event.request.headers.get('rsc') === '1' ||
                 event.request.headers.has('next-router-state-tree') ||
                 event.request.url.includes('/_next/data/');

  if (isPage) {
    // Strategy: Network-First for HTML pages (avoids displaying stale/cached dashboard after logout)
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If valid response, clone and update cache for offline fallback
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: try cache, otherwise show error
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || new Response('Offline content unavailable', {
              headers: { 'Content-Type': 'text/html' }
            });
          });
        })
    );
    return;
  }

  // Strategy: Stale-While-Revalidate for static assets (JS, CSS, images, etc.)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          return cachedResponse;
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});
