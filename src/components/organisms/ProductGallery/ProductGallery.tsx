import type { HttpTypes } from '@medusajs/types';

import { GalleryCarousel } from '@/components/organisms';

export const ProductGallery = ({
  images,
  productTitle
}: {
  images: HttpTypes.StoreProduct['images'];
  productTitle?: string | null;
}) => {
  if (!images || images.length === 0) return null;

  return (
    <div data-testid="product-gallery">
      <GalleryCarousel
        images={images}
        productTitle={productTitle}
      />
    </div>
  );
};
