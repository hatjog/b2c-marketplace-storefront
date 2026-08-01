// Legacy component — not exported from organisms barrel and not rendered by any app surface.
// Kept as migration reference; safe to remove in a dedicated cleanup pass.
import type { HttpTypes } from '@medusajs/types';

import { Badge, LogoLockup } from '@/components/atoms';
import { CartDropdown, MobileNavbar, Navbar } from '@/components/cells';
import { UserDropdown } from '@/components/cells/UserDropdown/UserDropdown';
import { LanguageSwitcher } from '@/components/molecules/LanguageSwitcher/LanguageSwitcher';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { MessageButton } from '@/components/molecules/MessageButton/MessageButton';
import { ParentCategoryLinks } from '@/components/molecules/ParentCategoryLinks/ParentCategoryLinks';
import { HeartIcon } from '@/icons';
import { listCategories } from '@/lib/data/categories';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { resolveMarketLocales } from '@/lib/market-locales';
import type { MarketConfig } from '@/lib/portal';
import { getTranslations } from 'next-intl/server';
import type { Wishlist } from '@/types/wishlist';

export const Header = async ({
  locale
}: {
  locale: string;
  // Accepted for caller backward-compat but unused: the header now renders the
  // brand lockup (not the market-configured logo). See LogoLockup below.
  marketConfig?: MarketConfig | null;
}) => {
  // QD-03 (CAP-3): jawne locale — chrome zawsze odpowiada locale trasy.
  const tHeader = await getTranslations({ locale, namespace: 'header' });
  const user = await retrieveCustomer().catch(() => null);
  const isLoggedIn = Boolean(user);

  const countryCode = await getCountryCode(locale);
  const { supported: marketSupportedLocales } = await resolveMarketLocales();
  let wishlist: Wishlist = { products: [] };
  if (user) {
    wishlist = await getUserWishlists({ countryCode });
  }

  const wishlistCount = wishlist?.products.length || 0;

  const { categories, parentCategories } = (await listCategories({
    query: { include_ancestors_tree: true }
  })) as {
    categories: HttpTypes.StoreProductCategory[];
    parentCategories: HttpTypes.StoreProductCategory[];
  };
  return (
    <header className="sticky top-0 z-20 bg-primary" data-testid="header">
      <div
        className="flex px-4 py-2 md:px-5 lg:px-8"
        data-testid="header-top"
      >
        <div className="flex items-center lg:w-1/3">
          <MobileNavbar
            parentCategories={parentCategories}
            categories={categories}
          />
          <ParentCategoryLinks
            parentCategories={parentCategories}
            categories={categories}
          />
        </div>
        <div className="flex items-center pl-4 lg:w-1/3 lg:justify-center lg:pl-0">
          <LogoLockup
            locale={locale}
            variant="light"
            className="flex items-center gap-2"
            data-testid="header-logo-link"
          />
        </div>
        <div
          className="flex w-full items-center justify-end gap-2 py-2 lg:w-1/3 lg:gap-4"
          data-testid="header-actions"
        >
          <LanguageSwitcher currentLocale={locale} supportedLocales={marketSupportedLocales} />
          {isLoggedIn && <MessageButton />}
          <UserDropdown isLoggedIn={isLoggedIn} />
          {isLoggedIn && (
            <LocalizedClientLink
              href="/user/wishlist"
              locale={locale}
              className="relative"
              aria-label={tHeader('wishlist')}
              data-testid="header-wishlist-link"
            >
              <HeartIcon size={20} />
              {Boolean(wishlistCount) && (
                <Badge
                  className="absolute -right-2 -top-2 h-4 w-4 p-0"
                  data-testid="wishlist-count-badge"
                >
                  {wishlistCount}
                </Badge>
              )}
            </LocalizedClientLink>
          )}

          <CartDropdown />
        </div>
      </div>
      <Navbar
        categories={categories}
        parentCategories={parentCategories}
      />
    </header>
  );
};
