const CACHE_NAME = "admin-pwa-v8";
const ASSETS = [
  "/admin_login.html",
  "/admin.html",
  "/manifest-admin.json",
  "/style.css?v=20260209c",
  "/js/core.js?v=20260209c",
  "/js/auth.js?v=20260209c",
  "/js/admin.js?v=20260209c",
  "/js/admin_pwa.js?v=20260209c",
  "/assets/payments/Logo_Drogueria.svg",
  "/assets/payments/Logo_Coopidrogas.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isAdminHtml =
    url.pathname === "/admin.html" || url.pathname === "/admin_login.html";

  const isAdminAsset =
    isAdminHtml ||
    url.pathname === "/style.css" ||
    url.pathname === "/manifest-admin.json" ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/assets/payments/");

  if (!isAdminAsset) return;

  if (isAdminHtml) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => cached);
    })
  );
});
