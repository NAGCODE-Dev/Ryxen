/**
 * Service Worker
 * Versão: 3.3.0
 */

const CACHE_NAME = 'crossapp-v3-3';
const CORE_ASSETS = [
  './',
  './index.html',
  './sports/cross/index.html',
  './sports/running/index.html',
  './sports/strength/index.html',
  './manifest.json',
  './privacy.html',
  './terms.html',
  './support.html',
  './src/hub/main.js',
  './src/hub/styles.css',
  './sports/running/main.js',
  './sports/strength/main.js',
  './src/main.js',
  './src/core/services/apiClient.js',
  './src/core/services/authService.js',
  './src/core/services/subscriptionService.js',
  './src/core/services/syncService.js',
  './src/core/services/telemetryService.js',
  './src/core/usecases/backupData.js',
  './src/adapters/media/ocrReader.js',
  './src/adapters/media/videoTextReader.js',
  './src/libs/pdf.mjs',
  './src/libs/pdf.worker.mjs',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const responsePromise = resolveFetchResponse(event.request);
  if (responsePromise) {
    event.respondWith(responsePromise);
  }
});

function resolveNavigationFallback(pathname = '/') {
  if (pathname.startsWith('/sports/running')) return './sports/running/index.html';
  if (pathname.startsWith('/sports/strength')) return './sports/strength/index.html';
  if (pathname.startsWith('/sports/cross')) return './sports/cross/index.html';
  return './index.html';
}

function resolveFetchResponse(request) {
  const url = new URL(request.url);

  if (!isCacheableRequest(request, url)) return null;

  if (isApiRequest(url)) {
    return networkOnly(request);
  }

  if (request.mode === 'navigate') {
    return networkFirst(request, resolveNavigationFallback(url.pathname));
  }

  if (isScriptLikeAsset(request)) {
    return networkFirst(request);
  }

  if (isStaticAsset(request)) {
    return staleWhileRevalidate(request);
  }

  return networkFirst(request);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isCacheableRequest(request, url) {
  return request.method === 'GET' && url.origin === self.location.origin;
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});

function isStaticAsset(request) {
  const destination = request.destination;
  return (
    destination === 'style'
    || destination === 'image'
    || destination === 'font'
    || destination === 'worker'
  );
}

function isScriptLikeAsset(request) {
  const destination = request.destination;
  const pathname = new URL(request.url).pathname;
  return (
    destination === 'script'
    || pathname.endsWith('.js')
    || pathname.endsWith('.mjs')
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise || offlineResponse();
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }

    const cached = await cache.match(request);
    return cached || offlineResponse();
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineResponse('Sem conexão com a API.');
  }
}

function isCacheable(response) {
  return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
}

function offlineResponse(message = 'Offline - conteúdo indisponível.') {
  return new Response(message, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
