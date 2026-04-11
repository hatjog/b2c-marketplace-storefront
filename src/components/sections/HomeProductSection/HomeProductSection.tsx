import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { HomeProductsCarousel } from '@/components/organisms';
import type { Product } from '@/types/product';

export const HomeProductSection = async ({
  heading,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'pl',
  products = [],
  home = false,
  maxItems = 4,
  showPrice = true,
  showVendor = true,
}: {
  heading: string;
  locale?: string;
  products?: (Product | HttpTypes.StoreProduct)[];
  home?: boolean;
  maxItems?: number;
  showPrice?: boolean;
  showVendor?: boolean;
}) => {
  const t = await getTranslations('homepage');
  const resolvedMaxItems = Math.max(1, maxItems);

  return (
    <section
      className="bb-section-shell w-full"
      data-testid="products-carousel"
    >
      <div className="mb-8 space-y-2">
        <p className="bb-eyebrow">{t('products_eyebrow')}</p>
        <h2 className="heading-lg tracking-tight">{heading}</h2>
      </div>
      <HomeProductsCarousel
        locale={locale}
        sellerProducts={products.slice(0, resolvedMaxItems)}
        home={home}
        showPrice={showPrice}
        showVendor={showVendor}
      />
    </section>
  );
};
