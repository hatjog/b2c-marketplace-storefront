/**
 * ProductListingNoResultsView — empty results state for Algolia product listing.
 *
 * v1.7.0 Story 2.2 update:
 *   - Now delegates to DiscoveryEmptyState variant="no-results" instead of
 *     a bare StateCard, aligning all four discovery empty-state variants under
 *     one shared cell (slot/variant over fork — UX-PAT-3).
 *   - Preserves existing public API (no props required) for backwards compatibility
 *     with AlgoliaProductsListing.tsx which imports it directly.
 *
 * v1.7.0 Story 2.1 note: Previously migrated from raw text to StateCard.
 * Story 2.2 extends to use the four-variant DiscoveryEmptyState cell.
 */
import { DiscoveryEmptyState } from '@/components/cells/DiscoveryEmptyState/DiscoveryEmptyState';

const ProductListingNoResultsView = () => {
  return (
    <div
      className="my-10 w-full"
      data-testid="product-listing-no-results-view"
    >
      <DiscoveryEmptyState variant="no-results" />
    </div>
  );
};

export default ProductListingNoResultsView;
