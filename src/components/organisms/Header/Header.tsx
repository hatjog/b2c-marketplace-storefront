import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';

import { Badge } from '@/components/atoms';
import { CartDropdown, MobileNavbar, Navbar } from '@/components/cells';
import { UserDropdown } from '@/components/cells/UserDropdown/UserDropdown';
import CountrySelector from '@/components/molecules/CountrySelector/CountrySelector';
import { LanguageSwitcher } from '@/components/molecules/LanguageSwitcher/LanguageSwitcher';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { MessageButton } from '@/components/molecules/MessageButton/MessageButton';
import { ParentCategoryLinks } from '@/components/molecules/ParentCategoryLinks/ParentCategoryLinks';
import { HeartIcon } from '@/icons';
import { listCategories } from '@/lib/data/categories';
import { retrieveCustomer } from '@/lib/data/customer';
import { listRegions } from '@/lib/data/regions';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketLogoUrl, type MarketConfig } from '@/lib/portal';
import type { Wishlist } from '@/types/wishlist';

export const Header = async ({
  locale,
  marketConfig
}: {
  locale: string;
  marketConfig?: MarketConfig | null;
}) => {
  const user = await retrieveCustomer().catch(() => null);
  const isLoggedIn = Boolean(user);
  const marketLogoUrl = getMarketLogoUrl(marketConfig);
  const logoSrc = marketLogoUrl || '/Logo.svg';

  const countryCode = await getCountryCode(locale);
  let wishlist: Wishlist = { products: [] };
  if (user) {
    wishlist = await getUserWishlists({ countryCode });
  }

  const regions = await listRegions();

  const wishlistCount = wishlist?.products.length || 0;

  const { categories, parentCategories } = (await listCategories({
    query: { include_ancestors_tree: true }
  })) as {
    categories: HttpTypes.StoreProductCategory[];
    parentCategories: HttpTypes.StoreProductCategory[];
  };
  return (
    <header data-testid="header">
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
          <LocalizedClientLink
            href="/"
            className="text-2xl font-bold"
            data-testid="header-logo-link"
          >
            <Image
              src={logoSrc}
              width={126}
              height={40}
              alt="Logo"
              priority
            />
          </LocalizedClientLink>
        </div>
        <div
          className="flex w-full items-center justify-end gap-2 py-2 lg:w-1/3 lg:gap-4"
          data-testid="header-actions"
        >
          <CountrySelector regions={regions} />
          <LanguageSwitcher currentLocale={locale} />
          {isLoggedIn && <MessageButton />}
          <UserDropdown isLoggedIn={isLoggedIn} />
          {isLoggedIn && (
            <LocalizedClientLink
              href="/user/wishlist"
              className="relative"
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
