/* KYRO service worker — fast startup build */
const CACHE_VERSION = "kyro-shell-2026-08-01-v13-21-startup-fix-2";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    // Cache each asset independently. One missing optional asset must not prevent
    // index.html from being available for an instant PWA launch.
    await Promise.allSettled(
      SHELL_ASSETS.map(asset =>
        cache.add(new Request(asset, { cache: "reload" }))
      )
    );

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

    if ("navigationPreload" in self.registration) {
      try {
        await self.registration.navigationPreload.enable();
      } catch (_) {}
    }

    await self.clients.claim();

    // Reload open KYRO windows once so this startup fix becomes active immediately.
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

async function updateNavigationCache(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request, { cache: "no-store" });

    if (isCacheableResponse(response)) {
      // Store both the exact navigation URL and the canonical app shell.
      await Promise.all([
        cache.put(request, response.clone()),
        cache.put("./index.html", response.clone())
      ]);
    }

    return response;
  } catch (_) {
    return null;
  }
}

async function fastNavigation(request, preloadResponsePromise) {
  const cache = await caches.open(CACHE_VERSION);

  const cached =
    (await cache.match(request, { ignoreSearch: true })) ||
    (await cache.match("./index.html", { ignoreSearch: true })) ||
    (await cache.match("./", { ignoreSearch: true }));

  // Start refreshing immediately, but do not block the first paint when a shell
  // is already cached.
  const refreshPromise = (async () => {
    try {
      const preload = await preloadResponsePromise;

      if (isCacheableResponse(preload)) {
        await Promise.all([
          cache.put(request, preload.clone()),
          cache.put("./index.html", preload.clone())
        ]);
        return preload;
      }
    } catch (_) {}

    return updateNavigationCache(request);
  })();

  if (cached) {
    // Keep the worker alive long enough to refresh the cache in the background.
    return { response: cached, refreshPromise };
  }

  const networkResponse = await refreshPromise;

  return {
    response: networkResponse || Response.error(),
    refreshPromise: Promise.resolve()
  };
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });

  const update = fetch(request, { cache: "no-store" })
    .then(async response => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return {
    response: cached || (await update) || Response.error(),
    update
  };
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
    const task = fastNavigation(request, event.preloadResponse);

    event.respondWith(task.then(result => result.response));
    event.waitUntil(task.then(result => result.refreshPromise).catch(() => undefined));
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
    const task = staleWhileRevalidate(request);

    event.respondWith(task.then(result => result.response));
    event.waitUntil(task.then(result => result.update).catch(() => undefined));
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
