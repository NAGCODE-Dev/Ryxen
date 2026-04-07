/**
 * Service Worker
 * Versão: 3.5.1
 */

// Cache version bumped to flush stale JS modules from previously installed PWAs.
const CACHE_NAME = 'ryxen-v4-1';
const CORE_ASSETS = [
  './',
  './index.html',
  './coach/index.html',
  './sports/cross/index.html',
  './sports/running/index.html',
  './sports/strength/index.html',
  './manifest.json',
  './config.js',
  './apps/hub/main.js',
  './apps/athlete/main.js',
  './apps/running/main.js',
  './apps/strength/main.js',
  './privacy.html',
  './terms.html',
  './support.html',
  './packages/shared-web/runtime.js',
  './packages/shared-web/auth.js',
  './packages/shared-web/api-client.js',
  './src/hub/main.js',
  './src/hub/styles.css',
  './sports/running/main.js',
  './sports/strength/main.js',
  './src/main.js',
  './src/core/services/apiClient.js',
  './src/core/services/authService.js',
  './src/core/services/subscriptionService.js',
  './src/core/services/telemetryService.js',
  './src/core/usecases/backupData.js',
  './src/adapters/media/ocrReader.js',
  './src/adapters/media/videoTextReader.js',
  './src/libs/pdf.mjs',
  './src/libs/pdf.worker.mjs',
  './branding/exports/ryxen-icon-32.png',
  './branding/exports/ryxen-icon-180.png',
  './branding/exports/ryxen-icon-192.png',
  './branding/exports/ryxen-icon-512.png',
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
    if (self.registration?.navigationPreload?.enable) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const responsePromise = resolveFetchResponse(event.request, event);
  if (responsePromise) {
    event.respondWith(responsePromise);
  }
});

function resolveNavigationFallback(pathname = '/') {
  if (pathname.startsWith('/coach')) return './coach/index.html';
  if (pathname.startsWith('/sports/running')) return './sports/running/index.html';
  if (pathname.startsWith('/sports/strength')) return './sports/strength/index.html';
  if (pathname.startsWith('/sports/cross')) return './sports/cross/index.html';
  return './index.html';
}

function resolveFetchResponse(request, event) {
  const url = new URL(request.url);

  if (!isCacheableRequest(request, url)) return null;

  if (isApiRequest(url)) {
    return networkOnly(request);
  }

  if (request.mode === 'navigate') {
    return networkFirst(request, {
      fallbackUrl: resolveNavigationFallback(url.pathname),
      preloadResponsePromise: event?.preloadResponse,
      prefersHtml: true,
    });
  }

  if (isScriptLikeAsset(request)) {
    return staleWhileRevalidate(request);
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

  return cached || networkPromise || offlineResponse({ request });
}

async function networkFirst(request, options = {}) {
  const { fallbackUrl = '', preloadResponsePromise = null, prefersHtml = false } = options;
  const cache = await caches.open(CACHE_NAME);
  try {
    if (preloadResponsePromise) {
      const preloadResponse = await preloadResponsePromise;
      if (isCacheable(preloadResponse)) {
        cache.put(request, preloadResponse.clone());
        return preloadResponse;
      }
    }
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
    return cached || offlineResponse({ request, prefersHtml });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineResponse({ request, message: 'Sem conexão com a API.' });
  }
}

function isCacheable(response) {
  return response && response.status === 200 && (response.type === 'basic' || response.type === 'cors');
}

function offlineResponse({ request = null, message = 'Offline - conteúdo indisponível.', prefersHtml = false } = {}) {
  const accept = String(request?.headers?.get?.('accept') || '').toLowerCase();
  const wantsJson = accept.includes('application/json');
  const wantsHtml = prefersHtml || accept.includes('text/html');

  if (wantsJson) {
    return new Response(JSON.stringify({ error: message, offline: true }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (wantsHtml) {
    return new Response(
      `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ryxen Offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#071427;color:#f8fafc;font-family:system-ui,sans-serif}main{max-width:440px;background:rgba(7,20,39,.88);border:1px solid rgba(148,163,184,.16);border-radius:24px;padding:28px;box-shadow:0 24px 80px rgba(2,6,23,.35)}h1{margin:0 0 12px;font-size:1.9rem}p{margin:0 0 14px;line-height:1.6;color:#cbd5e1}</style></head><body><main><h1>Sem conexão</h1><p>${escapeHtml(message)}</p><p>Abra novamente quando a internet voltar. O app continua disponível com o conteúdo já salvo em cache.</p></main></body></html>`,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  return new Response(message, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
