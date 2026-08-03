'use client';

/**
 * ListingRetryButton — segment-level retry for ProductListing's load-error state.
 *
 * v1.7.0 Story 2.2 re-review fix (MEDIUM M2'): the previous load-error path
 * relied on DiscoveryEmptyState's default `window.location.reload()` action,
 * which throws away client cache, hydration state and scroll position. This
 * small client wrapper uses Next App Router's `router.refresh()` so the
 * failing segment re-renders without a full reload.
 *
 * Used by:
 *   - ProductListing.tsx (server component) via the `action` slot.
 */
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function ListingRetryButton() {
  const router = useRouter();
  const t = useTranslations('discovery_empty');

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-2 text-sm font-medium text-action-on-primary transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      data-testid="product-listing-retry-button"
    >
      {t('load_error_cta')}
    </button>
  );
}
