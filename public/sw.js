const CACHE_NAME = "marca-minha-vez-v2";
const APP_SHELL = ["/manifest.webmanifest", "/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/authenticated data. Those responses must remain fresh.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigations must prefer the network so an old HTML document never keeps
  // referencing an obsolete JavaScript bundle after a deployment.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Cache versioned static assets for offline use.
  const destination = event.request.destination;
  const cacheable = destination === "script" || destination === "style" || destination === "image" || destination === "font" || destination === "manifest";
  if (!cacheable) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && cacheable) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());

      return cached || network;
    }),
  );
});
