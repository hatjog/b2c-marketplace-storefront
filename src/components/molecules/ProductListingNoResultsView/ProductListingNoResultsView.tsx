import { useTranslations } from 'next-intl';

const ProductListingNoResultsView = () => {
  const t = useTranslations('products');

  return (
    <div
      className="my-10 w-full text-center"
      data-testid="product-listing-no-results-view"
    >
      <h2 className="heading-lg uppercase text-primary">{t('no_results')}</h2>
      <p className="mt-4 text-lg">{t('no_results_description')}</p>
    </div>
  );
};

export default ProductListingNoResultsView;
