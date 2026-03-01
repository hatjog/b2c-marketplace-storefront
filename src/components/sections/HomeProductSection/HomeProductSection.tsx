import type { HttpTypes } from '@medusajs/types';

import { HomeProductsCarousel } from '@/components/organisms';
import type { Product } from '@/types/product';

export const HomeProductSection = async ({
  heading,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'pl',
  products = [],
  home = false,
  maxItems = 4
}: {
  heading: string;
  locale?: string;
  products?: (Product | HttpTypes.StoreProduct)[];
  home?: boolean;
  maxItems?: number;
}) => {
  const resolvedMaxItems = Math.max(1, maxItems);

  return (
    <section className="w-full py-8">
      <h2 className="heading-lg mb-6 font-bold uppercase tracking-tight">{heading}</h2>
      <HomeProductsCarousel
        locale={locale}
        sellerProducts={products.slice(0, resolvedMaxItems)}
        home={home}
      />
    </section>
  );
};
