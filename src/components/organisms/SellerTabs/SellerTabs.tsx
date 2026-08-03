import { Suspense } from 'react';

import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

import { SellerReviewTab } from '@/components/cells';
import { TabsContent, TabsList } from '@/components/molecules';
import { AlgoliaProductsListing } from '@/components/sections/ProductListing/AlgoliaProductsListing';
import { ProductListing } from '@/components/sections/ProductListing/ProductListing';
import type { SellerProps } from '@/types/seller';

import { ProductListingSkeleton } from '../ProductListingSkeleton/ProductListingSkeleton';

const ALGOLIA_ID = process.env.NEXT_PUBLIC_ALGOLIA_ID;
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_ALIASES: Record<string, number> = {
  monday: 0,
  mon: 0,
  poniedzialek: 0,
  pon: 0,
  tuesday: 1,
  tue: 1,
  wtorek: 1,
  wt: 1,
  wednesday: 2,
  wed: 2,
  sroda: 2,
  sr: 2,
  thursday: 3,
  thu: 3,
  czwartek: 3,
  czw: 3,
  friday: 4,
  fri: 4,
  piatek: 4,
  pt: 4,
  saturday: 5,
  sat: 5,
  sobota: 5,
  sob: 5,
  sunday: 6,
  sun: 6,
  niedziela: 6,
  nd: 6
};

function normalizeDayKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function getTodayIndex(locale: string): number {
  const day = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date());
  return DAY_ALIASES[normalizeDayKey(day)] ?? (new Date().getDay() + 6) % 7;
}

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
  // QD-03 (CAP-3): jawne locale — to samo, którym komponent formatuje daty
  // (`getTodayIndex(locale)`); tłumaczenia nie mogą iść z innego źródła.
  const commonT = await getTranslations({ locale, namespace: 'common' });
  const sellerT = await getTranslations({ locale, namespace: 'seller.detail' });
  const productsT = await getTranslations({ locale, namespace: 'products' });
  const todayIndex = getTodayIndex(locale);
  const address = [
    seller.address_line,
    [seller.postal_code, seller.city].filter(Boolean).join(' '),
    seller.country_code?.toUpperCase()
  ]
    .filter(Boolean)
    .join(', ');
  const openingHours = Object.entries(seller.opening_hours ?? {})
    .flatMap(([day, range]) => {
      if (!range?.open || !range?.close) return [];
      const normalizedDay = normalizeDayKey(day);
      const dayIndex = DAY_ALIASES[normalizedDay] ?? DAY_ORDER.indexOf(normalizedDay);
      return [
        {
          day,
          hours: `${range.open}-${range.close}`,
          dayIndex,
          isToday: dayIndex === todayIndex
        }
      ];
    })
    .sort((a, b) => {
      if (a.dayIndex === -1 && b.dayIndex === -1) return a.day.localeCompare(b.day, locale);
      if (a.dayIndex === -1) return 1;
      if (b.dayIndex === -1) return -1;
      return a.dayIndex - b.dayIndex;
    });
  const gallery = seller.gallery?.filter(item => item?.url).slice(0, 6) ?? [];
  const policy = seller.policy?.trim();

  const tabsList = [
    { label: sellerT('products_label'), link: `/sellers/${seller_handle}/`, value: 'products' },
    { label: sellerT('about'), link: `/sellers/${seller_handle}/?tab=about`, value: 'about' },
    {
      label: sellerT('address_label'),
      link: `/sellers/${seller_handle}/?tab=location`,
      value: 'location'
    },
    {
      label: productsT('reviews'),
      link: `/sellers/${seller_handle}/reviews`,
      value: 'reviews'
    },
    {
      label: sellerT('policy_label'),
      link: `/sellers/${seller_handle}/?tab=policy`,
      value: 'policy'
    }
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
              locale={locale}
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
        <section
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4"
          data-testid="seller-tab-about"
        >
          <h2 className="heading-sm mb-3 uppercase">{sellerT('about')}</h2>
          <p className="text-sm leading-6 text-secondary">
            {seller.description?.trim() || sellerT('no_description')}
          </p>
          {gallery.length > 0 ? (
            <div
              className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="seller-gallery-6"
            >
              {gallery.map((item, index) => (
                <div
                  key={`${item.url}-${index}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)]"
                >
                  <Image
                    src={item.url}
                    alt={item.alt ?? sellerT('gallery_alt', { name: seller.name })}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </TabsContent>
      <TabsContent
        value="location"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <section
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4"
          data-testid="seller-tab-location"
        >
          <h2 className="heading-sm mb-3 uppercase">{sellerT('address_label')}</h2>
          <p className="text-sm text-secondary">{address || sellerT('no_address')}</p>
          {openingHours.length > 0 && (
            <div className="mt-4">
              <h3 className="label-md mb-2 text-primary">{sellerT('opening_hours_label')}</h3>
              <table
                className="w-full border-separate border-spacing-0 overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] text-sm"
                data-testid="seller-hours-table"
              >
                <tbody>
                  {openingHours.map(item => (
                    <tr
                      key={item.day}
                      className={
                        item.isToday ? 'bg-[var(--gold-light)] text-primary' : 'text-secondary'
                      }
                      data-testid={item.isToday ? 'seller-hours-today' : undefined}
                    >
                      <th className="border-b border-[var(--bb-border-soft)] px-3 py-2 text-left font-medium">
                        {item.day}
                      </th>
                      <td className="border-b border-[var(--bb-border-soft)] px-3 py-2 text-right">
                        {item.hours}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </TabsContent>
      <TabsContent
        value="reviews"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <Suspense
          fallback={<div data-testid="seller-tabs-reviews-loading">{commonT('loading')}</div>}
        >
          <SellerReviewTab seller_handle={seller_handle} />
        </Suspense>
      </TabsContent>
      <TabsContent
        value="policy"
        activeTab={tab}
        idBase="seller-tabs"
      >
        <section
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4"
          data-testid="seller-tab-policy"
        >
          <h2 className="heading-sm mb-3 uppercase">{sellerT('policy_label')}</h2>
          {policy ? (
            <p className="text-sm leading-6 text-secondary">{policy}</p>
          ) : (
            <p className="text-sm leading-6 text-secondary">{sellerT('no_policy')}</p>
          )}
        </section>
      </TabsContent>
    </div>
  );
};
