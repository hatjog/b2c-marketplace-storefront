'use client';

import { useCallback, type ReactElement } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  PurchaseModeToggle,
  type PurchaseMode
} from '@/components/molecules/PurchaseModeToggle';

/**
 * Story 5.8 — CheckoutPurchaseMode wire-up section.
 *
 * Owns URL state for `?mode=self|gift` and renders the
 * PurchaseModeToggle molecule + gift placeholder card (Epic 6 handoff).
 *
 * AC mappings:
 *   AC4 — URL param `?mode=self|gift` via useSearchParams + router.replace.
 *         Default `self` when param absent or invalid.
 *   AC5 — Wire-up in checkout page pre-payment step (rendered between
 *         CartShippingMethodsSection and CartPaymentSection by
 *         (checkout)/checkout/page.tsx).
 *   AC3 — Gift mode renders dashed-border placeholder card with copy
 *         from `seller.checkout.recipient_placeholder` i18n key
 *         (Epic 6 territory; static "coming soon" hint, NOT a form).
 *
 * Implementation notes:
 *   - Component is client-only (URL state hook).
 *   - URL param strategy: when mode === 'self' (default) we strip the
 *     `?mode` param so canonical URL stays clean; gift adds `mode=gift`.
 *   - Existing checkout flow uses `?step=address|payment|review` —
 *     `?mode` namespace is verified clean (no collision).
 */

export function normalizePurchaseMode(
  rawMode: string | null | undefined
): PurchaseMode {
  const normalizedMode = rawMode?.trim().toLowerCase();
  return normalizedMode === 'gift' ? 'gift' : 'self';
}

export function CheckoutPurchaseMode(): ReactElement {
  const t = useTranslations('seller.checkout');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawMode = searchParams.get('mode');
  const mode = normalizePurchaseMode(rawMode);

  const handleChange = useCallback(
    (newMode: PurchaseMode): void => {
      const params = new URLSearchParams(searchParams.toString());
      if (newMode === 'self') {
        // Default mode → keep URL clean (no orphan param on shareable links).
        params.delete('mode');
      } else {
        params.set('mode', newMode);
      }
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <section
      data-testid="checkout-purchase-mode-section"
      className="flex flex-col gap-4 rounded-md border border-component-secondary p-4"
    >
      <PurchaseModeToggle
        mode={mode}
        onChange={handleChange}
      />
      {mode === 'gift' && (
        <div
          data-testid="checkout-recipient-placeholder"
          className="rounded-md border border-dashed border-component-secondary p-4 text-sm text-tertiary"
          role="note"
        >
          {t('recipient_placeholder')}
        </div>
      )}
    </section>
  );
}
