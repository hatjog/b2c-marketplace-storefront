'use client';

/**
 * Story v160-6-7: Offline-tolerant claim flow UI banner.
 *
 * Renders persistent banner at top of /voucher/[code] when navigator is
 * offline OR when the IDB queue is non-empty. Respects
 * `prefers-reduced-motion` (no slide-in animation).
 *
 * Copy is vendor-neutral (Ania persona privacy boundary — recipient does
 * not see multi-vendor framing).
 */

import { useTranslations } from 'next-intl';

import { useVoucherOfflineState } from '@/hooks/useVoucherOfflineState';
import { useEffect, useRef } from 'react';
import { registerVoucherServiceWorker } from '@/lib/voucher-sw-register';

export function OfflineBanner() {
  const state = useVoucherOfflineState();
  const t = useTranslations('voucher.claim.offline');
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    void registerVoucherServiceWorker();
  }, []);

  if (state === 'online') {
    return null;
  }

  let role: 'status' | 'alert' = 'status';
  let copy: string;
  let testid: string;

  switch (state) {
    case 'offline':
      copy = t('banner_no_connection');
      testid = 'voucher-offline-banner';
      break;
    case 'queued':
      copy = t('toast_queued');
      testid = 'voucher-queued-banner';
      break;
    case 'syncing':
      copy = t('toast_syncing');
      testid = 'voucher-syncing-banner';
      break;
    case 'synced':
      copy = t('toast_synced');
      testid = 'voucher-synced-banner';
      break;
    case 'failed-terminal':
      copy = t('toast_failed_terminal');
      role = 'alert';
      testid = 'voucher-failed-terminal-banner';
      break;
    case 'failed-permanent':
      copy = t('toast_failed_permanent');
      role = 'alert';
      testid = 'voucher-failed-permanent-banner';
      break;
    default:
      return null;
  }

  return (
    <div
      role={role}
      data-testid={testid}
      data-state={state}
      className="motion-safe:transition-opacity sticky top-0 z-50 w-full border-b border-tertiary bg-tertiary-subtle px-4 py-2 text-sm text-primary"
    >
      {copy}
    </div>
  );
}
