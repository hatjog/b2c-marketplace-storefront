/* eslint-disable */
/**
 * Story v160-6-7: Voucher claim service worker (handcrafted).
 *
 * Scope: /voucher/* (NIE cały storefront — explicit narrow scope).
 *
 * Cache buckets (per AC1):
 *   (a) page shell (HTML+CSS+JS for /voucher/*) — stale-while-revalidate
 *   (b) claim API GET (/api/voucher/[code]) — network-first, fallback-cache
 *   (c) claim API POST (/api/voucher/[code]/claim) — network-only with
 *       fallback to IndexedDB queue (synthetic 202 returned to client)
 *
 * Cache name versioning: bump on breaking change; `activate` cleans up
 * obsolete caches.
 */

const CACHE_VERSION = 'gp-voucher-v1';
const CACHE_PAGE_SHELL = `${CACHE_VERSION}-page-shell`;
const CACHE_CLAIM_GET = `${CACHE_VERSION}-claim-get`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (!k.startsWith(CACHE_VERSION)) {
            return caches.delete(k);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Bucket (c): claim POST — network-only with IDB queue fallback.
  if (req.method === 'POST' && /\/voucher\/[^/]+\/claim/.test(url.pathname)) {
    event.respondWith(handleClaimPost(req));
    return;
  }

  // Bucket (b): claim GET (read voucher payload) — network-first.
  if (req.method === 'GET' && /\/voucher\/[^/]+/.test(url.pathname) && url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(req, CACHE_CLAIM_GET));
    return;
  }

  // Bucket (a): page shell for /voucher/* — stale-while-revalidate.
  if (req.method === 'GET' && url.pathname.match(/\/voucher\//)) {
    event.respondWith(staleWhileRevalidate(req, CACHE_PAGE_SHELL));
    return;
  }
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response('Offline', { status: 503 });
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleClaimPost(req) {
  // Try the network first (online path — pass through unchanged).
  try {
    const res = await fetch(req.clone());
    return res;
  } catch {
    // Network unavailable — enqueue request for sync-on-reconnect.
    const body = await req.clone().text();
    const url = req.url;
    const queuedAt = new Date().toISOString();

    // Sub-bundle 6b (cleanup-6 CRIT-6.2): fail closed — NEVER fall back to
    // Math.random for idempotency keys. Math.random is not cryptographically
    // random and enables replay attacks across tabs/devices/sessions.
    // If crypto.randomUUID is unavailable (non-secure context), do NOT enqueue
    // and return a 503 so the client retries when connectivity is restored.
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      return new Response(
        JSON.stringify({
          error: 'crypto_unavailable',
          message: 'Cannot generate idempotency key — crypto.randomUUID not available. Request not queued.'
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    const id = crypto.randomUUID();

    await enqueueClaim({ id, url, body, queuedAt, retryCount: 0 });

    return new Response(
      JSON.stringify({ queued: true, queuedAt, id }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Minimal IndexedDB wrapper inside the SW (avoids bundling `idb` in SW).
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('gp-voucher-offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('voucher-claim-queue')) {
        db.createObjectStore('voucher-claim-queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueClaim(entry) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('voucher-claim-queue', 'readwrite');
    tx.objectStore('voucher-claim-queue').put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
