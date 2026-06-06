import { Suspense } from 'react';

import { getTranslations } from 'next-intl/server';

import { SellerReviewTab } from '@/components/cells';
import { TabsContent, TabsList } from '@/components/molecules';
import { AlgoliaProductsListing } from '@/components/sections/ProductListing/AlgoliaProductsListing';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import type { SellerProps } from '@/types/seller';

import { ProductListingSkeleton } from '../ProductListingSkeleton/ProductListingSkeleton';

const ALGOLIA_ID = process.env.NEXT_PUBLIC_ALGOLIA_ID;
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export const SellerTabs = async ({
  tab,
  seller,
  seller_handle,
  seller_id,
  locale,
  countryCode,
  currency_code
}: {
  tab: string;
  seller: SellerProps;
  seller_handle: string;
  seller_id: string;
  locale: string;
  countryCode: string;
  currency_code: string;
}) => {
  const commonT = await getTranslations('common');
  const sellerT = await getTranslations('seller.detail');
  const productsT = await getTranslations('products');
  const address = [
    seller.address_line,
    [seller.postal_code, seller.city].filter(Boolean).join(' '),
    seller.country_code?.toUpperCase()
  ]
    .filter(Boolean)
    .join(', ');
  const openingHours = Object.entries(seller.opening_hours ?? {}).flatMap(([day, range]) =>
    range?.open && range?.close ? [`${day}: ${range.open}-${range.close}`] : []
  );

  const tabsList = [
    { label: sellerT('products_label'), link: `/sellers/${seller_handle}/`, value: 'products' },
    { label: sellerT('about'), link: `/sellers/${seller_handle}/?tab=about`, value: 'about' },
    { label: sellerT('address_label'), link: `/sellers/${seller_handle}/?tab=location`, value: 'location' },
    {
      label: productsT('reviews'),
      link: `/sellers/${seller_handle}/reviews`,
      value: 'reviews'
    },
    { label: sellerT('policy_label'), link: `/sellers/${seller_handle}/?tab=policy`, value: 'policy' }
  ];

  return (
    <div className="space-y-6">
      <TabsList
        list={tabsList}
        activeTab={tab}
        idBase="seller-tabs"
      />
      <TabsContent
        value="products"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <Suspense
          fallback={
            <div data-testid="seller-tabs-products-loading">
              <ProductListingSkeleton />
            </div>
          }
        >
          {!ALGOLIA_ID || !ALGOLIA_SEARCH_KEY ? (
            <ProductListing
              showSidebar
              seller_id={seller_id}
              fromContext={{ type: 'seller', handle: seller_handle }}
            />
          ) : (
            <AlgoliaProductsListing
              locale={locale}
              countryCode={countryCode}
              seller_handle={seller_handle}
              currency_code={currency_code}
              fromContext={{ type: 'seller', handle: seller_handle }}
            />
          )}
        </Suspense>
      </TabsContent>
      <TabsContent
        value="about"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <section className="rounded-sm border border-[var(--bb-border-soft)] p-4">
          <h2 className="heading-sm mb-3 uppercase">{sellerT('about')}</h2>
          <p className="text-sm leading-6 text-secondary">
            {seller.description?.trim() || sellerT('no_description')}
          </p>
        </section>
      </TabsContent>
      <TabsContent
        value="location"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <section className="rounded-sm border border-[var(--bb-border-soft)] p-4">
          <h2 className="heading-sm mb-3 uppercase">{sellerT('address_label')}</h2>
          <p className="text-sm text-secondary">{address || sellerT('no_address')}</p>
          {openingHours.length > 0 && (
            <div className="mt-4">
              <h3 className="label-md mb-2 text-primary">{sellerT('opening_hours_label')}</h3>
              <ul className="space-y-1 text-sm text-secondary">
                {openingHours.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </TabsContent>
      <TabsContent
        value="reviews"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <Suspense fallback={<div data-testid="seller-tabs-reviews-loading">{commonT('loading')}</div>}>
          <SellerReviewTab seller_handle={seller_handle} />
        </Suspense>
      </TabsContent>
      <TabsContent
        value="policy"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <section className="rounded-sm border border-[var(--bb-border-soft)] p-4">
          <h2 className="heading-sm mb-3 uppercase">{sellerT('policy_label')}</h2>
          <p className="text-sm leading-6 text-secondary">{productsT('shipping_info')}</p>
        </section>
      </TabsContent>
    </div>
  );
};
