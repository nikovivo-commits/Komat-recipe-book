/* Offline support for the floor book. The app comes from the network when it can, so updates arrive straight
   away, and from the cache when the Wi-Fi drops. Photos and fonts come from the cache first. */
const CACHE = 'komat-floor-v50';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'floor.css', 'data/examples.js',
  'js/fdata.js', 'js/fapp.js', 'js/tonight.js', 'js/food.js', 'js/wine.js', 'js/pairing.js', 'js/lang.js', 'data/bg.js', 'js/stock.js', 'js/count.js', 'js/quiz.js', 'js/fschedule.js', 'js/fadmin.js', 'js/hype.js', 'data/ingart.js',
  '../css/app.css', '../data/translations.js', '../data/art.js', '../data/recipes.js', '../vendor/firebase.js', '../firebase-config.js',
  '../js/core.js', '../js/allergens.js', '../js/store.js', '../js/cloud.js', '../js/gestures.js', '../js/motion.js', '../js/photos.js',
  '../assets/brand/logo.png', '../assets/brand/icon-192.png', '../assets/photos/theme/cat.jpg', '../assets/photos/theme/recipes.jpg',
];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('komat-floor-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (url.origin !== location.origin && !font) return;
  if (req.destination === 'video') return;
  if (req.destination === 'image' || font) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match(new URL('index.html', self.registration.scope).href) : undefined)).then((r) => r || Response.error())));
});
