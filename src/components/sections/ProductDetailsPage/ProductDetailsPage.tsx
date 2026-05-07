import NotFound from '@/app/not-found';
import { StickyAddToCart } from '@/components/cells/StickyAddToCart/StickyAddToCart';
import { ProductDetails } from '@/components/organisms/ProductDetails/ProductDetails';
import { ProductGallery } from '@/components/organisms';
import { fetchProductForDetailPage } from '@/lib/data/product-detail-fetcher';
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
  // D-09: cache()-wrapped fetcher. The outer route page.tsx already invoked
  // this with the same (handle, countryCode); React 19 cache() returns the
  // memoized payload here, so listProducts() runs once per render.
  const prod = await fetchProductForDetailPage(handle, countryCode);

  if (!prod) return NotFound();

  // Story v160-cleanup-11 (8.8 follow-up): accept BOTH Mercur 2 (`status === 'open'`)
  // and legacy Mercur 1.x (`store_status === 'ACTIVE'`) vocabularies. Without this
  // dual check, every Mercur 2 PDP returns NotFound because `store_status` is
  // undefined. Mirrors `normalize-listed-products.ts` filter.
  if (prod.seller) {
    const seller = prod.seller as typeof prod.seller & {
      status?: string;
      store_status?: string;
    };
    const isActive =
      seller.status === 'open' || seller.store_status === 'ACTIVE';
    if (!isActive) {
      return NotFound();
    }
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
