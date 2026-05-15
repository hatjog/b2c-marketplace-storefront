'use client';

// @chrome-manifest: W6-07
// MobileBottomNav — Wave 6 chrome W6-07. v1.8.0 BonBeauty DS mobile-bottom-nav.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/mobile-bottom-nav.yaml
// 5 tabs: Home / Search / Cart / Wishlist / Account
// Hidden on tablet+ (md: breakpoint). Hidden during checkout (hideOnCheckout prop).
// CSS custom properties: --bb-surface, --bb-shadow-lift, --bb-border-hairline,
//   --bg-action, --text-primary, --text-secondary, --text-on-action, --cta,
//   --color-error, --font-body, --font-weight-medium, --space-1, --space-2, --space-4,
//   --radius-xs, --anim-duration-fast
// Exposed: --mobile-nav-height (64px), --mobile-nav-z (90), --mobile-nav-safe-area

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  locale: string;
  cartCount?: number;
  wishlistCount?: number;
  hideOnCheckout?: boolean;
  className?: string;
}

function localizedHref(locale: string, path: string) {
  return `/${locale}${path}`;
}

export function MobileBottomNav({
  locale,
  cartCount = 0,
  wishlistCount = 0,
  hideOnCheckout = true,
  className,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  // Hide during checkout (W6-07 spec: hidden during checkout)
  const isCheckout = hideOnCheckout && pathname.includes('/checkout');
  if (isCheckout) return null;

  const tabs = [
    { id: 'home', label: 'Home', href: localizedHref(locale, '/'), icon: '🏠', badge: 0 },
    { id: 'search', label: 'Szukaj', href: localizedHref(locale, '/categories'), icon: '🔍', badge: 0 },
    { id: 'cart', label: 'Koszyk', href: localizedHref(locale, '/cart'), icon: '🛒', badge: cartCount },
    { id: 'wishlist', label: 'Ulubione', href: localizedHref(locale, '/wishlist'), icon: '🤍', badge: wishlistCount },
    { id: 'account', label: 'Konto', href: localizedHref(locale, '/account'), icon: '👤', badge: 0 },
  ] as const;

  function isActive(tabId: string) {
    if (tabId === 'home') return pathname === `/${locale}` || pathname === `/${locale}/`;
    if (tabId === 'search') return pathname.startsWith(`/${locale}/categories`);
    if (tabId === 'cart') return pathname.startsWith(`/${locale}/cart`);
    if (tabId === 'wishlist') return pathname.startsWith(`/${locale}/wishlist`);
    if (tabId === 'account') return pathname.startsWith(`/${locale}/account`);
    return false;
  }

  return (
    <nav
      className={cn(
        // W6-07 variant: mobile-only — hidden on md+ (tablet breakpoint)
        'fixed bottom-0 left-0 right-0 z-[var(--mobile-nav-z,90)] md:hidden',
        'border-t border-[var(--bb-border-hairline,var(--bb-border-soft))] bg-[var(--bb-surface)]',
        'shadow-[var(--bb-shadow-lift)]',
        // Safe area for iOS notch
        'pb-[env(safe-area-inset-bottom,0px)]'
      )}
      style={{
        '--mobile-nav-height': '64px',
        '--mobile-nav-z': '90',
        '--mobile-nav-safe-area': 'env(safe-area-inset-bottom, 0px)',
      } as React.CSSProperties}
      aria-label="Nawigacja mobilna"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex h-16 items-center justify-around px-1">
        {tabs.map((tab) => {
          const active = isActive(tab.id);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium',
                'transition-colors duration-[var(--anim-duration-fast,150ms)]',
                active
                  ? 'text-[var(--bg-action)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              aria-current={active ? 'page' : undefined}
              data-testid={`mobile-nav-tab-${tab.id}`}
            >
              <span className="relative text-xl leading-none" aria-hidden="true">
                {tab.icon}
                {tab.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-error)] px-0.5 text-[9px] font-semibold text-white">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
