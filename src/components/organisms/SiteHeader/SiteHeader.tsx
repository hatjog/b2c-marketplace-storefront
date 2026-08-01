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

import { Badge, LogoLockup } from '@/components/atoms';
import { CartDropdown, MobileNavbar } from '@/components/cells';
import { UserDropdown } from '@/components/cells/UserDropdown/UserDropdown';
import { HeaderSearch } from '@/components/molecules/HeaderSearch/HeaderSearch';
import { LocaleSwitcher } from '@/components/molecules/LocaleSwitcher/LocaleSwitcher';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { SiteNav } from '@/components/molecules/SiteNav/SiteNav';
import { HeartIcon } from '@/icons';
import { listCategories } from '@/lib/data/categories';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { resolveMarketLocales } from '@/lib/market-locales';
import type { MarketConfig } from '@/lib/portal';
import { getTranslations } from 'next-intl/server';
import type { Wishlist } from '@/types/wishlist';
import { cn } from '@/lib/utils';

export const SiteHeader = async ({
  locale,
}: {
  locale: string;
  // Accepted for caller backward-compat but intentionally unused: the header
  // now renders the brand lockup (not the market-configured logo). See LogoLockup below.
  marketConfig?: MarketConfig | null;
}) => {
  // QD-03 (CAP-3): jawne locale — chrome zawsze odpowiada locale trasy.
  const tHeader = await getTranslations({ locale, namespace: 'header' });
  const user = await retrieveCustomer().catch(() => null);
  const isLoggedIn = Boolean(user);
  const countryCode = await getCountryCode(locale);
  // Story 1.1 v1.14.0 F3 — filter the switcher to what THIS market exposes,
  // not the compile-time platform superset (AC3 single-source).
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
        <div className="flex min-w-0 items-center gap-4 lg:w-1/3">
          <MobileNavbar
            parentCategories={parentCategories}
            categories={categories}
          />
          {/* Brand lockup parity (v1.12.0 chrome fix): render the BonBeauty
              monogram + wordmark like SiteFooter — NOT the market-configured
              Payload logo (off-brand placeholder). 4-3 AC = "monogram + wordmark". */}
          <LogoLockup
            variant="light"
            data-testid="site-header-logo"
          />
        </div>

        {/* slot: nav-primary — W6-01 contract-A text nav (Kategorie · Salony ·
            Polecane · Blog · Pomoc), replacing the legacy category dropdown. */}
        <div className="hidden min-w-0 flex-1 items-center justify-center overflow-hidden lg:flex">
          <SiteNav />
        </div>

        {/* slot: account-actions — order per BB-v1.8.0 mockup:
            Szukaj · PL · Konto · Lista życzeń · Koszyk (chat removed). */}
        <div className="ml-auto flex items-center gap-2 lg:w-1/3 lg:justify-end">
          {/* Search / account / wishlist / cart live in MobileBottomNav (W6-07)
              on mobile — hide them here to declutter the top bar (avoids the
              search icon overlapping the wordmark). Locale stays on every size. */}
          <div className="hidden lg:block">
            <HeaderSearch locale={locale} />
          </div>

          {/* slot: locale-switcher — W6-10 */}
          <LocaleSwitcher currentLocale={locale} supportedLocales={marketSupportedLocales} />

          <div className="hidden items-center gap-2 lg:flex">
            {isLoggedIn ? (
              <UserDropdown isLoggedIn />
            ) : (
              <LocalizedClientLink
                href="/user/account"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                aria-label={tHeader('account')}
                data-testid="account-link"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </LocalizedClientLink>
            )}

            <LocalizedClientLink
              href="/user/wishlist"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label={tHeader('wishlist')}
              data-testid="wishlist-link"
            >
              <HeartIcon className="h-5 w-5" />
              {wishlistCount > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5">{wishlistCount}</Badge>
              )}
            </LocalizedClientLink>
            <CartDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};
