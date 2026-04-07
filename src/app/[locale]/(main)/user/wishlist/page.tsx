import type { HttpTypes } from '@medusajs/types';
import { isEmpty } from 'lodash';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/atoms';
import { WishlistItem } from '@/components/cells';
import { UserNavigation } from '@/components/molecules';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import type { Wishlist as WishlistType } from '@/types/wishlist';

export default async function Wishlist({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations('wishlist');
  const user = await retrieveCustomer();
  const { locale } = await params;

  const countryCode = await getCountryCode(locale);
  let wishlist: WishlistType = { products: [] };
  if (user) {
    wishlist = await getUserWishlists({ countryCode });
  }

  const count = wishlist?.products?.length || 0;

  if (!user) {
    redirect('/login');
  }

  return (
    <main
      id="main-content"
      className="bb-page-shell"
      data-testid="wishlist-page"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div
          className="space-y-8 md:col-span-3"
          data-testid="wishlist-container"
        >
          {isEmpty(wishlist?.products) ? (
            <div
              className="bb-section-shell bb-section-shell-strong mx-auto flex max-w-xl flex-col items-center justify-center text-center"
              data-testid="wishlist-empty-state"
            >
              <h2
                className="heading-lg mb-2 text-primary"
                data-testid="wishlist-empty-heading"
              >
                {t('title')}
              </h2>
              <p
                className="mb-6 text-lg text-secondary"
                data-testid="wishlist-empty-description"
              >
                {t('empty_description')}
              </p>
              <LocalizedClientLink
                href="/categories"
                className="w-full"
              >
                <Button
                  className="w-full rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
                  data-testid="wishlist-explore-button"
                >
                  {t('explore')}
                </Button>
              </LocalizedClientLink>
            </div>
          ) : (
            <div className="bb-section-shell flex flex-col gap-6">
              <h2
                className="heading-lg text-primary"
                data-testid="wishlist-heading"
              >
                {t('title')}
              </h2>
              <div className="flex items-center justify-between">
                <p data-testid="wishlist-count">{t('count', { count })}</p>
              </div>
              <div
                className="flex flex-wrap gap-4 max-md:justify-center"
                data-testid="wishlist-products-list"
              >
                {wishlist?.products?.map(product => (
                  <WishlistItem
                    key={product.id}
                    product={
                      product as HttpTypes.StoreProduct & {
                        calculated_amount: number;
                        currency_code: string;
                      }
                    }
                    wishlist={wishlist}
                    user={user}
                    testIdPrefix={`wishlist-item-${product.id}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
