'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  getPauseState,
  setPauseState
} from '@/lib/helpers/voucher-pause-state';

/**
 * Story v160-6-4: PauseClaimToggle atom — single-purpose toggle button + state
 * read/write. Visual states: idle (neutral CTA) and paused (yellow chip).
 *
 * Hydration strategy: initial render assumes paused=false (Server cannot read
 * sessionStorage). useEffect post-mount reads actual state and updates;
 * SSR mismatch is acceptable here (paused UX is purely client-side overlay).
 *
 * Privacy: storage value contains ONLY voucher `code` (public URL fragment) —
 * no buyer-side identifiers, no recipient PII (AR45 invariant).
 */

export interface PauseClaimToggleProps {
  code: string;
  onPause?: () => void;
  onResume?: () => void;
  className?: string;
}

export function PauseClaimToggle({
  code,
  onPause,
  onResume,
  className
}: PauseClaimToggleProps) {
  const t = useTranslations('voucher.consent_pause');
  const [paused, setPausedLocal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPausedLocal(getPauseState(code));
    setHydrated(true);
  }, [code]);

  function toggle() {
    if (paused) {
      // Resume path goes through ResumeConfirmationModal (composed at the
      // claim page level). PauseClaimToggle only emits the resume intent;
      // confirmation gates the actual state mutation.
      onResume?.();
      return;
    }
    setPauseState(code, true);
    setPausedLocal(true);
    onPause?.();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-pressed={paused}
      aria-label={t('pause_aria_label')}
      data-testid="voucher-pause-toggle"
      data-paused={paused}
      onClick={toggle}
      className={[
        'inline-flex min-h-12 items-center gap-2 rounded-sm px-4 py-2',
        paused
          ? 'border border-tertiary bg-amber-50 text-amber-900'
          : 'border border-tertiary text-secondary hover:bg-secondary',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true">{paused ? '⏸' : '⏯'}</span>
      <span>
        {!hydrated || !paused ? t('pause_button') : t('paused_badge')}
      </span>
    </button>
  );
}
