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
 *
 * ePrivacy gate (v160-cleanup-34 / TF-80):
 *   enqueueClaim() gated on requireCategory("preferences") — offline queue
 *   is a UX continuity feature, not strictly necessary.
 *   Fallback on false: caller falls back to online-only path (graceful degradation).
 *   Revocation: clearIdbPreferencesDb() called by clearPreferencesStorage().
 */

import { requireCategory } from '@/lib/consent';

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

/**
 * Sentinel error: thrown / used to signal that the offline queue is unavailable
 * because preferences consent has not been granted (F3 — ePrivacy TF-80).
 * Public functions catch this and return graceful defaults.
 */
const NO_CONSENT = Symbol('no-consent');

function openDb(): Promise<IDBDatabase | typeof NO_CONSENT> {
  return new Promise((resolve, reject) => {
    if (!isClient()) {
      reject(new Error('indexedDB not available'));
      return;
    }
    // F3: centralised ePrivacy gate. Every public function that opens the DB
    // routes through here; without preferences consent, return the sentinel
    // and let callers degrade gracefully (no DB is opened — `open` would
    // recreate a deleted DB, breaking the revoke contract).
    if (!requireCategory('preferences')) {
      resolve(NO_CONSENT);
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

/**
 * Enqueue a voucher claim for offline replay.
 * Returns false (no-op) when preferences consent is absent — caller should
 * fall back to online-only path instead (AC5 graceful degradation).
 */
export async function enqueueClaim(entry: ClaimQueueEntry): Promise<boolean> {
  const db = await openDb();
  if (db === NO_CONSENT) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CMP] enqueueClaim: preferences consent absent — offline queue skipped.');
    }
    return false;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return true;
}

export async function listAllClaims(): Promise<ClaimQueueEntry[]> {
  const db = await openDb();
  if (db === NO_CONSENT) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as ClaimQueueEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeClaim(id: string): Promise<void> {
  const db = await openDb();
  if (db === NO_CONSENT) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementRetry(id: string, error: string): Promise<void> {
  const db = await openDb();
  if (db === NO_CONSENT) return;
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
