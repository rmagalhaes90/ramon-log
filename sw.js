const CACHE_NAME = "ramon-log-v4";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isHTML = event.request.mode === "navigate" || event.request.destination === "document";

  if (isHTML) {
    // Network-first for the app shell: always try to get the latest version first.
    // Only fall back to cache if there's genuinely no connection.
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest) that rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ---- Push notifications ----
// Handles both real Web Push (e.g. from Firebase Cloud Messaging, once a
// server/Cloud Function sends one) and lets the app show notifications
// reliably even if the tab isn't focused.
self.addEventListener("push", (event) => {
  let payload = { title: "Ramon.Log", body: "Você tem uma nova notificação." };
  try{
    if(event.data){
      const json = event.data.json();
      payload = {
        title: (json.notification && json.notification.title) || json.title || payload.title,
        body: (json.notification && json.notification.body) || json.body || payload.body
      };
    }
  }catch(e){
    if(event.data){ payload.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
