const CACHE_NAME = "garage-cache-v96";
const DATA_CACHE = "dynamic-data";

const CORE_ASSETS = [
  "index.html",
  "owned.html",
  "series.html",
  "wanted.html",
  "duplicates.html",
  "admin-cars.html",
  "style.css",
  "utils.js",
  "nav.js",
  "popup.js",
  "script.js?v=20",
  "owned.js",
  "series.js",
  "wanted.js",
  "duplicates.js",
  "admin-cars.js",
  "images/images-coming-soon.png",
  "images/showroom-banner.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
}

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  const path = new URL(url).pathname;

  if (path.endsWith('/data.json')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const networkFetch = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => {
            return cachedResponse || new Response('{"error": "data not available"}', {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
          return cachedResponse || networkFetch;
        });
      })
    );
    return;
  }

  if (url.match(/\.(html|js|css)$/)) {
    event.respondWith(
      Promise.race([
        fetch(event.request).then((response) => {
          if (!response || !response.ok) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        }),
        timeout(10000),
      ]).catch(() => caches.match(event.request))
    );
    return;
  }

  if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return Promise.race([
          fetch(event.request).then((response) => {
            if (!response || !response.ok) return response;
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          }),
          timeout(10000),
        ]).catch(() => caches.match("images/images-coming-soon.png",
  "images/showroom-banner.png"));
      })
    );
    return;
  }

  event.respondWith(
    Promise.race([fetch(event.request), timeout(10000)]).catch(() =>
      caches.match(event.request)
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data.action === "skipWaiting") {
    self.skipWaiting();
    return;
  }

  if (event.data.action === 'manualHardRefreshAll') {
    const allAssets = [...CORE_ASSETS, 'data.json'].map(asset =>
      asset.startsWith('/') ? asset.substring(1) : asset
    );

    const refreshPromises = allAssets.map(assetUrl => {
      const cacheToUse = assetUrl.endsWith('data.json') ? DATA_CACHE : CACHE_NAME;
      return fetch(assetUrl, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error(`Failed ${assetUrl}`);
          return caches.open(cacheToUse).then(cache => cache.put(assetUrl, response.clone()));
        })
        .catch(err => console.error(err));
    });

    event.waitUntil(
      Promise.allSettled(refreshPromises).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ action: 'cacheHardRefreshed' });
        }
      })
    );
  }
});
