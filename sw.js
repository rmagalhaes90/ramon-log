/* KYRO service worker — security build v13–21 */
const CACHE_VERSION = "kyro-shell-2026-08-01-v13-21-photo-fix";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(SHELL_ASSETS);
    } catch (_) {
      // Continue activation even if an optional shell asset cannot be pre-cached.
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          (key.startsWith("kyro-shell-") || key.startsWith("ramon-log-")) &&
          key !== CACHE_VERSION
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();

    // Force open KYRO windows to load the corrected index.html once this release activates.
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    await Promise.all(
      windows.map(client => {
        if ("navigate" in client) {
          return client.navigate(client.url).catch(() => undefined);
        }

        return undefined;
      })
    );
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isCacheableResponse(response) {
  return response && response.ok && response.type !== "opaque";
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request, { cache: "no-store" });

    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (_) {
    return (
      (await cache.match(request)) ||
      (await cache.match("./index.html")) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const update = fetch(request, { cache: "no-store" })
    .then(async response => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cached || update || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never intercept Firebase, authentication, Open Food Facts, or other origins.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.headers.has("authorization")) {
    return;
  }

  const isNavigation =
    request.mode === "navigate" ||
    request.destination === "document";

  if (isNavigation) {
    event.respondWith(networkFirst(request));
    return;
  }

  const allowedStatic = new Set([
    "script",
    "style",
    "image",
    "font",
    "manifest"
  ]);

  if (allowedStatic.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function cleanNotificationText(value, fallback, maxLength) {
  const text =
    typeof value === "string"
      ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim()
      : "";

  return (text || fallback).slice(0, maxLength);
}

self.addEventListener("push", event => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {}

  const notification = payload.notification || {};

  const title = cleanNotificationText(
    notification.title || payload.title,
    "KYRO",
    80
  );

  const body = cleanNotificationText(
    notification.body || payload.body,
    "Você tem uma nova notificação.",
    240
  );

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "kyro-notification",
      renotify: false,
      data: { url: "./" }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of clientsList) {
      if ("focus" in client) {
        await client.focus();

        if ("navigate" in client) {
          await client.navigate("./");
        }

        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow("./");
    }
  })());
});
