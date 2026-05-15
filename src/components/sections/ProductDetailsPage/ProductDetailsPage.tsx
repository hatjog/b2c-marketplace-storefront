// @trust-invariant-scope: v180
// W1-04 PDP v1.8.0. Story 3.0 Sprint 1 thin slice gate.
// Trust Invariants enforced here:
//   #1 <VerifiedMark — verified mark visible on PDP
//   #2 <SellerProof — seller proof >=3 proof points (years + rating + ratingCount)
//   #3 <VoucherRulesCard — voucher rules clarity on PDP

import NotFound from '@/app/not-found';
import { SellerProof } from '@/components/atoms/SellerProof/SellerProof';
import { TrustBar } from '@/components/atoms/TrustBar/TrustBar';
import { VerifiedMark } from '@/components/atoms/VerifiedMark/VerifiedMark';
import { GiftModeToggle } from '@/components/atoms/GiftModeToggle/GiftModeToggle';
import { StickyAddToCart } from '@/components/cells/StickyAddToCart/StickyAddToCart';
import { ProductDetails } from '@/components/organisms/ProductDetails/ProductDetails';
import { ProductGallery } from '@/components/organisms';
import { VoucherRulesCard } from '@/components/molecules/VoucherRulesCard/VoucherRulesCard';
import { fetchProductForDetailPage } from '@/lib/data/product-detail-fetcher';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getTranslations } from 'next-intl/server';

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

function deriveSellerYears(joinDate?: string): number | undefined {
  if (!joinDate) return undefined;
  const joined = new Date(joinDate);
  if (isNaN(joined.getTime())) return undefined;
  return Math.max(0, new Date().getFullYear() - joined.getFullYear());
}

export const ProductDetailsPage = async ({
  handle,
  locale
}: {
  handle: string;
  locale: string;
}) => {
  const countryCode = await getCountryCode(locale);
  const t = await getTranslations('pdp');

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

  // SellerProof: derive years from joinDate; treatments proxy = seller.sold; ratingCount
  const sellerYears = deriveSellerYears(prod.seller?.joinDate ?? prod.seller?.created_at);
  const sellerRating = prod.seller?.rating;
  const sellerRatingCount = prod.seller?.reviewCount;
  const sellerTreatments = prod.seller?.sold;

  return (
    <div className={hasPrice ? 'pb-20 lg:pb-0' : ''}>
      {/* W1-04: 60/40 split gallery+info sticky (6fr / 4fr ≈ 60/40) */}
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)] lg:items-start"
        data-testid="product-details-page"
      >
        {/* Gallery — 60% column */}
        <div
          className="bb-section-shell !p-3 md:!p-4"
          data-testid="product-gallery-container"
        >
          <ProductGallery images={galleryImages} />
        </div>

        {/* Info — 40% column, sticky */}
        <div
          className="space-y-4 lg:sticky lg:top-[var(--site-header-height,72px)]"
          data-testid="product-details-container"
        >
          {/* Trust Invariant #1: <VerifiedMark on PDP */}
          {prod.seller?.verified && (
            <VerifiedMark
              label={t('verified_seller')}
              surface="page"
              data-testid="pdp-verified-mark"
            />
          )}

          {/* Gift mode toggle — W1-04 gift mode */}
          <GiftModeToggle data-testid="pdp-gift-mode-toggle" />

          <ProductDetails
            product={product}
            locale={locale}
          />

          {/* Trust Invariant #2: <SellerProof with >=3 proof points */}
          {prod.seller && (
            <SellerProof
              years={sellerYears}
              treatments={sellerTreatments}
              rating={sellerRating}
              ratingCount={sellerRatingCount}
              sellerName={prod.seller.name}
              data-testid="pdp-seller-proof"
            />
          )}

          {/* Trust Invariant #3: <VoucherRulesCard on PDP */}
          <VoucherRulesCard data-testid="pdp-voucher-rules-card" />

          {/* Trust bar */}
          <TrustBar data-testid="pdp-trust-bar" />
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
