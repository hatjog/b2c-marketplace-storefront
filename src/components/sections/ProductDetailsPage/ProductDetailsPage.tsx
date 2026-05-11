import NotFound from '@/app/not-found';
import { StickyAddToCart } from '@/components/cells/StickyAddToCart/StickyAddToCart';
import { ProductDetails } from '@/components/organisms/ProductDetails/ProductDetails';
import { ProductGallery } from '@/components/organisms';
import { fetchProductForDetailPage } from '@/lib/data/product-detail-fetcher';
import { getCountryCode } from '@/lib/helpers/country-code';

import { CrossSellSection } from '../CrossSellSection';

// noqa: mercur15-drift — backward-compat dual-check: accepts Mercur 2 `seller.status === 'open'`
// OR legacy Mercur 1.x `store_status === 'ACTIVE'` for API responses that may still carry the
// Mercur 1.5 store_status shim. Remove store_status branch once all API responses migrate to seller.status.
const isSellerActive = (seller: { status?: string; store_status?: string } | null | undefined) => {
  if (!seller) {
    return true;
  }

  return seller.status === 'open' || seller.store_status === 'ACTIVE'; // noqa: mercur15-drift
};

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

  if (!isSellerActive(prod.seller)) {
    return NotFound();
  }

  const product = {
    ...prod,
    seller: prod.seller ?? undefined,
  };
  const galleryImages = prod.images?.length
    ? prod.images
    : prod.thumbnail
      ? [{ id: `${prod.id}-thumbnail`, url: prod.thumbnail, rank: 0 }]
      : [];

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
          <ProductGallery images={galleryImages} />
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
