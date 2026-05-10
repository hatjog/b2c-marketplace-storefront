import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StorefrontI18nLongContentProbe } from '@/components/atoms';
import { Cart } from '@/components/sections';
import { isMultiVendorEnabledRuntime } from '@/lib/flags/multiVendorPricing';

/**
 * Story 2.4: force-dynamic — cart state is volatile (voucher availability,
 * payment methods, pricing). No ISR cache (revalidate=300 banned per prd.md).
 *
 * R24 review fix (second pass): export placed below imports for stylistic
 * consistency with checkout/page.tsx and the rest of the Next.js app router
 * convention. Module-level statement order is functionally equivalent
 * (ES exports are hoisted), but readability matters.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('page');
  return {
    title: t('cart_title'),
    description: t('cart_description')
  };
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Story v160-cleanup-13c — warm runtime feature-flag cache.
  await isMultiVendorEnabledRuntime();
  const t = await getTranslations('page');
  return (
    <main id="main-content" className="container grid grid-cols-12">
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="cart"
      />
      <Suspense fallback={<>{t('loading')}</>}>
        <Cart />
      </Suspense>
    </main>
  );
}
