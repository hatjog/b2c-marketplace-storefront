// @trust-invariant-scope: v180
// W1-04 PDP v1.8.0. Story 3.0 Sprint 1 thin slice gate.
// Trust Invariants enforced here:
//   #1 <VerifiedMark — verified mark visible on PDP
//   #2 <SellerProof — seller proof >=3 proof points (years + rating + ratingCount)
//   #3 <VoucherRulesCard — voucher rules clarity on PDP

import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { SellerProof } from '@/components/atoms/SellerProof/SellerProof';
import { TrustBar } from '@/components/atoms/TrustBar/TrustBar';
import { VerifiedMark } from '@/components/atoms/VerifiedMark/VerifiedMark';
import { StickyAddToCart } from '@/components/cells/StickyAddToCart/StickyAddToCart';
import { VoucherRulesCard } from '@/components/molecules/VoucherRulesCard/VoucherRulesCard';
import { ProductGallery } from '@/components/organisms';
import { ProductDetails } from '@/components/organisms/ProductDetails/ProductDetails';
import { fetchProductForDetailPage } from '@/lib/data/product-detail-fetcher';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getGpMetadata } from '@/lib/helpers/metadata-utils';
import {
  deriveSellerRatingCount,
  deriveSellerTreatments,
  deriveSellerYears,
  formatSellerDistrictAddress,
  normalizePdpGalleryImages,
  resolvePdpVoucherRules
} from '@/lib/helpers/pdp';
import type { GpProductMetadata } from '@/types/product';

import { CrossSellSection } from '../CrossSellSection';
import { ProductDetailsTabs } from './ProductDetailsTabs';

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
  const t = await getTranslations('pdp');

  // D-09: cache()-wrapped fetcher. The outer route page.tsx already invoked
  // this with the same (handle, countryCode); React 19 cache() returns the
  // memoized payload here, so listProducts() runs once per render.
  const prod = await fetchProductForDetailPage(handle, countryCode);

  // notFound() throws — if prod is null, execution stops here.
  // W5-05: Next.js notFound() triggers the nearest not-found.tsx boundary,
  // exposing data-testid="product-not-found" via products/[handle]/not-found.tsx.
  if (!prod) notFound();
  if (!isSellerActive(prod.seller)) notFound();

  const product = {
    ...prod,
    seller: prod.seller ?? undefined
  };
  const galleryImages = normalizePdpGalleryImages(prod);

  const hasPrice = prod.variants?.some(v => v.calculated_price);

  const gpMeta = getGpMetadata<GpProductMetadata>(prod.metadata as Record<string, unknown>);
  const voucherRules = resolvePdpVoucherRules(gpMeta, {
    usageConditions: [t('voucher_rules.usage_body')],
    refundPolicy: t('voucher_rules.refund_body'),
    cancellationPolicy: t('voucher_rules.cancellation_body'),
    extensionPolicy: t('voucher_rules.extension_body'),
    noShowPolicy: t('voucher_rules.no_show_body')
  });
  const sellerYears = deriveSellerYears(prod.seller);
  const sellerRating = (prod.seller as { rating?: number | null } | undefined)?.rating ?? null;
  const sellerRatingCount = deriveSellerRatingCount(prod.seller);
  const sellerTreatments = deriveSellerTreatments(prod.seller);
  const sellerAddressDisplay = formatSellerDistrictAddress(prod.seller);
  const trustItems = [
    { label: t('trust_bar.marketplace_verified') },
    { label: t('trust_bar.return_30_days') },
    { label: t('trust_bar.polish_support') },
    { label: t('trust_bar.instant_pdf') }
  ];
  const sellerTabsAddress =
    prod.seller?.address_line || sellerAddressDisplay || prod.seller?.city || null;

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
          <ProductGallery
            images={galleryImages}
            productTitle={prod.title}
          />
        </div>

        {/* Info — 40% column, sticky */}
        <div
          className="space-y-4 lg:sticky lg:top-[var(--site-header-height,72px)]"
          data-testid="product-details-container"
        >
          {/* Trust Invariant #1: <VerifiedMark on PDP */}
          {(prod.seller as { verified?: boolean } | null | undefined)?.verified && (
            <VerifiedMark
              label={t('verified_seller')}
              surface="page"
              data-testid="pdp-verified-mark"
            />
          )}

          <ProductDetails
            product={product}
            locale={locale}
            showTrustSurfaces={false}
            showExtendedSections={false}
          />

          {/* Trust Invariant #2: <SellerProof with >=3 proof points */}
          {prod.seller && (
            <SellerProof
              years={sellerYears}
              treatments={sellerTreatments}
              rating={sellerRating}
              ratingCount={sellerRatingCount}
              sellerName={prod.seller.name}
              sellerHandle={prod.seller.handle}
              addressDisplay={sellerAddressDisplay}
              locale={locale}
              labels={{
                aria: t('seller_proof.aria', { name: prod.seller.name }),
                viewSeller: t('seller_proof.view_seller'),
                yearsValue: count => t('seller_proof.years_value', { count }),
                yearsLabel: t('seller_proof.years_label'),
                treatmentsValue: count => t('seller_proof.treatments_value', { count }),
                treatmentsLabel: t('seller_proof.treatments_label'),
                ratingValue: (rating, count) =>
                  t('seller_proof.rating_value', { rating: rating.toFixed(1), count }),
                ratingLabel: t('seller_proof.rating_label'),
                noRatings: t('seller_proof.no_ratings'),
                warningTitle: t('seller_proof.warning_title'),
                warningBody: t('seller_proof.warning_body')
              }}
              data-testid="pdp-seller-proof"
            />
          )}

          {/* Trust Invariant #3: <VoucherRulesCard on PDP */}
          <VoucherRulesCard
            validityMonths={voucherRules.validityMonths}
            usageConditions={voucherRules.usageConditions}
            refundPolicy={voucherRules.refundPolicy}
            cancellationPolicy={voucherRules.cancellationPolicy}
            extensionPolicy={voucherRules.extensionPolicy}
            noShowPolicy={voucherRules.noShowPolicy}
            data-testid="pdp-voucher-rules-card"
          />

          {/* Trust bar */}
          <TrustBar
            items={trustItems}
            ariaLabel={t('trust_bar.aria_label')}
            data-testid="pdp-trust-bar"
          />
        </div>
      </div>

      <ProductDetailsTabs
        description={prod.description ?? null}
        voucherRules={voucherRules}
        seller={
          prod.seller
            ? {
                name: prod.seller.name,
                description: prod.seller.description,
                address: sellerTabsAddress,
                openingHours: prod.seller.opening_hours ?? null,
                gallery: prod.seller.gallery ?? null,
                rating: sellerRating,
                ratingCount: sellerRatingCount,
                reviews: Array.isArray(prod.seller.reviews) ? prod.seller.reviews : []
              }
            : null
        }
      />

      <CrossSellSection
        product={prod}
        countryCode={countryCode}
      />
      <section
        className="mt-10 rounded-[var(--bb-radius-card)] bg-[var(--bb-surface-muted)] p-6"
        data-testid="pdp-trust-band"
        aria-label={t('trust_band.aria_label')}
      >
        <TrustBar
          items={trustItems}
          ariaLabel={t('trust_bar.aria_label')}
          className="border-transparent bg-transparent"
          data-testid="pdp-bottom-trust-bar"
        />
      </section>
      <StickyAddToCart
        product={product}
        countryCode={countryCode}
      />
    </div>
  );
};
