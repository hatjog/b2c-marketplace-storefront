import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import {
  formatAccountCurrency,
  formatAccountDate,
  loadOrderGroups,
  orderStatusToTone,
  toDisplayName,
  toneToBadgeClass
} from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';

const ORDER_FILTERS = ['all', 'paid', 'pending', 'failed', 'refunded'] as const;
type OrderFilter = (typeof ORDER_FILTERS)[number];

function parseFilter(value: string | string[] | undefined): OrderFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return ORDER_FILTERS.includes(raw as OrderFilter) ? (raw as OrderFilter) : 'all';
}

function parseOffset(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function OrdersFailureState({
  locale,
  title,
  description,
  ctaLabel,
  href = `/${locale}/user/orders`
}: {
  locale: string;
  title: string;
  description: string;
  ctaLabel: string;
  href?: string;
}) {
  return (
    <StateCard
      variant="error"
      title={title}
      description={description}
      action={
        <Link href={href} className="inline-flex min-h-11 items-center rounded-sm bg-action px-4 py-2 text-sm font-medium text-action-on-primary">
          {ctaLabel}
        </Link>
      }
    />
  );
}

export default async function OrdersPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const filter = parseFilter(sp.status);
  const offset = parseOffset(sp.offset);
  const limit = 25;
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.orders' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const result = await loadOrderGroups({ limit, offset });
  const filteredOrders =
    filter === 'all'
      ? result.data
      : result.data.filter(orderGroup =>
          orderGroup.statuses.some(status => orderStatusToTone(status) === filter)
        );
  const nextOffset = offset + limit;
  const previousOffset = Math.max(0, offset - limit);

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
          { id: 'count', label: t('snapshot.orders'), value: String(filteredOrders.length) },
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

            <nav className="flex flex-wrap gap-2" aria-label={t('filters.aria_label')}>
              {ORDER_FILTERS.map(option => (
                <Link
                  key={option}
                  href={`/${locale}/user/orders${option === 'all' ? '' : `?status=${option}`}`}
                  className={`rounded-sm border px-3 py-2 text-sm ${filter === option ? 'border-action bg-action text-action-on-primary' : 'border-primary text-primary'}`}
                  aria-current={filter === option ? 'page' : undefined}
                >
                  {t(`filters.${option}`)}
                </Link>
              ))}
            </nav>

            {result.state === 'access_denied' ? (
              <OrdersFailureState locale={locale} title={t('error.access_denied_title')} description={t('error.access_denied_body')} ctaLabel={t('error.login')} href={`/${locale}/login`} />
            ) : result.state === 'failed' ? (
              <OrdersFailureState locale={locale} title={t('error.failed_title')} description={t('error.failed_body')} ctaLabel={t('error.retry')} />
            ) : result.state === 'unavailable' ? (
              <StateCard variant="unavailable" title={t('error.unavailable_title')} description={t('error.unavailable_body')} />
            ) : filteredOrders.length === 0 ? (
              // Story 4.2 review fix 2026-05-23 (N7 LOW — client-side filter
              // hides matches on later pages): when a filter is active and the
              // current page is full (`result.data.length === limit`), the
              // remaining matches might live on the next page. Surface that
              // explicitly via `empty.filter_more_pages_hint` so users know to
              // load more instead of assuming zero matches exist.
              <StateCard
                variant="empty"
                title={t('empty.title')}
                description={
                  filter !== 'all' && result.data.length === limit
                    ? `${t('empty.body')} ${t('empty.filter_more_pages_hint')}`
                    : t('empty.body')
                }
                action={
                  filter !== 'all' && result.data.length === limit ? (
                    <Link
                      href={`/${locale}/user/orders?offset=${nextOffset}&status=${filter}`}
                      className="inline-flex min-h-11 items-center rounded-sm bg-action px-4 py-2 text-sm font-medium text-action-on-primary"
                    >
                      {t('pagination.next')}
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(orderGroup => {
                  const tone = orderStatusToTone(orderGroup.statuses[0]);
                  return (
                  <article key={orderGroup.id} className="bb-card space-y-3" data-testid={`order-group-${orderGroup.id}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-primary">{t('order_label', { displayId: orderGroup.displayId })}</h3>
                        <p className="text-sm text-secondary">{formatAccountDate(orderGroup.createdAt, locale) ?? t('labels.date_pending')}</p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(tone)}`}>
                        {t(`status.${tone}`)}
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
                );
                })}
                <div className="flex flex-wrap gap-3">
                  {offset > 0 && (
                    <Link href={`/${locale}/user/orders?offset=${previousOffset}${filter === 'all' ? '' : `&status=${filter}`}`} className="text-sm font-medium text-action">
                      {t('pagination.previous')}
                    </Link>
                  )}
                  {result.data.length === limit && (
                    <Link href={`/${locale}/user/orders?offset=${nextOffset}${filter === 'all' ? '' : `&status=${filter}`}`} className="text-sm font-medium text-action">
                      {t('pagination.next')}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
