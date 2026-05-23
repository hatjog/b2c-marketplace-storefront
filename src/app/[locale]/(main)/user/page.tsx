import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import {
  formatAccountCurrency,
  formatAccountDate,
  loadOrderGroups,
  loadWishlist,
  toDisplayName,
  toneToBadgeClass
} from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';
import { getCountryCode } from '@/lib/helpers/country-code';

export default async function UserPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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
      <StorefrontI18nLongContentProbe locale={locale} surface="account-dashboard" />
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
            <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <article className="bb-card space-y-3" data-testid="dashboard-hero-card">
                <p className="text-sm text-secondary">{t('welcome_eyebrow')}</p>
                <h2 className="heading-md text-primary">{t('welcome_heading', { firstName: customer.first_name || toDisplayName(customer) || customer.email })}</h2>
                <p className="text-sm text-secondary">{t('welcome_body')}</p>
              </article>
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
                  {orderGroups.map(orderGroup => (
                    <article key={orderGroup.id} className="bb-card space-y-2" data-testid={`dashboard-order-${orderGroup.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-primary">{t('recent_activity.order_label', { displayId: orderGroup.displayId })}</p>
                          <p className="text-xs text-secondary">{formatAccountDate(orderGroup.createdAt, locale) ?? t('labels.date_pending')}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(orderGroup.statuses[0] ? 'paid' : 'pending')}`}>
                          {t(`statuses.${orderGroup.statuses[0] ? 'paid' : 'pending'}`)}
                        </span>
                      </div>
                      <p className="text-sm text-secondary">{t('recent_activity.items', { count: orderGroup.itemCount })}</p>
                      <p className="text-sm font-medium text-primary">{formatAccountCurrency(orderGroup.total, orderGroup.currencyCode, locale)}</p>
                      <Link href={`/${locale}/user/orders/${orderGroup.id}`} className="text-sm font-medium text-action">
                        {t('recent_activity.open_order')}
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        }
      />
    </>
  );
}
