import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { MultiVendorOrderSummary } from '@/components/organisms/MultiVendorOrderSummary';
import PaymentWrapper from '@/components/organisms/PaymentContainer/PaymentWrapper';
import { CartAddressSection } from '@/components/sections/CartAddressSection/CartAddressSection';
import CartPaymentSection from '@/components/sections/CartPaymentSection/CartPaymentSection';
import CartReview from '@/components/sections/CartReview/CartReview';
import CartShippingMethodsSection from '@/components/sections/CartShippingMethodsSection/CartShippingMethodsSection';
import { CheckoutPurchaseMode } from '@/components/sections/CheckoutPurchaseMode/CheckoutPurchaseMode';
import { CheckoutVoucherSummary } from '@/components/sections/CheckoutVoucherSummary/CheckoutVoucherSummary';
import { retrieveCart } from '@/lib/data/cart';
import { retrieveCustomer } from '@/lib/data/customer';
import { listCartShippingMethods } from '@/lib/data/fulfillment';
import { listCartPaymentMethods } from '@/lib/data/payment';
import { isMultiVendorEnabled, isMultiVendorEnabledRuntime } from '@/lib/flags/multiVendorPricing';

/**
 * Story 2.4: force-dynamic — cart/checkout payment state is volatile.
 * No ISR cache allowed (revalidate=300 anti-pattern banned per prd.md §Volatile-state-rendering).
 */
export const dynamic = 'force-dynamic';

type CheckoutPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'page' });
  return {
    title: t('checkout_title'),
    description: t('checkout_description')
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale } = await params;
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
      <CheckoutPageContent locale={locale} />
    </Suspense>
  );
}

async function CheckoutPageContent({ locale }: { locale: string }) {
  // Story v160-cleanup-13c — warm runtime feature-flag cache.
  await isMultiVendorEnabledRuntime();
  const cart = await retrieveCart();

  if (!cart) {
    return notFound();
  }

  const shippingMethods = await listCartShippingMethods(cart.id, false);
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? '');
  const customer = await retrieveCustomer();

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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div
            className="flex flex-col gap-4"
            data-testid="checkout-steps-container"
          >
            <CartAddressSection
              cart={cart}
              customer={customer}
            />
            <CartShippingMethodsSection
              cart={cart}
              availableShippingMethods={shippingMethods}
            />
            <CheckoutPurchaseMode />
            <CartPaymentSection
              cart={cart}
              availablePaymentMethods={paymentMethods}
            />
          </div>

          <div
            className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start"
            data-testid="checkout-review-container"
          >
            {isMultiVendorEnabled() && <MultiVendorOrderSummary cart={cart} />}
            {/* Story 2.4 AC1: VoucherClaritySurface (condensed) + SellerProofSurface
                per seller group above CartReview — voucher rules and seller identity
                visible before Pay (ARCH-007: server component, cannot cross 'use client' boundary). */}
            <CheckoutVoucherSummary cart={cart} />
            <CartReview cart={cart} />
          </div>
        </div>
      </main>
    </PaymentWrapper>
  );
}
