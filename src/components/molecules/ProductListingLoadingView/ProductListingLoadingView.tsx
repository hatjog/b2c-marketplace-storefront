/**
 * ProductListingLoadingView — submit-load skeleton for Algolia listing.
 *
 * v1.7.0 Story 2.2 update:
 *   - Added aria-busy="true" + role="status" + sr-only status text.
 *   - Distinguishes "loading new results" (submit-load) from routing-load
 *     (ProductListingSkeleton on Suspense fallback) per UX-DR19.
 *   - Status text announces to screen readers: "Ładowanie nowych wyników..."
 *   - Consistent with BonBeauty skeleton surface (SkeletonProductCard uses
 *     --bb-skeleton-base token already set by Story 2.1).
 *
 * This is the submit-load state triggered by: filter change, sort change,
 * pagination, search debounce in AlgoliaProductsListing.
 * The routing-load state uses ProductListingSkeleton on <Suspense fallback>.
 */
import { SkeletonProductCard } from '@/components/organisms/ProductCard/SkeletonProductCard';
import { PRODUCT_LIMIT } from '@/const';

const ProductListingLoadingView = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Ładowanie nowych wyników..."
    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    data-testid="product-listing-loading-view"
  >
    {/* sr-only distinguishes submit-load ("new results") from routing-load ("page") */}
    <span className="sr-only">Ładowanie nowych wyników...</span>
    {Array.from({ length: PRODUCT_LIMIT }).map((_, idx) => (
      <SkeletonProductCard key={idx} />
    ))}
  </div>
);

export default ProductListingLoadingView;
