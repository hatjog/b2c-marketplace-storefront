import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { HomeProductsCarousel } from '@/components/organisms';
import type { Product } from '@/types/product';

export const HomeProductSection = async ({
  heading,
  locale,
  products = [],
  home = false,
  maxItems = 4,
  showPrice = true,
  showVendor = true,
}: {
  heading: string;
  /**
   * QD-03 (CAP-3): locale trasy, WYMAGANE. Wcześniej domyślną wartością było
   * `process.env.NEXT_PUBLIC_DEFAULT_REGION` — czyli kod REGIONU podstawiany
   * pod locale. Każdy call site, który pominąłby ten props, renderowałby chrome
   * w regionie zamiast w języku trasy. Pokrycia call sites pilnuje teraz typ.
   */
  locale: string;
  products?: (Product | HttpTypes.StoreProduct)[];
  home?: boolean;
  maxItems?: number;
  showPrice?: boolean;
  showVendor?: boolean;
}) => {
  // QD-03 (CAP-3): jawne locale trasy.
  const t = await getTranslations({ locale, namespace: 'homepage' });
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
