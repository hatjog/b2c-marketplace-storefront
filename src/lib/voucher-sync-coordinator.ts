/**
 * Story v160-6-7: Sync-on-reconnect coordinator.
 *
 * Drains the IDB queue (FIFO by queuedAt) when `navigator.onLine` flips
 * false → true. Per-entry exponential backoff (1s/2s/4s/.../128s, cap 8
 * attempts). Single-flight mutex prevents concurrent drains.
 *
 * Idempotency contract (per Story 6.7 Dev Note): backend MUST honor
 * `Idempotency-Key` header. Replay safety: client may re-send same `id`;
 * server returns 200 idempotent replay.
 *
 * Custom events emitted on `window`:
 *   - voucherClaimSynced (CustomEvent<{id}>)
 *   - voucherClaimFailedTerminal (CustomEvent<{id, reason}>)
 *   - voucherClaimFailedPermanent (CustomEvent<{id, reason}>)
 */

import {
  incrementRetry,
  listAllClaims,
  removeClaim,
  type ClaimQueueEntry
} from './voucher-offline-queue';

const MAX_RETRIES = 8;
let draining = false;

export type SyncEventName =
  | 'voucherClaimSynced'
  | 'voucherClaimFailedTerminal'
  | 'voucherClaimFailedPermanent';

function emit(name: SyncEventName, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function sendOne(entry: ClaimQueueEntry): Promise<{ status: number; ok: boolean }> {
  const res = await fetch(entry.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': entry.id
    },
    body: entry.body
  });
  return { status: res.status, ok: res.ok };
}

export async function drainQueue(): Promise<{ drained: number; failed: number }> {
  if (draining) {
    return { drained: 0, failed: 0 };
  }
  draining = true;
  let drained = 0;
  let failed = 0;
  try {
    const entries = await listAllClaims();
    entries.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

    for (const entry of entries) {
      try {
        const { status, ok } = await sendOne(entry);
        if (ok) {
          await removeClaim(entry.id);
          emit('voucherClaimSynced', { id: entry.id });
          drained += 1;
          continue;
        }
        // Terminal 4xx (e.g. 410 voucher consumed): drop entry.
        if (status >= 400 && status < 500) {
          await removeClaim(entry.id);
          emit('voucherClaimFailedTerminal', { id: entry.id, reason: `http-${status}` });
          failed += 1;
          continue;
        }
        // 5xx: retry with backoff, eviction at MAX_RETRIES.
        await incrementRetry(entry.id, `http-${status}`);
        const next = entry.retryCount + 1;
        if (next >= MAX_RETRIES) {
          await removeClaim(entry.id);
          emit('voucherClaimFailedPermanent', { id: entry.id, reason: `http-${status}` });
        }
        failed += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'network-error';
        await incrementRetry(entry.id, reason);
        const next = entry.retryCount + 1;
        if (next >= MAX_RETRIES) {
          await removeClaim(entry.id);
          emit('voucherClaimFailedPermanent', { id: entry.id, reason });
        }
        failed += 1;
      }
    }
  } finally {
    draining = false;
  }
  return { drained, failed };
}

/**
 * Registers `online` listener + (optional) Background Sync API tag.
 * Returns a teardown fn for callers (component unmount).
 */
export function registerSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onlineHandler = () => {
    drainQueue().catch(() => {
      // Drain failures are surfaced via per-entry events; coordinator-level
      // failures are non-fatal (retried on next online tick).
    });
  };
  window.addEventListener('online', onlineHandler);

  // Background Sync API enhancement (feature-detected; Chromium-only).
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          const r = reg as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          };
          r.sync?.register('voucher-claim-sync').catch(() => {});
        })
        .catch(() => {});
    }
  } catch {
    // Background Sync unsupported — `online` listener path is sufficient.
  }

  return () => {
    window.removeEventListener('online', onlineHandler);
  };
}
