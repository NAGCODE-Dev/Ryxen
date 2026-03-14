/**
 * Service Worker
 * Versão: 3.1.0
 */

const CACHE_NAME = 'crossapp-v3-1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './privacy.html',
  './terms.html',
  './support.html',
  './src/main.js',
  './src/app.js',
  './src/config/runtime.js',
  './src/ui/ui.js',
  './src/ui/render.js',
  './src/ui/actions.js',
  './src/ui/events.js',
  './src/ui/consent.js',
  './src/ui/styles.css',
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
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Navegação: network-first com fallback para shell
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  // Arquivos estáticos: stale-while-revalidate
  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // API/JSON/outros: network-first com fallback cache
  event.respondWith(networkFirst(request));
});

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
    destination === 'script'
    || destination === 'style'
    || destination === 'image'
    || destination === 'font'
    || destination === 'worker'
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
