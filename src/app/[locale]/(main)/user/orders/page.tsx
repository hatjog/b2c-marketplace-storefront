import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayout';
import {
  formatAccountCurrency,
  formatAccountDate,
  loadOrderGroups,
  toDisplayName,
  toneToBadgeClass
} from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';

function OrdersFailureState({
  locale,
  title,
  description,
  ctaLabel
}: {
  locale: string;
  title: string;
  description: string;
  ctaLabel: string;
}) {
  return (
    <StateCard
      variant="error"
      title={title}
      description={description}
      action={
        <Link href={`/${locale}/user/orders`} className="inline-flex min-h-11 items-center rounded-sm bg-action px-4 py-2 text-sm font-medium text-action-on-primary">
          {ctaLabel}
        </Link>
      }
    />
  );
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.orders' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const result = await loadOrderGroups();

  return (
    <>
      <StorefrontRouteStateSignal route="user-orders" surface="w2-03-orders" />
      <AccountLayoutWithChrome
        locale={locale}
        activeSurface="W2-03"
        user={{
          id: customer.id,
          displayName: toDisplayName(customer) ?? customer.email,
          email: customer.email
        }}
        snapshotSections={[
          { id: 'count', label: t('snapshot.orders'), value: String(result.data.length) },
          { id: 'email', label: t('snapshot.email'), value: customer.email }
        ]}
        mainContent={
          <div className="space-y-6" data-testid="orders-page">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="heading-md text-primary">{t('heading')}</h2>
                <p className="text-sm text-secondary">{t('intro')}</p>
              </div>
              <Link href={`/${locale}/user/vouchers`} className="text-sm font-medium text-action">
                {t('secondary_cta')}
              </Link>
            </div>

            {result.state === 'failed' ? (
              <OrdersFailureState locale={locale} title={t('error.failed_title')} description={t('error.failed_body')} ctaLabel={t('error.retry')} />
            ) : result.state === 'unavailable' ? (
              <StateCard variant="unavailable" title={t('error.unavailable_title')} description={t('error.unavailable_body')} />
            ) : result.data.length === 0 ? (
              <StateCard variant="empty" title={t('empty.title')} description={t('empty.body')} />
            ) : (
              <div className="space-y-3">
                {result.data.map(orderGroup => (
                  <article key={orderGroup.id} className="bb-card space-y-3" data-testid={`order-group-${orderGroup.id}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-primary">{t('order_label', { displayId: orderGroup.displayId })}</h3>
                        <p className="text-sm text-secondary">{formatAccountDate(orderGroup.createdAt, locale) ?? t('labels.date_pending')}</p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(orderGroup.statuses[0] ? 'paid' : 'pending')}`}>
                        {t(`status.${orderGroup.statuses[0] ? 'paid' : 'pending'}`)}
                      </span>
                    </div>
                    <div className="grid gap-3 text-sm text-secondary md:grid-cols-3">
                      <p>{t('summary.items', { count: orderGroup.itemCount })}</p>
                      <p>{t('summary.total', { amount: formatAccountCurrency(orderGroup.total, orderGroup.currencyCode, locale) })}</p>
                      <p>{t('summary.lines', { count: orderGroup.orders.length })}</p>
                    </div>
                    <Link href={`/${locale}/user/orders/${orderGroup.id}`} className="inline-flex min-h-11 items-center rounded-sm border border-action px-4 py-2 text-sm font-medium text-action">
                      {t('open')}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
