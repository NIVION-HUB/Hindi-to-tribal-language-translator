const CACHE_NAME = 'bhashasetu-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/tailwind.css',
  '/css/fonts.css',
  '/css/style.css',
  '/js/app.js',
  '/js/data.js',
  '/js/speech.js',
  '/js/translator.js',
  '/js/pdf-translator.js',
  '/js/avatar.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            // Only cache valid responses from our origin to avoid opaque response issues
            if (fetchResponse.status === 200) {
                cache.put(event.request, fetchResponse.clone());
            }
            return fetchResponse;
          });
        });
      })
  );
});
