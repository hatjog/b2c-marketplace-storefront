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

const SURFACE_NAV: Array<{ surface: AccountSurface; key: string }> = [
  { surface: 'W2-01', key: 'dashboard' },
  { surface: 'W2-02', key: 'order_history' },
  { surface: 'W2-03', key: 'order_detail' },
  { surface: 'W2-04', key: 'active_vouchers' },
  { surface: 'W2-05', key: 'used_vouchers' },
  { surface: 'W2-06', key: 'addresses' },
  { surface: 'W2-07', key: 'payment_methods' },
  { surface: 'W2-08', key: 'notifications' },
  { surface: 'W2-09', key: 'loyalty' },
  { surface: 'W2-10', key: 'referrals' },
  { surface: 'W2-11', key: 'profile' },
  { surface: 'W2-12', key: 'password' },
  { surface: 'W2-13', key: 'delete_account' },
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
  return (
    <div
      className="min-h-screen"
      style={
        {
          background: 'var(--bb-page-bg, #F3F1ED)',
          color: 'var(--text-primary)',
          '--account-sidebar-width': '280px',
          '--account-content-max-width': '860px',
          '--account-hero-min-height': '140px',
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start xl:grid-cols-[minmax(0,1fr)_var(--account-sidebar-width)] xl:gap-8">
          <main
            id="main-content"
            role="main"
            className={cn(
              'order-1 min-w-0',
              // Tablet: keep main first; Desktop: allow wider content
              'xl:max-w-[var(--account-content-max-width)]'
            )}
          >
            {breadcrumbs.length > 0 && (
              <div className="mb-4">
                <Breadcrumbs items={breadcrumbs} />
              </div>
            )}

            <section
              className="bb-section-shell mb-6"
              style={{
                background: 'var(--bb-hero-overlay, var(--bb-surface))',
              }}
              aria-label={t('hero.aria_label')}
              data-testid="account-layout-hero"
            >
              <div className="flex flex-col gap-2">
                <p className="bb-eyebrow" style={{ color: 'var(--text-secondary)' }}>
                  {t('hero.eyebrow')}
                </p>
                <h1
                  className="text-2xl font-semibold leading-tight md:text-3xl"
                  style={{ minHeight: 'var(--account-hero-min-height)' }}
                >
                  {user ? t('hero.greeting_with_name').replace('{name}', user.displayName) : t('hero.greeting')}
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t('hero.subtitle')}
                </p>
              </div>

              {quickActions.length > 0 && (
                <nav className="mt-6" aria-label={t('quick_actions.aria_label')} data-testid="account-layout-quick-actions">
                  <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {quickActions.map((action) => (
                      <li key={action.id}>
                        <Link
                          href={localizedHref(locale, action.href)}
                          className={cn(
                            'bb-card block h-full transition-transform',
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
              'order-2 min-w-0',
              // Desktop: sticky snapshot/nav column (contract calls for sticky behavior)
              'xl:sticky xl:top-[var(--space-12,48px)]'
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
              <nav aria-label={t('nav.aria_label')} data-testid="account-layout-nav">
                <ul className="flex flex-col gap-1">
                  {SURFACE_NAV.map(({ surface, key }) => {
                    const active = surface === activeSurface;
                    const label = t(`nav.items.${key}`);
                    return (
                      <li key={surface}>
                        <span
                          className={cn(
                            'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                            active
                              ? 'bg-[var(--color-selected-bg,rgba(168,146,121,0.18))] text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)]'
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          {label}
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
                            {surface}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="my-6 border-t" style={{ borderColor: 'var(--bb-border-hairline)' }} />

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
