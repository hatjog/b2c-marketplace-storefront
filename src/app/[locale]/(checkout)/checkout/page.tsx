// @trust-invariant-scope: v180
import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import {
  StorefrontI18nLongContentProbe,
  StorefrontRouteStateSignal,
  VerifiedMark
} from '@/components/atoms';
import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import { VoucherRulesCard } from '@/components/molecules/VoucherRulesCard/VoucherRulesCard';
import { MultiVendorOrderSummary } from '@/components/organisms/MultiVendorOrderSummary';
import PaymentWrapper from '@/components/organisms/PaymentContainer/PaymentWrapper';
import { CartAddressSection } from '@/components/sections/CartAddressSection/CartAddressSection';
import CartPaymentSection from '@/components/sections/CartPaymentSection/CartPaymentSection';
import CartReview from '@/components/sections/CartReview/CartReview';
import CartShippingMethodsSection from '@/components/sections/CartShippingMethodsSection/CartShippingMethodsSection';
import { CheckoutPurchaseMode } from '@/components/sections/CheckoutPurchaseMode/CheckoutPurchaseMode';
import { CheckoutVoucherSummary } from '@/components/sections/CheckoutVoucherSummary/CheckoutVoucherSummary';
import { getShippingCoverage, missingShippingSellerNames } from '@/lib/checkout/shippingCoverage';
import { retrieveCart } from '@/lib/data/cart';
import { retrieveCustomer } from '@/lib/data/customer';
import { listCartShippingMethods } from '@/lib/data/fulfillment';
import { listCartPaymentMethods } from '@/lib/data/payment';
import { isMultiVendorEnabled, isMultiVendorEnabledRuntime } from '@/lib/flags/multiVendorPricing';
import { readGiftRecipientIssueMetadata } from '@/lib/voucher/gift-recipient';

/**
 * Story 2.4: force-dynamic — cart/checkout payment state is volatile.
 * No ISR cache allowed (revalidate=300 anti-pattern banned per prd.md §Volatile-state-rendering).
 */
export const dynamic = 'force-dynamic';

type CheckoutPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ step?: string | string[]; mode?: string | string[] }>;
};

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'page' });
  return {
    title: t('checkout_title'),
    description: t('checkout_description')
  };
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawStep = resolvedSearchParams.step;
  const checkoutStep = Array.isArray(rawStep) ? rawStep[0] : rawStep;
  const rawMode = resolvedSearchParams.mode;
  const checkoutMode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
  const t = await getTranslations({ locale, namespace: 'page' });
  return (
    <Suspense
      fallback={
        <div
          className="container flex items-center justify-center"
          data-testid="checkout-page-loading"
        >
          {t('loading')}
        </div>
      }
    >
      <CheckoutPageContent
        locale={locale}
        searchParamsStep={checkoutStep}
        searchParamsMode={checkoutMode}
      />
    </Suspense>
  );
}

async function CheckoutPageContent({
  locale,
  searchParamsStep,
  searchParamsMode
}: {
  locale: string;
  searchParamsStep?: string;
  searchParamsMode?: string;
}) {
  // Story v160-cleanup-13c — warm runtime feature-flag cache.
  await isMultiVendorEnabledRuntime();
  const tCheckout = await getTranslations({ locale, namespace: 'checkout' });
  const tPage = await getTranslations({ locale, namespace: 'page' });
  const tPaymentStatus = await getTranslations({ locale, namespace: 'payment_status' });
  const cart = await retrieveCart();

  if (!cart) {
    return notFound();
  }

  const shippingMethods = await listCartShippingMethods(cart.id, false);
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? '');
  const customer = await retrieveCustomer();

  // Per-seller shipping coverage (orphaned-charge guard). Mercur completes one
  // order per seller and `/store/carts/:id/complete` requires a shipping method
  // for EVERY seller; the pay button must stay blocked until that holds, or the
  // card is charged for an order that cannot be created.
  const shippingCoverage = getShippingCoverage(cart, shippingMethods);
  // Fail-closed: shippingMethods===null means listCartShippingMethods either
  // errored (network / 5xx) or returned an unrecognised response shape.
  // Treat as "shipping NOT complete" — never let a fetch failure silently open
  // the payment gate (would produce orphan-charges if /complete then rejects).
  // An empty array [] means "no shipping required" and is handled correctly by
  // getShippingCoverage (no requiredSellers → isComplete:true).
  const shippingIsComplete = shippingMethods !== null ? shippingCoverage.isComplete : false;

  // Checkout flow (Robert eye-check): render every section expanded at once instead of
  // the one-at-a-time `?step=` accordion; sections whose prerequisite isn't met yet are
  // shown but greyed-out + non-interactive (top-down: completing one unlocks the next).
  // The correctness gates (orphaned-charge shipping, RODO consent, gift recipient) are
  // unchanged — `locked` is purely the visual/interaction state, not a new payment gate.
  const addressDone = Boolean(
    cart.shipping_address?.first_name &&
      cart.shipping_address?.last_name &&
      cart.shipping_address?.address_1 &&
      cart.shipping_address?.city &&
      cart.shipping_address?.postal_code &&
      cart.shipping_address?.country_code
  );

  // Reflect the PDP "buy as gift" choice (persisted as line-item
  // metadata.is_gift / purchase_mode) in the checkout purchase-mode toggle.
  const cartPurchaseMode = cart.items?.some(item => {
    const meta = item.metadata as Record<string, unknown> | null | undefined;
    return meta?.is_gift === true || meta?.is_gift === 'true' || meta?.purchase_mode === 'gift';
  })
    ? 'gift'
    : 'self';
  const checkoutGiftMode = searchParamsMode?.trim().toLowerCase() === 'gift';
  const giftRecipientRequired = cartPurchaseMode === 'gift' || checkoutGiftMode;
  const giftLineItems = (cart.items ?? []).filter(item => {
    const meta = item.metadata as Record<string, unknown> | null | undefined;
    return meta?.is_gift === true || meta?.is_gift === 'true' || meta?.purchase_mode === 'gift';
  });
  // M4 (code-review 2.4, konserwatywny fail-safe — decyzja do async akceptacji PO,
  // patrz review-2-4-gift-od-razu-handoff-mail-ui.md): brak jawnego markera gift
  // na POZYCJI koszyka wielopozycyjnego NIE może stemplować metadanych prezentu
  // na wszystkie pozycje — po 2.4 to nieodwracalny mail z kodem vouchera do
  // niewłaściwej osoby, gdy koszyk niesie i "dla siebie", i "dla kogoś".
  // Fallback na WSZYSTKIE pozycje jest bezpieczny WYŁĄCZNIE dla koszyka
  // jednopozycyjnego (tam nie ma niejednoznaczności co do tego, który item to
  // prezent). Dla ≥2 pozycji bez markera `giftBindingTargets` zostaje puste —
  // `giftRecipientComplete` poniżej wymusza wtedy wybór markera na PDP zamiast
  // cichego wysłania maila do niewłaściwego entitlementu.
  const giftBindingTargets =
    giftLineItems.length > 0
      ? giftLineItems
      : (cart.items ?? []).length === 1
        ? (cart.items ?? [])
        : [];
  const initialGiftRecipient =
    giftBindingTargets
      .map(item =>
        readGiftRecipientIssueMetadata(item.metadata as Record<string, unknown> | null | undefined)
      )
      .find(Boolean) ?? null;
  const giftRecipientComplete =
    !giftRecipientRequired ||
    (giftBindingTargets.length > 0 &&
      giftBindingTargets.every(item =>
        Boolean(
          readGiftRecipientIssueMetadata(
            item.metadata as Record<string, unknown> | null | undefined
          )
        )
      ));

  return (
    <PaymentWrapper cart={cart}>
      <main
        className="bb-page-shell"
        data-testid="checkout-page"
      >
        <StorefrontRouteStateSignal
          route="checkout"
          surface="checkout"
        />
        <StorefrontI18nLongContentProbe
          locale={locale}
          surface="checkout"
        />
        <div className="checkout-header flex flex-col gap-3 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[rgba(249,244,236,0.96)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <a
            href={`/${locale}/cart`}
            className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:underline"
          >
            {tCheckout('back_to_cart')}
          </a>
          <div className="support flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <span className="secure-pill inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
              {tCheckout('checkout_header_secure')}
            </span>
            <span>
              {tCheckout('checkout_header_support')}{' '}
              <strong className="text-[var(--text-primary,#1A1A1A)]">
                {tCheckout('checkout_header_phone')}
              </strong>
            </span>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div
            className="flex flex-col gap-4"
            data-testid="checkout-steps-container"
          >
            {/* Flow clarity (Robert): a COMPLETED section collapses to its summary (✓ + Edit)
                so only the ACTIVE section shows an open form with one obvious primary button —
                the previous "every section expanded at once" made it unclear which button
                advanced. Locked (prerequisite-not-met) sections stay greyed previews. */}
            <CartAddressSection
              cart={cart}
              customer={customer}
              forceExpanded={!addressDone}
            />
            <CartShippingMethodsSection
              cart={cart}
              availableShippingMethods={shippingMethods}
              forceExpanded={!shippingIsComplete}
              locked={!addressDone}
            />
            <CheckoutPurchaseMode
              cartPurchaseMode={cartPurchaseMode}
              giftLineItemIds={giftBindingTargets.map(item => item.id)}
              initialGiftRecipient={initialGiftRecipient}
              isDone={searchParamsStep === 'payment' || searchParamsStep === 'review'}
              locked={!shippingIsComplete}
            />
            <CartPaymentSection
              cart={cart}
              availablePaymentMethods={paymentMethods}
              shippingComplete={shippingIsComplete}
              missingShippingSellers={missingShippingSellerNames(shippingCoverage)}
              giftRecipientRequired={giftRecipientRequired}
              giftRecipientComplete={giftRecipientComplete}
              forceExpanded
              locked={!shippingIsComplete || (giftRecipientRequired && !giftRecipientComplete)}
            />
          </div>

          <div
            className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start"
            data-testid="checkout-review-container"
          >
            {isMultiVendorEnabled() && <MultiVendorOrderSummary cart={cart} />}
            {/* Trust Invariant #1: <VerifiedMark> on checkout per Story 0.15.
                v1.9.0 Wave F7 hardening (CC-3 M7) — wires the marker into the
                checkout surface tree so validate_trust_invariant_verified_mark
                exits 0 instead of FAIL. */}
            <div
              className="flex items-center justify-end gap-2 text-xs text-[var(--text-secondary)]"
              data-testid="checkout-verified-mark"
            >
              <VerifiedMark
                label={tPage('checkout_verified_label')}
                surface="page"
              />
            </div>
            {/* Trust Invariant #5: <CrossActorHandoff names buyer/salon duties before payment. */}
            <CrossActorHandoff
              forYou={tCheckout('cross_actor.for_you')}
              forUs={tCheckout('cross_actor.for_us')}
              labelForYou={tPaymentStatus('cross_actor.for_you')}
              labelForUs={tPaymentStatus('cross_actor.for_us')}
              data-testid="checkout-cross-actor-handoff"
            />
            {/* Trust Invariant #3: <VoucherRulesCard stays visible even when
                seller grouping drops every item due to missing seller.id. */}
            <VoucherRulesCard data-testid="checkout-voucher-rules-card" />
            {/* Story 2.4 AC1: VoucherClaritySurface (condensed) + SellerProofSurface
                per seller group above CartReview — voucher rules and seller identity
                visible before Pay (ARCH-007: server component, cannot cross 'use client' boundary). */}
            <CheckoutVoucherSummary cart={cart} />
            <div className="flex flex-col gap-3 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)] p-4">
              <div className="os-method-badge inline-flex w-fit items-center rounded-full px-3 py-2 text-xs">
                {tCheckout('order_summary_method_badge')}
              </div>
              <div className="os-trust-row flex flex-wrap gap-2 border-t border-[var(--bb-border-soft)] pt-3">
                {[
                  tCheckout('order_summary_trust_stripe'),
                  tCheckout('order_summary_trust_ssl'),
                  tCheckout('order_summary_trust_return')
                ].map(token => (
                  <span
                    key={token}
                    className="tt inline-flex items-center rounded-full px-3 py-1 text-[11px]"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
            <CartReview
              cart={cart}
              shippingComplete={shippingIsComplete && giftRecipientComplete}
            />
          </div>
        </div>
      </main>
    </PaymentWrapper>
  );
}
