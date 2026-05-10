import { useTranslations } from 'next-intl';

import { StateCard } from '@/components/molecules/StateCard/StateCard';

/**
 * ProductListingNoResultsView — empty results state for product listing pages.
 *
 * v1.7.0 Story 2.1 review fix (MEDIUM): migrated to the new StateCard primitive
 * so we have at least one shipping consumer of StateCard. Uses the empty
 * variant (role="region") per Story 0.9 contract — no error/failure masking.
 */
const ProductListingNoResultsView = () => {
  const t = useTranslations('products');

  return (
    <div
      className="my-10 w-full"
      data-testid="product-listing-no-results-view"
    >
      <StateCard
        variant="empty"
        title={t('no_results')}
        description={t('no_results_description')}
      />
    </div>
  );
};

export default ProductListingNoResultsView;
