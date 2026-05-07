'use client';

/**
 * SoleVendorBadge — sole-vendor explicit branch for PDP (Story cleanup-12c, AC3).
 *
 * Story: v160-cleanup-12c — PDP SellerSelector data wire-up
 * Spec: Epic-5 completeness audit F4 — silent length===1 fall-through closed.
 *
 * Rendered when `vendor_offers.length === 1 && isMultiVendorEnabled()`.
 * Communicates to the buyer that there is exactly one seller for this
 * product (i.e. not a selector, not a circuit-broken fallback, not
 * "salon przygotowuje ofertę" — just a single confirmed seller).
 *
 * Boundaries:
 *  - NIE renders radio-group (1-option selector is UX antipattern per F4).
 *  - NIE owns geolocation (distance irrelevant for sole seller).
 *  - NIE wires cart (parent ProductDetails / SellerSelectorCartBridge path).
 */

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { VendorOfferOption } from '@/types/product';

export interface SoleVendorBadgeProps {
  offer: VendorOfferOption;
  className?: string;
}

export const SoleVendorBadge = ({ offer, className }: SoleVendorBadgeProps) => {
  const t = useTranslations('seller.selector');
  return (
    <div
      data-testid="sole-vendor-badge"
      className={cn(
        'flex items-center gap-3 rounded-md border border-tertiary bg-component-secondary p-4',
        className,
      )}
    >
      <span
        className="text-xs font-medium uppercase tracking-wide text-action"
        data-testid="sole-vendor-badge-label"
      >
        {t('sole_vendor_label')}
      </span>
      <span
        className="label-md flex-1 text-primary"
        data-testid="sole-vendor-badge-name"
      >
        {offer.seller_name}
      </span>
      <span className="label-md text-primary">
        <span className="text-xs text-secondary">{t('price_from')} </span>
        {offer.price_pln} zł
      </span>
    </div>
  );
};
