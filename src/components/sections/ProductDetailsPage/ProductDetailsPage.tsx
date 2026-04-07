import NotFound from '@/app/not-found';
import { StickyAddToCart } from '@/components/cells/StickyAddToCart/StickyAddToCart';
import { ProductDetails } from '@/components/organisms/ProductDetails/ProductDetails';
import { ProductGallery } from '@/components/organisms';
import { listProducts } from '@/lib/data/products';
import { getCountryCode } from '@/lib/helpers/country-code';

import { CrossSellSection } from '../CrossSellSection';

export const ProductDetailsPage = async ({
  handle,
  locale
}: {
  handle: string;
  locale: string;
}) => {
  const countryCode = await getCountryCode(locale);
  const prod = await listProducts({
    countryCode,
    queryParams: { handle: [handle], limit: 1 },
    forceCache: true,
    includeSellerContext: true,
  }).then(({ response }) => response.products[0]);

  if (!prod) return NotFound();

  if (prod.seller && prod.seller.store_status !== 'ACTIVE') {
    return NotFound();
  }

  const product = {
    ...prod,
    seller: prod.seller ?? undefined,
  };

  const hasPrice = prod.variants?.some(v => v.calculated_price);

  return (
    <div className={hasPrice ? 'pb-20 lg:pb-0' : ''}>
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:items-start"
        data-testid="product-details-page"
      >
        <div
          className="bb-section-shell !p-3 md:!p-4"
          data-testid="product-gallery-container"
        >
          <ProductGallery images={prod?.images || []} />
        </div>
        <div
          className="space-y-4"
          data-testid="product-details-container"
        >
          <ProductDetails
            product={product}
            locale={locale}
          />
        </div>
      </div>
      <CrossSellSection
        product={prod}
        countryCode={countryCode}
      />
      <StickyAddToCart
        product={product}
        countryCode={countryCode}
      />
    </div>
  );
};
