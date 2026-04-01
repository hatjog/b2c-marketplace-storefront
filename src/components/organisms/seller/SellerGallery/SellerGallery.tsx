import Image from 'next/image';

import type { SellerGalleryItem } from '@/types/seller';

interface Props {
  gallery: SellerGalleryItem[] | null | undefined;
  sellerName: string;
}

export function SellerGallery({ gallery, sellerName }: Props) {
  if (!gallery || gallery.length === 0) return null;

  return (
    <section aria-label="Galeria salonu" data-testid="seller-gallery">
      <h2 className="text-xl font-semibold mb-4">Galeria</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {gallery.map((item, i) => (
          <div key={item.url} className="relative aspect-[4/3] overflow-hidden rounded-lg cursor-zoom-in">
            <Image
              src={item.url}
              alt={item.alt ?? sellerName}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 hover:scale-105 active:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
