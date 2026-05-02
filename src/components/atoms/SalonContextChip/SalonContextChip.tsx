'use client';

/**
 * SalonContextChip — sticky overlay chip preserving salon context on PDP.
 *
 * Story: v160-4-6-salon-pdp-context-preservation (Sprint 3, Epic 4).
 * Spec: ux-design-specification.md UX-DR21 (PDP context preservation);
 * Persona Dorota §2 (browse + compare salons); Persona Marta-self §3 (buy
 * decision flow). Hybrid D Phase B — buyer journey discovery → detail → PDP →
 * cart context-anchored navigation.
 *
 * Use case: when buyer drills from `/[locale]/sellers/{handle}` to a product
 * PDP, the URL gains `?from=seller:{handle}`. The PDP server component parses
 * this param, fetches seller data via `getSellerByHandle()` (Story 4.4 data
 * layer), and renders this chip overlaying the page (fixed top-right) with:
 *   - i18n label "Z salonu: {seller.name}"
 *   - back link to `/[locale]/sellers/{handle}`
 *   - close X button which calls `router.replace(pathname)` to drop the param.
 *
 * Why URL state (not session storage / context provider): SSR-safe, deep-link
 * shareable, refresh-safe, browser-back friendly. See story Dev Notes.
 *
 * Why atom: pure presentation + thin client interactivity (single
 * `useRouter` close handler). No state composition or own selection state →
 * stays under cell threshold per atomic-design taxonomy.
 *
 * Why fixed positioning: chip overlays without affecting PDP content reflow
 * across mobile + desktop. `z-40` sits below modal layer (z-50) but above
 * standard sticky headers — chip remains visible during PDP scroll.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

export interface SalonContextChipSeller {
  /** Buyer-facing display name (already sanitized upstream). */
  name: string;
  /** URL-safe handle (slug-shaped — lowercase + hyphens). */
  handle: string;
}

export interface SalonContextChipProps {
  /** Parsed seller context (null = no `?from=seller:` match → chip renders nothing). */
  seller: SalonContextChipSeller | null;
  /** Locale segment for back-link href construction. */
  locale: string;
  /** Optional className passthrough for layout integration. */
  className?: string;
}

export const SalonContextChip = ({
  seller,
  locale,
  className,
}: SalonContextChipProps) => {
  const t = useTranslations('seller.detail');
  const router = useRouter();
  const pathname = usePathname();

  // Defensive no-op render when no context — story AC1.
  if (!seller) {
    return null;
  }

  const handleClose = () => {
    // Strip query params without page reload — preserves scroll position.
    // pathname here is locale-aware (e.g. `/pl/products/foo`), so replacing to
    // pathname alone drops `?from=seller:...` cleanly.
    router.replace(pathname);
  };

  const backHref = `/${locale}/sellers/${seller.handle}`;
  const labelText = t('context_chip_label', { name: seller.name });
  const backLabel = t('context_chip_back');
  const closeLabel = t('context_chip_close');

  return (
    <aside
      role="complementary"
      aria-label={labelText}
      data-testid="salon-context-chip"
      className={cn(
        // Fixed overlay positioning — top-right; z-40 sits above sticky headers
        // (z-30) but below modals (z-50). Mobile: same offsets, max-w-[280px]
        // truncate ensures graceful narrow viewport rendering.
        'fixed top-4 right-4 z-40 flex max-w-[320px] items-center gap-2 rounded-full border border-[rgba(144,112,50,0.16)] bg-white/95 px-4 py-2 shadow-[0_12px_32px_rgba(90,67,28,0.12)] backdrop-blur',
        className,
      )}
    >
      <Link
        href={backHref}
        data-testid="salon-context-chip-back"
        aria-label={backLabel}
        title={backLabel}
        className="flex min-w-0 items-center gap-2 text-sm text-primary transition-opacity hover:opacity-70"
      >
        {/* Back arrow icon (inline SVG — no asset dependency) */}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0"
        >
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="truncate font-medium">{labelText}</span>
      </Link>
      <button
        type="button"
        onClick={handleClose}
        aria-label={closeLabel}
        title={closeLabel}
        data-testid="salon-context-chip-close"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-[rgba(144,112,50,0.1)] hover:text-primary focus:outline-none focus:ring-2 focus:ring-[var(--gold,#c9a961)] focus:ring-offset-1"
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </aside>
  );
};
