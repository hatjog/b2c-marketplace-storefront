import type { HttpTypes } from '@medusajs/types';

import { ProductCarousel } from '@/components/cells';

export const GalleryCarousel = ({
  images,
  productTitle
}: {
  images: HttpTypes.StoreProduct['images'];
  productTitle?: string | null;
}) => {
  return (
    <div
      className="w-full rounded-sm border p-1"
      data-testid="gallery-carousel"
    >
      <ProductCarousel
        slides={images}
        productTitle={productTitle}
      />
    </div>
  );
};
