'use client';

/**
 * NoActiveVendorsFallback — empty-state card rendered when a product has
 * NO active vendor offers (Story 5.6).
 *
 * Story: v160-5-6-pdp-no-active-vendors-fallback (Sprint 3, Epic 5)
 * Spec: PRD FR1-FR5 + AR45 (NIE blocks render) + AR49 (empty-state coverage)
 *       + UX-DR19 / UX-DR45 / UX-DR49 + persona Marta-self
 *
 * Orthogonal to Story 5.4 SellerSelectorFallback:
 *  - 5.4 = error path (circuit breaker open / boundary caught render error);
 *    copy "Multi-vendor unavailable; using default seller" suggests the
 *    default seller IS used; backend hiccup.
 *  - 5.6 = empty path (query SUCCESS, array length 0); copy
 *    "Salon przygotowuje ofertę" signals lifecycle state vendor onboarding-
 *    in-progress; no offers available.
 *
 * Boundaries:
 *  - NIE renders radio list / variant picker (no offers to pick).
 *  - NIE owns retry CTA (orthogonal axis — empty NIE error).
 *  - "Notify me" CTA is a disabled placeholder in v1.6.0 (Phase B+ feature
 *    territory: email subscription pipeline + product-availability webhook).
 *  - Per PAT-17: filename + identifier opisują BACKEND state ("no active
 *    vendors"); UI copy uses "salon" / "sprzedawca" / "seller" buyer-facing.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface NoActiveVendorsFallbackProps {
  /**
   * Optional href for the "Back to list" CTA. Defaults to `/categories`
   * which Next.js middleware locale-rewrites at runtime. Caller can pass
   * a locale-prefixed href (e.g. `/${locale}/categories`) when LocalizedLink
   * helper is available in the parent surface.
   */
  backHref?: string;
  className?: string;
}

export const NoActiveVendorsFallback = ({
  backHref = '/categories',
  className,
}: NoActiveVendorsFallbackProps) => {
  const t = useTranslations('seller.selector');
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="no-active-vendors-fallback"
      className={`bg-component-secondary border border-tertiary p-6 rounded-md ${
        className ?? ''
      }`}
    >
      <h3 className="text-base font-medium mb-2">
        {t('no_active_vendors_title')}
      </h3>
      <p className="text-secondary text-sm mb-4">
        {t('no_active_vendors_message')}
      </p>
      <div className="flex flex-row gap-2">
        <Link
          href={backHref}
          data-testid="no-active-vendors-back-cta"
          className="px-4 py-2 border border-primary rounded-md text-sm hover:bg-component-tertiary"
        >
          {t('back_to_list_cta')}
        </Link>
        <button
          type="button"
          disabled
          data-testid="no-active-vendors-notify-cta"
          className="px-4 py-2 border border-tertiary rounded-md text-sm cursor-not-allowed opacity-60"
          aria-disabled="true"
          title="Coming soon"
        >
          {t('notify_me_cta')}
        </button>
      </div>
    </div>
  );
};
