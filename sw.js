const CACHE = 'toolbox-v7';
const ASSETS = [
  './',
  './index.html',
  './pad-rat.html',
  './panel-schedule.html',
  './manifest.json',
  './style.css',
  './css/styles.css',
  './css/panel-schedule.css',
  './game.js',
  './js/app.js',
  './js/panel-schedule.js',
  './js/arcade.js',
  './js/bin-blaster.js',
  './js/trying-to-be-normal.js',
  './js/vendor/solver.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const c = res.clone();
        caches.open(CACHE).then((x) => x.put(e.request, c));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
