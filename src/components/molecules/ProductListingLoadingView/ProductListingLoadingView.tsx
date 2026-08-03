'use client';

/**
 * ProductListingLoadingView — submit-load skeleton for Algolia listing.
 *
 * v1.7.0 Story 2.2 update:
 *   - Added aria-busy="true" + role="status" + sr-only status text.
 *   - Distinguishes "loading new results" (submit-load) from routing-load
 *     (ProductListingSkeleton on Suspense fallback) per UX-DR19.
 *   - Status text announces to screen readers via i18n (category.loading_new_results).
 *   - Consistent with BonBeauty skeleton surface (SkeletonProductCard uses
 *     --bb-skeleton-base token already set by Story 2.1).
 *
 * v1.7.0 Story 2.2 review fix (HIGH H1):
 *   - Removed hardcoded PL aria-label/sr-only strings; now resolved via
 *     useTranslations('category').loading_new_results so EN/UA/DE screen
 *     reader announcements match the visible page locale (AC3).
 *
 * This is the submit-load state triggered by: filter change, sort change,
 * pagination, search debounce in AlgoliaProductsListing.
 * The routing-load state uses ProductListingSkeleton on <Suspense fallback>.
 */
import { useTranslations } from 'next-intl';

import { SkeletonProductCard } from '@/components/organisms/ProductCard/SkeletonProductCard';
import { PRODUCT_LIMIT } from '@/const';

const ProductListingLoadingView = () => {
  const t = useTranslations('category');
  const loadingLabel = t('loading_new_results');

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      data-testid="product-listing-loading-view"
    >
      {/* sr-only distinguishes submit-load ("new results") from routing-load ("page") */}
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: PRODUCT_LIMIT }).map((_, idx) => (
        <SkeletonProductCard key={idx} />
      ))}
    </div>
  );
};

export default ProductListingLoadingView;
