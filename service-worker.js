// service-worker.js — офлайн-кеш для PWA.
//   cache-first для статики (HTML/CSS/JS/иконки),
//   network-first для JSON-данных (с фолбэком на кеш офлайн).

const VERSION = 'kt-ads-v1';
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;

// Относительные пути (для GitHub Pages в подпапке).
const STATIC_ASSETS = [
  './',
  './index.html',
  './topics.html',
  './topic.html',
  './quiz.html',
  './tests.html',
  './css/styles.css',
  './js/app.js',
  './js/data-loader.js',
  './js/progress.js',
  './js/quiz-engine.js',
  './js/topics.js',
  './js/quiz.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll прерывается, если хоть один ресурс не найден — поэтому добавляем мягко
      Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isData = url.pathname.includes('/data/') || url.pathname.endsWith('.json');

  if (isData) {
    // network-first для данных
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // cache-first для статики
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // навигационный фолбэк офлайн
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
