'use client';

/**
 * Story v160-6-7: Offline state machine hook for voucher claim flow.
 *
 * Derives UI state from `navigator.onLine` + queue depth + sync events.
 * Returns one of: 'online' | 'offline' | 'queued' | 'syncing' | 'synced' |
 * 'failed-terminal' | 'failed-permanent'.
 */

import { useEffect, useState } from 'react';

import { listAllClaims } from '@/lib/voucher-offline-queue';
import { registerSyncListeners } from '@/lib/voucher-sync-coordinator';

export type VoucherOfflineState =
  | 'online'
  | 'offline'
  | 'queued'
  | 'syncing'
  | 'synced'
  | 'failed-terminal'
  | 'failed-permanent';

export function useVoucherOfflineState(): VoucherOfflineState {
  const [state, setState] = useState<VoucherOfflineState>('online');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const refresh = async () => {
      const isOnline = navigator.onLine;
      try {
        const queue = await listAllClaims();
        if (cancelled) return;
        if (queue.length > 0) {
          setState(isOnline ? 'syncing' : 'queued');
        } else {
          setState(isOnline ? 'online' : 'offline');
        }
      } catch {
        if (!cancelled) setState(isOnline ? 'online' : 'offline');
      }
    };

    void refresh();

    const onlineHandler = () => void refresh();
    const offlineHandler = () => setState('offline');
    const syncedHandler = () => {
      setState('synced');
      void refresh();
    };
    const failedTerminalHandler = () => setState('failed-terminal');
    const failedPermanentHandler = () => setState('failed-permanent');

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    window.addEventListener('voucherClaimSynced', syncedHandler);
    window.addEventListener('voucherClaimFailedTerminal', failedTerminalHandler);
    window.addEventListener('voucherClaimFailedPermanent', failedPermanentHandler);

    const teardown = registerSyncListeners();

    return () => {
      cancelled = true;
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      window.removeEventListener('voucherClaimSynced', syncedHandler);
      window.removeEventListener('voucherClaimFailedTerminal', failedTerminalHandler);
      window.removeEventListener('voucherClaimFailedPermanent', failedPermanentHandler);
      teardown();
    };
  }, []);

  return state;
}
