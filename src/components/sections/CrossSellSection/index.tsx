import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { ProductCard } from '@/components/organisms/ProductCard/ProductCard';
import { listProducts } from '@/lib/data/products';
import type { ListedProduct } from '@/lib/helpers/normalize-listed-products';
import type { StorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';

import { filterCrossSellProducts, filterCrossSellSellerProducts, MIN_GROUP_SIZE } from './filters';

export { filterCrossSellProducts, filterCrossSellSellerProducts } from './filters';

export const CrossSellSection = async ({
  product,
  countryCode,
  locale
}: {
  product: ListedProduct;
  countryCode: string;
  /**
   * Story 1.2 (review-fix 1-2-F5): slug locale z route'u PDP. Ten fetch biegnie
   * w tym samym kontekście async co reszta PDP, gdzie auto-resolve potrafi spaść
   * na default — a wynik trafia do locale-keyed Data Cache, więc rozjazd locale
   * między route'em a kluczem cache utrudnia pomiar hit-rate (FR-9).
   */
  locale: StorefrontLocaleSlug;
}) => {
  const categoryId = product.categories?.[0]?.id;

  const sellerProductsRaw = (product.seller?.products ?? []) as unknown as HttpTypes.StoreProduct[];

  const categoryResult = categoryId
    ? await listProducts({
        category_id: categoryId,
        countryCode,
        queryParams: { limit: 6 },
        locale
      })
    : { response: { products: [] as ListedProduct[] } };

  if (!product.id) return null;
  const productId = product.id;
  const sellerFiltered = filterCrossSellSellerProducts(sellerProductsRaw, productId);
  const categoryFiltered = filterCrossSellProducts(
    categoryResult.response.products as unknown as HttpTypes.StoreProduct[],
    productId
  );

  if (sellerFiltered.length < MIN_GROUP_SIZE && categoryFiltered.length < MIN_GROUP_SIZE) {
    return null;
  }

  const t = await getTranslations('cross_sell');
  const recommendedProducts =
    sellerFiltered.length >= MIN_GROUP_SIZE ? sellerFiltered : categoryFiltered;
  const fromContext = product.seller?.handle
    ? { type: 'seller' as const, handle: product.seller.handle }
    : undefined;

  return (
    <section
      className="mt-10 border-t border-[var(--bb-border-soft)] pt-8"
      data-testid="pdp-recommendations-carousel"
    >
      <h2 className="heading-lg mb-4">{t('recommended_for_you')}</h2>
      <div
        className="flex snap-x gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-4 md:overflow-visible md:pb-0"
        aria-label={t('recommended_for_you')}
      >
        {recommendedProducts.map(p => (
          <div
            key={p.id}
            className="w-[240px] shrink-0 snap-start md:w-auto"
          >
            <ProductCard
              product={p}
              fromContext={fromContext}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
