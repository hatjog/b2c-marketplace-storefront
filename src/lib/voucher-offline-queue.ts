/**
 * Story v160-6-7: IndexedDB queue wrapper for voucher claim attempts.
 *
 * Client-side queue that mirrors the SW's `gp-voucher-offline` database
 * `voucher-claim-queue` store. Used by the sync coordinator to drain
 * pending claims on `online` event.
 *
 * Schema versioning: v1 (single store, keyPath `id`). Future versions
 * extend via `onupgradeneeded` migration ladder.
 *
 * Privacy posture (AR45 + Ania persona §3): payloads MUST NOT contain
 * recipient PII beyond what the backend claim contract requires. TTL
 * cleanup at 24h enforces GDPR-aware retention.
 */

const DB_NAME = 'gp-voucher-offline';
const DB_VERSION = 1;
const STORE = 'voucher-claim-queue';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface ClaimQueueEntry {
  id: string;
  url: string;
  body: string;
  queuedAt: string;
  retryCount: number;
  lastError?: string;
}

function isClient(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isClient()) {
      reject(new Error('indexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueClaim(entry: ClaimQueueEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listAllClaims(): Promise<ClaimQueueEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as ClaimQueueEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeClaim(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementRetry(id: string, error: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result as ClaimQueueEntry | undefined;
      if (!entry) {
        resolve();
        return;
      }
      entry.retryCount = (entry.retryCount ?? 0) + 1;
      entry.lastError = error;
      store.put(entry);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * TTL cleanup — entries older than 24h are dropped (GDPR-aware retention
 * + force-fail prompts manual recovery flow).
 */
export async function cleanupExpired(): Promise<number> {
  const all = await listAllClaims();
  const now = Date.now();
  let removed = 0;
  for (const entry of all) {
    const queuedMs = Date.parse(entry.queuedAt);
    if (Number.isFinite(queuedMs) && now - queuedMs > TTL_MS) {
      await removeClaim(entry.id);
      removed += 1;
    }
  }
  return removed;
}
