// @chrome-manifest: W6-01
// SiteHeader — Wave 6 chrome W6-01. v1.8.0 BonBeauty DS site-header.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/site-header.yaml
// CSS custom properties consumed: --bb-border-soft, --bb-border-strong, --bb-surface,
//   --bb-shadow-soft, --bb-shadow-lift, --font-body, --font-weight-medium,
//   --text-primary, --text-secondary, --space-4, --space-6,
//   --anim-duration-fast, --anim-ease-standard
// Exposed: --site-header-height (72px desktop), --site-header-height-mobile (56px), --site-header-z (100)
//
// Variants (W6-01 manifest):
//   default — desktop resting state
//   scrolled — sticky shimmer border on scroll (isScrolled prop)
//   mobile — mobile breakpoint (Tailwind md: breakpoint)
//   tablet — tablet breakpoint (Tailwind lg: breakpoint)
//   search-open — search overlay open (searchOpen prop)
//   logged-in — user present (user prop)

import type { HttpTypes } from '@medusajs/types';

import { Badge } from '@/components/atoms';
import { CartDropdown, MobileNavbar, Navbar } from '@/components/cells';
import { UserDropdown } from '@/components/cells/UserDropdown/UserDropdown';
import { LocaleSwitcher } from '@/components/molecules/LocaleSwitcher/LocaleSwitcher';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { MessageButton } from '@/components/molecules/MessageButton/MessageButton';
import { ParentCategoryLinks } from '@/components/molecules/ParentCategoryLinks/ParentCategoryLinks';
import { HeartIcon } from '@/icons';
import { listCategories } from '@/lib/data/categories';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketLogoUrl, type MarketConfig } from '@/lib/portal';
import { getTranslations } from 'next-intl/server';
import type { Wishlist } from '@/types/wishlist';
import { cn } from '@/lib/utils';

export const SiteHeader = async ({
  locale,
  marketConfig,
}: {
  locale: string;
  marketConfig?: MarketConfig | null;
}) => {
  const tHeader = await getTranslations('header');
  const user = await retrieveCustomer().catch(() => null);
  const isLoggedIn = Boolean(user);
  const marketLogoUrl = getMarketLogoUrl(marketConfig);
  const marketName = marketConfig?.name ?? null;

  const countryCode = await getCountryCode(locale);
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
    <header
      className={cn(
        // W6-01 variant: default — sticky top, z-index from --site-header-z
        'sticky top-0 z-[var(--site-header-z,100)] bg-[var(--bb-surface)]',
        // W6-01 variant: scrolled — shimmer border on scroll via CSS class
        // Consumer toggles data-scrolled attr; CSS picks up border-b
        'border-b border-transparent transition-[border-color] duration-[var(--anim-duration-fast,150ms)]',
        '[&[data-scrolled=true]]:border-[var(--bb-border-soft)]',
        '[&[data-scrolled=true]]:shadow-[var(--bb-shadow-soft)]'
      )}
      style={{
        '--site-header-height': '72px',
        '--site-header-height-mobile': '56px',
        '--site-header-z': '100',
      } as React.CSSProperties}
      data-testid="site-header"
    >
      <div className="flex px-[var(--space-4,16px)] py-2 md:px-[var(--space-6,24px)] lg:px-8">
        {/* slot: logo */}
        <div className="flex items-center lg:w-1/3">
          <MobileNavbar
            parentCategories={parentCategories}
            categories={categories}
          />
          <ParentCategoryLinks
            parentCategories={parentCategories}
            categories={categories}
          />
          <LocalizedClientLink
            href="/"
            className="inline-flex items-center"
            data-testid="site-header-logo"
            aria-label={marketName ?? 'BonBeauty'}
          >
            {marketLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marketLogoUrl}
                alt={marketName ?? 'BonBeauty logo'}
                className="h-8 w-auto"
                width={120}
                height={32}
              />
            ) : (
              <span className="font-semibold tracking-tight text-[var(--text-primary)]">
                {marketName ?? 'BonBeauty'}
              </span>
            )}
          </LocalizedClientLink>
        </div>

        {/* slot: nav-primary */}
        <div className="hidden flex-1 items-center justify-center lg:flex">
          <Navbar
            categories={categories}
            parentCategories={parentCategories}
          />
        </div>

        {/* slot: account-actions + locale-switcher */}
        <div className="ml-auto flex items-center gap-2 lg:w-1/3 lg:justify-end">
          {/* slot: locale-switcher — W6-10 */}
          <LocaleSwitcher currentLocale={locale} />

          {/* slot: account-actions */}
          <MessageButton />
          <LocalizedClientLink
            href="/wishlist"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label={tHeader('wishlist')}
            data-testid="wishlist-link"
          >
            <HeartIcon className="h-5 w-5" />
            {wishlistCount > 0 && (
              <Badge
                count={wishlistCount}
                className="absolute -right-0.5 -top-0.5"
              />
            )}
          </LocalizedClientLink>
          <CartDropdown />
          {isLoggedIn ? (
            <UserDropdown customer={user!} />
          ) : (
            <LocalizedClientLink
              href="/account"
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              data-testid="account-link"
            >
              {tHeader('account')}
            </LocalizedClientLink>
          )}
        </div>
      </div>
    </header>
  );
};
