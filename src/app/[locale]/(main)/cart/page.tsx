import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { Cart } from '@/components/sections';
import { listCategories } from '@/lib/data/categories';
import { listProducts } from '@/lib/data/products';
import { isMultiVendorEnabledRuntime } from '@/lib/flags/multiVendorPricing';
import { getCountryCode } from '@/lib/helpers/country-code';

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

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Story v160-cleanup-13c — warm runtime feature-flag cache.
  await isMultiVendorEnabledRuntime();
  let recommendedProducts: Awaited<ReturnType<typeof listProducts>>['response']['products'] = [];
  let curatedCategories: Array<{ id: string; name: string; handle: string }> = [];

  try {
    const countryCode = await getCountryCode(locale);
    const [{ response: recommendedResponse }, { categories }] = await Promise.all([
      listProducts({
        countryCode,
        queryParams: {
          limit: 8,
          order: 'created_at'
        },
        forceCache: true
      }),
      listCategories({ query: { limit: 8 } })
    ]);

    recommendedProducts = recommendedResponse.products.slice(0, 8);
    curatedCategories = categories.slice(0, 8).map(category => ({
      id: category.id,
      name: category.name,
      handle: category.handle
    }));
  } catch (error) {
    console.error('[cart] Failed to load recommendation feeds:', error);
  }
  const t = await getTranslations('page');
  return (
    <main
      id="main-content"
      className="container grid grid-cols-12"
    >
      <StorefrontRouteStateSignal
        route="cart"
        surface="cart"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="cart"
      />
      <Suspense fallback={<>{t('loading')}</>}>
        <Cart
          recommendedProducts={recommendedProducts}
          curatedCategories={curatedCategories}
        />
      </Suspense>
    </main>
  );
}
