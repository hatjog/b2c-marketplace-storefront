import { SkeletonProductCard } from '@/components/organisms/ProductCard/SkeletonProductCard';
import { PRODUCT_LIMIT } from '@/const';

const ProductListingLoadingView = () => (
  <div
    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    data-testid="product-listing-loading-view"
  >
    {Array.from({ length: PRODUCT_LIMIT }).map((_, idx) => (
      <SkeletonProductCard key={idx} />
    ))}
  </div>
);

export default ProductListingLoadingView;
