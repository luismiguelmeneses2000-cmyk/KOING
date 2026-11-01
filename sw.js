// Service worker de KOING: la app abre sin internet y muestra lo último que viste
const VERSION = 'koing-v3';
const SHELL = ['/', '/index.html', '/css/app.css', '/js/app.js', '/js/api.js', '/js/calc.js', '/js/pig.js', '/js/instalar.js', '/manifest.webmanifest', '/favicon.ico', '/icons/icon-192.png', '/icons/favicon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Datos: primero internet; si no hay, lo último guardado
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION + '-data').then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.open(VERSION + '-data').then((c) => c.match(req)).then((r) => r || new Response(JSON.stringify({ error: 'Sin conexión' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  // Archivos de la app: primero internet (para recibir cambios), si falla usa la copia
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && (url.origin === location.origin || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))));
});
