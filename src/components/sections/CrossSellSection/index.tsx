import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { ProductCard } from '@/components/organisms/ProductCard/ProductCard';
import { listProducts } from '@/lib/data/products';
import type { ListedProduct } from '@/lib/helpers/normalize-listed-products';

import { MIN_GROUP_SIZE, filterCrossSellProducts } from './filters';

export { filterCrossSellProducts } from './filters';

export const CrossSellSection = async ({
  product,
  countryCode,
}: {
  product: ListedProduct;
  countryCode: string;
}) => {
  const categoryId = product.categories?.[0]?.id;

  const sellerProductsRaw = (product.seller?.products ?? []) as unknown as HttpTypes.StoreProduct[];

  const [categoryResult] = await Promise.all([
    categoryId
      ? listProducts({
          category_id: categoryId,
          countryCode,
          queryParams: { limit: 5 },
        })
      : Promise.resolve({ response: { products: [] as ListedProduct[] } }),
  ]);

  const sellerFiltered = filterCrossSellProducts(sellerProductsRaw, product.id!);
  const categoryFiltered = filterCrossSellProducts(
    categoryResult.response.products as unknown as HttpTypes.StoreProduct[],
    product.id!,
  );

  if (sellerFiltered.length < MIN_GROUP_SIZE && categoryFiltered.length < MIN_GROUP_SIZE) {
    return null;
  }

  const t = await getTranslations('cross_sell');

  return (
    <div
      className="mt-8 space-y-8"
      data-testid="cross-sell-section"
    >
      {sellerFiltered.length >= MIN_GROUP_SIZE && (
        <section data-testid="cross-sell-same-seller">
          <h2 className="heading-lg mb-4">{t('same_seller')}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {sellerFiltered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
              />
            ))}
          </div>
        </section>
      )}
      {categoryFiltered.length >= MIN_GROUP_SIZE && (
        <section data-testid="cross-sell-same-category">
          <h2 className="heading-lg mb-4">{t('same_category')}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categoryFiltered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
