const ProductListingNoResultsView = () => (
  <div
    className="my-10 w-full text-center"
    data-testid="product-listing-no-results-view"
  >
    <h2 className="heading-lg uppercase text-primary">No results</h2>
    <p className="mt-4 text-lg">Sorry, we can&apos;t find any results for your criteria</p>
  </div>
);

export default ProductListingNoResultsView;
