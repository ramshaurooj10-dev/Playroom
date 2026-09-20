const CACHE_NAME = 'playroom-pwa-v2';

// Essential core static assets to precache immediately on service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/rhyme.mp3'
];

// 1. Install Event: Pre-cache core assets and force immediate activation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching core Playroom offline resources');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache partial error:', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Clean up old caches & take control of all open client tabs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting legacy cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Serve cached content offline, update cache dynamically when online
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip browser extensions or unsupported URL schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip analytics domain requests from service worker local cache
  if (url.hostname.includes('google-analytics') || url.hostname.includes('googletagmanager')) return;

  // Navigation requests (HTML pages): Network-First, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: Serve cached root index.html
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Static Assets (JS, CSS, Media, Audio, Fonts, Images): Cache-First, fallback to Network + dynamic caching
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache if online
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
            }
          })
          .catch(() => {
            // Ignore network fetch errors when offline
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store in cache
      return fetch(req).then((networkResponse) => {
        // Do not cache non-200 or opaque error responses
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cache valid static responses
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseClone);
        });

        return networkResponse;
      }).catch((err) => {
        console.warn('[ServiceWorker] Offline fetch failed for:', req.url, err);
        // Fallback for audio or image assets if needed
        if (req.headers.get('accept')?.includes('image')) {
          return caches.match('/icon-192.png');
        }
      });
    })
  );
});
