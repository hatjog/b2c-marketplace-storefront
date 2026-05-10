'use client';

/**
 * Categories route error boundary — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Uses DiscoveryEmptyState variant="load-error" (StateCard error variant)
 *     instead of raw hardcoded text + unstyled button.
 *   - Route-level error boundary — Next.js passes `reset` to retry.
 *   - Accessible: StateCard error variant uses role="alert" aria-live="assertive".
 *   - i18n: uses discovery_empty keys (load-error variant).
 *
 * Removed: hardcoded Polish strings, hardcoded black button with inline className.
 * The raw `error.message` / stack trace is never surfaced per UX-DR18.
 */
import { useEffect } from 'react';

import { useTranslations } from 'next-intl';

import { StateCard } from '@/components/molecules/StateCard/StateCard';

export default function CategoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log internally — never surface raw error.message to UI per UX-DR18.
    // v1.7.0 Story 2.2 review fix (INFO I1): include the full error object
    // so an on-call engineer can correlate a customer report with browser
    // console logs (digest leads for grep-ability, error follows).
    console.error('[categories/error.tsx]', error.digest ?? 'unknown', error);
  }, [error]);

  return (
    <main id="main-content" className="container py-24">
      <LoadErrorState reset={reset} />
    </main>
  );
}

/**
 * Client component that uses translations for the error state.
 * Separated from the error boundary so it can use hooks safely.
 */
function LoadErrorState({ reset }: { reset: () => void }) {
  const t = useTranslations('discovery_empty');

  return (
    <StateCard
      variant="error"
      title={t('load_error_headline')}
      titleAs="h1"
      description={t('load_error_body')}
      action={
        <button
          type="button"
          onClick={reset}
          aria-label={t('error_reset_aria')}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-2 text-sm font-medium text-action-on-primary transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          data-testid="categories-error-retry"
        >
          {t('load_error_cta')}
        </button>
      }
      data-testid="categories-error-state"
    />
  );
}
