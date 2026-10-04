// Precache-everything service worker.
// Release ritual: bump CACHE together with APP_VERSION in js/config.js, commit,
// push. Without the bump, browsers keep serving the previous version.
const CACHE = 'penguinshore-v1';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/scene.css',
  './js/main.js',
  './js/config.js',
  './js/game.js',
  './js/format.js',
  './js/storage.js',
  './js/audio.js',
  './js/music.js',
  './js/penguin.js',
  './js/scene.js',
  './js/fx.js',
  './js/ui.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache:'reload' bypasses the HTTP cache — without it a new worker can
      // precache stale copies (GitHub Pages serves max-age=600) into a fresh cache.
      .then((cache) => Promise.all(
        ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)),
      ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => cached || fetch(event.request)),
  );
});
