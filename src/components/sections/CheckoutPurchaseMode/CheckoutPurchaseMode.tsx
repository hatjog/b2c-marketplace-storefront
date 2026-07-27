'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { PurchaseModeToggle, type PurchaseMode } from '@/components/molecules/PurchaseModeToggle';
import { SectionLockedNotice } from '@/components/molecules/SectionLockedNotice/SectionLockedNotice';
import { parsePurchaseMode, SelfPurchaseMode } from '@/lib/helpers/parse-purchase-mode';
import type { GiftRecipientIssueMetadata } from '@/lib/voucher/gift-recipient';

import { GiftRecipientForm } from './GiftRecipientForm';

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
 *   AC3 — Gift mode renders the functional GiftRecipientForm component
 *         (Story 5.3 — replaces placeholder; form collects recipient email,
 *         message ≤200 chars with live counter, and send-date Teraz/Zaplanuj).
 *
 * Implementation notes:
 *   - Component is client-only (URL state hook).
 *   - URL param strategy: when mode === 'self' (default) we strip the
 *     `?mode` param so canonical URL stays clean; gift adds `mode=gift`.
 *   - Existing checkout flow uses `?step=address|payment|review` —
 *     `?mode` namespace is verified clean (no collision).
 */

export function normalizePurchaseMode(rawMode: string | null | undefined): PurchaseMode {
  const normalizedMode = rawMode?.trim().toLowerCase();
  return normalizedMode === 'gift' ? 'gift' : 'self';
}

export function CheckoutPurchaseMode({
  cartPurchaseMode,
  giftLineItemIds = [],
  initialGiftRecipient,
  isDone = false,
  locked = false
}: {
  /** Mode persisted on the cart line items at the PDP (metadata.is_gift /
   *  purchase_mode). Used as the initial display when the URL carries no
   *  explicit `?mode`, so a "buy as gift" choice survives navigation from the
   *  product page into checkout. Defaults to 'self' when absent. */
  cartPurchaseMode?: PurchaseMode;
  giftLineItemIds?: string[];
  initialGiftRecipient?: GiftRecipientIssueMetadata | null;
  isDone?: boolean;
  /** Prerequisite not met yet → shown but greyed-out + non-interactive (checkout flow). */
  locked?: boolean;
} = {}): ReactElement {
  const t = useTranslations('seller.checkout');
  // Powody blokady sekcji checkoutu żyją w namespace `checkout` (wspólnym dla
  // dostawy i płatności), nie w `seller.checkout` — stąd drugi hook zamiast
  // duplikowania stringa.
  const tCheckout = useTranslations('checkout');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawMode = searchParams.get('mode');
  const hasExplicitUrlMode = (rawMode?.trim() ?? '') !== '';
  // TF-74: case-insensitive parse + injection-resistant whitelist via parsePurchaseMode helper.
  const parsedMode = parsePurchaseMode(rawMode);
  const urlMode: PurchaseMode = parsedMode === SelfPurchaseMode.GIFT ? 'gift' : 'self';

  // Initial display precedence: an EXPLICIT `?mode` wins (shareable link /
  // prior toggle), otherwise fall back to the cart-persisted mode so the PDP
  // gift selection is reflected here. Plain default stays 'self'.
  const initialMode: PurchaseMode = hasExplicitUrlMode ? urlMode : (cartPurchaseMode ?? 'self');

  // Local state is the RESPONSIVE source of truth for display so a click flips the
  // toggle/placeholder synchronously — independent of router.replace, which raced with
  // CartAddressSection's own ?step= write (two URL owners → soft-nav dropped → toggle
  // appeared dead). URL is kept in sync as a write target (shareable links + SSR read).
  const [mode, setMode] = useState<PurchaseMode>(initialMode);

  // Sync only from an EXPLICIT URL mode (shareable ?mode=gift, back/forward).
  // When the URL has no mode we must NOT re-apply urlMode (it resolves to
  // 'self' and would erase the cart-derived gift state on mount).
  useEffect(() => {
    if (hasExplicitUrlMode) {
      setMode(urlMode);
    }
  }, [hasExplicitUrlMode, urlMode]);

  const handleChange = useCallback(
    (newMode: PurchaseMode): void => {
      setMode(newMode);
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
    // Wrapper zamiast fragmentu — notice i sekcja jako jeden element flex
    // rodzica (patrz CartPaymentSection).
    <div className="flex flex-col gap-2">
      {/* Rodzeństwo `.bb-section-shell` — patrz SectionLockedNotice. Ten
          przypadek jest krytyczny: gdy `listCartShippingMethods` zawiedzie
          (fail-closed ⇒ `shippingIsComplete=false`), zablokowana jest ZARÓWNO
          ta sekcja, jak i płatność — bez komunikatu kupująca nie ma jak
          odkryć, że formularza prezentu nie da się wypełnić. */}
      <SectionLockedNotice
        reason={locked ? tCheckout('locked_reason.shipping_incomplete') : undefined}
        data-testid="checkout-purchase-mode-block-reason"
      />
      <section
        data-testid="checkout-purchase-mode-section"
        className="bb-section-shell flex flex-col gap-4"
        data-locked={locked || undefined}
        aria-disabled={locked || undefined}
      >
        <div className={`step-head ${isDone ? 'is-done' : ''}`}>
          <span className="step-num">{isDone ? '✓' : '3'}</span>
          <h2>{t('checkout_step_invoice')}</h2>
        </div>
        <div className="consent-row">
          <span
            className="cb"
            aria-hidden="true"
          />
          <span className="label">{t('invoice_vat_hint')}</span>
        </div>
        <PurchaseModeToggle
          mode={mode}
          onChange={handleChange}
        />
        {mode === 'gift' && (
          <GiftRecipientForm
            lineItemIds={giftLineItemIds}
            initialValue={initialGiftRecipient}
          />
        )}
      </section>
    </div>
  );
}
