import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import {
  formatAccountCurrency,
  formatAccountDate,
  loadOrderGroups,
  loadWishlist,
  orderStatusToTone,
  toDisplayName,
  toneToBadgeClass
} from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';
import { getCountryCode } from '@/lib/helpers/country-code';

export default async function UserPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.dashboard' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const countryCode = await getCountryCode(locale);
  const [ordersResult, wishlistResult] = await Promise.all([
    loadOrderGroups(),
    loadWishlist(countryCode)
  ]);

  const orderGroups = ordersResult.data.slice(0, 3);
  const quickActions = [
    { id: 'vouchers', href: '/user/vouchers', label: t('quick_actions.vouchers.label'), description: t('quick_actions.vouchers.description') },
    { id: 'orders', href: '/user/orders', label: t('quick_actions.orders.label'), description: t('quick_actions.orders.description') },
    { id: 'wishlist', href: '/user/wishlist', label: t('quick_actions.wishlist.label'), description: t('quick_actions.wishlist.description') },
    { id: 'messages', href: '/user/messages', label: t('quick_actions.messages.label'), description: t('quick_actions.messages.description') }
  ];

  return (
    <>
      <StorefrontRouteStateSignal route="user-account" surface="w2-01-dashboard" />
      <StorefrontI18nLongContentProbe locale={locale} surface="account" />
      <AccountLayoutWithChrome
        locale={locale}
        activeSurface="W2-01"
        user={{
          id: customer.id,
          displayName: toDisplayName(customer) ?? customer.email,
          email: customer.email
        }}
        quickActions={quickActions}
        snapshotSections={[
          { id: 'email', label: t('snapshot.email'), value: customer.email },
          { id: 'orders', label: t('snapshot.orders'), value: String(ordersResult.data.length) },
          { id: 'wishlist', label: t('snapshot.wishlist'), value: String(wishlistResult.data.products?.length ?? 0) }
        ]}
        mainContent={
          <div className="space-y-8" data-testid="account-dashboard">
            {/* Story 4.2 review fix 2026-05-23 (N8 INFO — dashboard hero dubluje
                AccountLayout hero): the legacy `dashboard-hero-card` repeated
                the welcome greeting that AccountLayout already renders at the
                global hero slot. Removed; only the "Recommended next step"
                side card remains as supplementary post-purchase context. */}
            <section data-testid="dashboard-recommended">
              <article className="bb-card-muted space-y-2" data-testid="dashboard-side-snapshot">
                <h2 className="text-sm font-semibold text-primary">{t('recommended.heading')}</h2>
                <p className="text-sm text-secondary">{t('recommended.body')}</p>
                <Link href={`/${locale}/categories`} className="text-sm font-medium text-action">
                  {t('recommended.cta')}
                </Link>
              </article>
            </section>

            <section className="space-y-3" data-testid="dashboard-recent-activity">
              <div className="flex items-center justify-between gap-3">
                <h2 className="heading-sm text-primary">{t('recent_activity.heading')}</h2>
                <Link href={`/${locale}/user/orders`} className="text-sm font-medium text-action">
                  {t('recent_activity.cta')}
                </Link>
              </div>
              {orderGroups.length === 0 ? (
                <p className="bb-card-muted text-sm text-secondary">{t('recent_activity.empty')}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {orderGroups.map(orderGroup => {
                    // Story 4.2 review fix 2026-05-23 (N2 HIGH — dashboard status fallback):
                    // Previous mapping treated any non-empty status as `paid`, masking
                    // failed/cancelled/refunded as green "Active" badges. Now we route
                    // through orderStatusToTone() — the same semantic mapping consumed
                    // by /user/orders, /user/orders/[id] and /user/returns.
                    const tone = orderStatusToTone(orderGroup.statuses[0]);
                    return (
                    <article key={orderGroup.id} className="bb-card space-y-2" data-testid={`dashboard-order-${orderGroup.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-primary">{t('recent_activity.order_label', { displayId: orderGroup.displayId })}</p>
                          <p className="text-xs text-secondary">{formatAccountDate(orderGroup.createdAt, locale) ?? t('labels.date_pending')}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(tone)}`}>
                          {t(`statuses.${tone}`)}
                        </span>
                      </div>
                      <p className="text-sm text-secondary">{t('recent_activity.items', { count: orderGroup.itemCount })}</p>
                      <p className="text-sm font-medium text-primary">{formatAccountCurrency(orderGroup.total, orderGroup.currencyCode, locale)}</p>
                      <Link href={`/${locale}/user/orders/${orderGroup.id}`} className="text-sm font-medium text-action">
                        {t('recent_activity.open_order')}
                      </Link>
                    </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        }
      />
    </>
  );
}
