// Red primero, caché como respaldo. Las llamadas al servidor nunca se guardan.
const CACHE = "finanzas-v4";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Los videos pesan: no se guardan en la caché (ni se interceptan, para no romper el streaming/Range).
  if (/\/como-funciona\.(mp4|jpg)$/.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))
  );
});
