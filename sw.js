/* Offline support for the stand-alone site. The app itself comes from the network when it can,
   so updates arrive straight away, and from the cache when the kitchen Wi-Fi drops.
   Photos and fonts come from the cache first, so pages open fast. */
const CACHE = 'komat-v42';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'data/translations.js', 'data/produce.js', 'data/art.js', 'data/recipes.js', 'data/settings.js', 'vendor/firebase.js', 'firebase-config.js',
  'js/core.js', 'js/allergens.js', 'js/store.js', 'js/data.js', 'js/cloud.js', 'js/timers.js', 'js/gestures.js', 'js/motion.js', 'js/moments.js', 'js/ink.js', 'js/app.js', 'js/photos.js',
  'js/recipes.js', 'js/editor.js', 'js/today.js', 'js/ordercheck.js', 'js/orders.js', 'js/schedule.js', 'js/events.js', 'js/admin.js', 'js/login.js', 'js/print.js',
  'assets/brand/logo.png', 'assets/brand/logo-black.png', 'assets/brand/icon-192.png', 'assets/brand/apple-touch-icon.png', 'assets/photos/theme/cat.jpg', 'assets/photos/theme/today.jpg',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  /* one missing file must not stop the rest from being saved */
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
  /* no-cache: always ask the server whether a file changed, so a new version shows on the next open */
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)).then((r) => r || Response.error())));
});
