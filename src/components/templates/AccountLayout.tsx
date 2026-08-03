import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/molecules/Breadcrumbs/Breadcrumbs';

export type AccountSurface =
  | 'W2-01'
  | 'W2-02'
  | 'W2-03'
  | 'W2-04'
  | 'W2-05'
  | 'W2-06'
  | 'W2-07'
  | 'W2-08'
  | 'W2-09'
  | 'W2-10'
  | 'W2-11'
  | 'W2-12'
  | 'W2-13';

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  description?: string;
  ariaLabel?: string;
}

export interface SnapshotSection {
  id: string;
  label: string;
  value: React.ReactNode;
}

export interface AccountLayoutProps {
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  } | null;
  activeSurface: AccountSurface;
  quickActions?: QuickAction[];
  snapshotSections?: SnapshotSection[];
  locale: string;
  t: (key: string) => string;
  breadcrumbs?: BreadcrumbItem[];
  headerSlot: React.ReactNode;
  mainContent: React.ReactNode;
  footerSlot: React.ReactNode;
}

export type AccountUser = AccountLayoutProps['user'];

// Surface label mapping aligned with v1.8.0 Account Hub ownership:
// - Story 4.2 read-heavy: W2-01 dashboard, W2-02 voucher history, W2-03 order
//   history, W2-04 order detail, W2-07 returns history, W2-09 wishlist,
//   W2-12 messages.
// - Story 4.3 write-heavy: W2-05 return request, W2-06 return success,
//   W2-08 saved addresses, W2-10 reviews to write, W2-11 written reviews,
//   W2-13 account settings.
// The labels MUST reflect the surface that actually renders at the route,
// otherwise sidebar nav `aria-current="page"` highlights an item whose label
// describes a different page (Epic-4-Review F-01 — half-fix from Wave A L4
// covered write-heavy only; v1.9.0 Wave F7 completes the read-heavy half).
const SURFACE_NAV: Array<{ surface: AccountSurface; key: string; href: string }> = [
  { surface: 'W2-01', key: 'dashboard', href: '/user' },
  { surface: 'W2-02', key: 'voucher_history', href: '/user/vouchers' },
  { surface: 'W2-03', key: 'order_history', href: '/user/orders' },
  { surface: 'W2-04', key: 'order_detail', href: '/user/orders' },
  { surface: 'W2-05', key: 'return_request', href: '/user/orders' },
  { surface: 'W2-06', key: 'return_success', href: '/user/orders' },
  { surface: 'W2-07', key: 'returns_history', href: '/user/returns' },
  { surface: 'W2-08', key: 'saved_addresses', href: '/user/addresses' },
  { surface: 'W2-09', key: 'wishlist', href: '/user/wishlist' },
  { surface: 'W2-10', key: 'reviews_to_write', href: '/user/reviews' },
  { surface: 'W2-11', key: 'written_reviews', href: '/user/reviews/written' },
  { surface: 'W2-12', key: 'messages', href: '/user/messages' },
  { surface: 'W2-13', key: 'account_settings', href: '/user/settings' },
];

function localizedHref(locale: string, href: string) {
  if (!href) return href;
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) return href;
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href;
  if (href.startsWith('/')) return `/${locale}${href}`;
  return `/${locale}/${href}`;
}

export function AccountLayout({
  user,
  activeSurface,
  quickActions = [],
  snapshotSections = [],
  locale,
  t,
  breadcrumbs = [],
  headerSlot,
  mainContent,
  footerSlot,
}: AccountLayoutProps) {
  const initials = user?.displayName
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'BB';

  return (
    <div
      className="min-h-screen"
      style={
        {
          background: 'var(--bb-page-bg, #F9F4EC)',
          color: 'var(--text-primary)',
          '--account-nav-width': '260px',
          '--account-sidebar-width': '280px',
          '--account-content-max-width': '1fr',
        } as React.CSSProperties
      }
      data-testid="account-layout"
    >
      {/* Skip-to-main link — first focusable element (Story 0.13 a11y contract) */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[9999] focus-visible:rounded-sm focus-visible:bg-action focus-visible:px-4 focus-visible:py-2 focus-visible:text-action-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,var(--accent,#A89279))]"
      >
        {t('a11y.skip_to_main')}
      </a>

      {/* Slot: header — Wave 6 chrome (SiteHeader) */}
      {headerSlot}

      <div className="bb-page-shell">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start xl:grid-cols-[var(--account-nav-width)_minmax(0,var(--account-content-max-width))_var(--account-sidebar-width)] xl:gap-8">
          <aside
            role="complementary"
            className="order-2 min-w-0 xl:order-1 xl:sticky xl:top-[var(--space-12,48px)]"
            data-testid="account-layout-nav-column"
          >
            <div className="rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-82)] p-4 shadow-[var(--bb-shadow-card)]">
              <div className="mb-4 flex items-center gap-3 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-sm font-medium text-[var(--text-primary)]">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {user?.displayName ?? t('snapshot.empty')}
                  </p>
                  {user?.email ? (
                    <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                  ) : null}
                </div>
              </div>

              <nav aria-label={t('nav.aria_label')} data-testid="account-layout-nav">
                <ul className="flex flex-col gap-1">
                  {SURFACE_NAV.map(({ surface, key, href }) => {
                    const active = surface === activeSurface;
                    const label = t(`nav.items.${key}`);
                    return (
                      <li key={surface}>
                        <Link
                          href={localizedHref(locale, href)}
                          className={cn(
                            'flex min-h-11 items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-[var(--color-selected-bg)] text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bb-surface-muted)] hover:text-[var(--text-primary)]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,var(--accent,#A89279))]'
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          <span>{label}</span>
                          <span className="text-xs text-[var(--text-muted)]" aria-hidden="true">
                            {surface}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </aside>

          <main
            id="main-content"
            role="main"
            className={cn(
              'order-1 min-w-0',
              'xl:order-2'
            )}
          >
            {breadcrumbs.length > 0 && (
              <div className="mb-4">
                <Breadcrumbs items={breadcrumbs} />
              </div>
            )}

            <section
              className="mb-6 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-strong)] p-5 shadow-[var(--bb-shadow-soft)] md:p-7"
              aria-label={t('hero.aria_label')}
              data-testid="account-layout-hero"
            >
              <div className="flex flex-col gap-2">
                <p className="bb-eyebrow">
                  {t('hero.eyebrow')}
                </p>
                <h1
                  className="text-2xl font-semibold leading-tight text-[var(--text-primary)] md:text-3xl"
                >
                  {user ? t('hero.greeting_with_name').replace('{name}', user.displayName) : t('hero.greeting')}
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t('hero.subtitle')}
                </p>
              </div>

              {quickActions.length > 0 && (
                <nav className="mt-6" aria-label={t('quick_actions.aria_label')} data-testid="account-layout-quick-actions">
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {quickActions.map((action) => (
                      <li key={action.id}>
                        <Link
                          href={localizedHref(locale, action.href)}
                          className={cn(
                            'block h-full rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4 shadow-[var(--bb-shadow-card)] transition-transform',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,var(--accent,#A89279))]',
                            'hover:-translate-y-0.5'
                          )}
                          aria-label={action.ariaLabel ?? action.label}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">{action.label}</span>
                            {action.description && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {action.description}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </section>

            <section className="bb-section-shell" aria-label={t('content.aria_label')} data-testid="account-layout-content">
              {mainContent}
            </section>
          </main>

          <aside
            role="complementary"
            aria-label={t('sidebar.aria_label')}
            className={cn(
              'order-3 min-w-0',
              'md:order-3 xl:order-3 xl:sticky xl:top-[var(--space-12,48px)]'
            )}
            data-testid="account-layout-sidebar"
          >
            <div
              className="bb-section-shell bb-section-shell-strong"
              style={{
                background: 'var(--bb-surface-strong)',
                borderColor: 'var(--bb-border-soft)',
                boxShadow: 'var(--bb-shadow-card)',
                borderRadius: 'var(--bb-radius-panel)',
              }}
            >
              <div>
                <h2 className="text-sm font-semibold">{t('snapshot.heading')}</h2>

                {user === null ? (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('snapshot.empty')}
                  </p>
                ) : snapshotSections.length === 0 ? (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('snapshot.empty')}
                  </p>
                ) : (
                  <dl className="mt-4 space-y-3">
                    {snapshotSections.map((section) => (
                      <div key={section.id} className="bb-card-muted">
                        <dt className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          {section.label}
                        </dt>
                        <dd className="mt-1 text-sm">{section.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Slot: footer — Wave 6 chrome (SiteFooter) */}
      {footerSlot}
    </div>
  );
}
