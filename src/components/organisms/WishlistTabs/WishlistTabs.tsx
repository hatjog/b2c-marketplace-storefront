import { Suspense } from 'react';

import { getTranslations } from 'next-intl/server';

import { TabsContent, TabsList } from '@/components/molecules';

// import { ProductsList } from "../ProductsList/ProductsList"
import { ProductsPagination } from '../ProductsPagination/ProductsPagination';

// import { listProducts } from "@/lib/data/products"

export const WishlistTabs = async ({ tab }: { tab: string }) => {
  const t = await getTranslations('wishlist');
  const commonT = await getTranslations('common');

  const wishlistTabs = [
    { label: t('all'), link: '/wishlist', value: 'all' },
    { label: t('products'), link: '/wishlist/products', value: 'products' },
    { label: t('collections'), link: '/wishlist/collections', value: 'collections' }
  ];

  // const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "gb"

  // const { response } = await listProducts({
  //   countryCode: DEFAULT_REGION,
  // })
  // const { products } = await response

  return (
    <div>
      <TabsList
        list={wishlistTabs}
        activeTab={tab}
      />
      <TabsContent
        value="all"
        activeTab={tab}
      >
        <Suspense fallback={<>{commonT('loading')}</>}>
          <div className="mt-8 grid sm:grid-cols-2 xl:grid-cols-4">
            {/* <ProductsList products={products} /> */}
          </div>
          <ProductsPagination pages={2} />
        </Suspense>
      </TabsContent>
      <TabsContent
        value="products"
        activeTab={tab}
      >
        <Suspense fallback={<>{commonT('loading')}</>}>
          <div className="mt-8 grid sm:grid-cols-2 xl:grid-cols-4">
            {/* <ProductsList products={products} /> */}
          </div>
          <ProductsPagination pages={2} />
        </Suspense>
      </TabsContent>
      <TabsContent
        value="collections"
        activeTab={tab}
      >
        <Suspense fallback={<>{commonT('loading')}</>}>
          <div className="mt-8 grid sm:grid-cols-2 xl:grid-cols-4">
            {/* <ProductsList products={products} /> */}
          </div>
          <ProductsPagination pages={2} />
        </Suspense>
      </TabsContent>
    </div>
  );
};
