import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import {
  buildOrderTimeline,
  formatAccountCurrency,
  formatAccountDate,
  loadOrderGroupDetail,
  orderStatusToTone,
  toDisplayName,
  toneToBadgeClass
} from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';

function ActionTile({
  title,
  description,
  href,
  enabled,
  cta
}: {
  title: string;
  description: string;
  href?: string;
  enabled: boolean;
  cta: string;
}) {
  return (
    <div className="bb-card space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <p className="text-sm text-secondary">{description}</p>
      </div>
      {enabled && href ? (
        <Link href={href} className="inline-flex min-h-11 items-center rounded-sm border border-action px-4 py-2 text-sm font-medium text-action">
          {cta}
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center rounded-sm border border-warning border-dashed px-4 py-2 text-sm font-medium text-warning" aria-disabled="true">
          {cta}
        </span>
      )}
    </div>
  );
}

// Story 4.2 review fix 2026-05-23 (N5 LOW — http: invoice href):
// Restrict external invoice URLs to https: only. http: invoices would allow
// MITM/phishing on the customer-facing surface. Internal paths (`/...`)
// remain valid because the storefront serves them under its own origin.
function safeInternalOrHttpsHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/')) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// Story 4.2 review fix 2026-05-23 (N3 MEDIUM — provider_id raw render):
// Maps Medusa/Mercur payment provider ids to localized labels. Unknown
// providers fall back to `payment.method_unknown` with code preserved so the
// surface never bleeds backend identifiers into PL/EN/UA/DE copy.
function paymentProviderLabelKey(providerId: string | null | undefined): {
  key: string;
  vars: Record<string, string | number>;
} {
  const raw = String(providerId ?? '').trim().toLowerCase();
  if (!raw) {
    return { key: 'payment.method_pending', vars: {} };
  }
  const known = new Set([
    'stripe',
    'manual',
    'pp_system_default',
    'pp_stripe_stripe',
    'paypal',
    'blik',
    'p24',
    'cash_on_delivery',
    'bank_transfer'
  ]);
  if (known.has(raw)) {
    return { key: `payment.providers.${raw}`, vars: {} };
  }
  return { key: 'payment.method_unknown', vars: { code: raw } };
}

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.orderDetail' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const result = await loadOrderGroupDetail(id);
  const orderGroup = result.data;

  if (result.state === 'access_denied') {
    redirect(`/${locale}/login`);
  }

  if (result.state !== 'ok' || !orderGroup) {
    return (
      <StateCard
        variant={result.state === 'unavailable' ? 'unavailable' : 'error'}
        title={result.state === 'unavailable' ? t('error.unavailable_title') : t('error.failed_title')}
        description={result.state === 'unavailable' ? t('error.unavailable_body') : t('error.failed_body')}
      />
    );
  }

  const primaryOrder = orderGroup.orders?.[0];
  const timeline = buildOrderTimeline(orderGroup);
  const resendHref = primaryOrder?.id ? `/${locale}/order/${primaryOrder.id}/confirmed` : undefined;
  const returnHref = primaryOrder?.id ? `/${locale}/user/orders/${primaryOrder.id}/return` : undefined;
  const invoiceHref = safeInternalOrHttpsHref(primaryOrder?.metadata?.invoice_url);
  const providerLabelKey = paymentProviderLabelKey(primaryOrder?.payment_collections?.[0]?.payments?.[0]?.provider_id);
  const contactHref = `/${locale}/pomoc`;

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-04"
      user={{
        id: customer.id,
        displayName: toDisplayName(customer) ?? customer.email,
        email: customer.email
      }}
      snapshotSections={[
        { id: 'number', label: t('snapshot.order_number'), value: String(orderGroup.display_id ?? id) },
        { id: 'date', label: t('snapshot.order_date'), value: formatAccountDate(orderGroup.created_at ?? primaryOrder?.created_at, locale) ?? t('labels.date_pending') }
      ]}
      mainContent={
        <div className="space-y-8" data-testid="order-detail-page">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Link href={`/${locale}/user/orders`} className="text-sm font-medium text-action">
                {t('back')}
              </Link>
              <h2 className="heading-md text-primary">{t('heading', { displayId: String(orderGroup.display_id ?? id) })}</h2>
              <p className="text-sm text-secondary">{t('intro')}</p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(orderStatusToTone(primaryOrder?.status))}`}>
              {t(`status.${orderStatusToTone(primaryOrder?.status)}`)}
            </span>
          </div>

          <section className="space-y-3">
            <h3 className="heading-sm text-primary">{t('items.heading')}</h3>
            <div className="space-y-3">
              {/* Story 4.2 review fix 2026-05-23 (N6 LOW — duplicate keys):
                  Previous key was `${item.id}-${item.variant_id}` which could
                  collide when variant_id is null/undefined or when items appear
                  in multiple orders inside the same group. Now keyed by
                  `${order.id}:${item.id}:${index}` which is unique per render. */}
              {orderGroup.orders?.flatMap(order =>
                (order.items ?? []).map((item, index) => ({ order, item, index }))
              ).map(({ order, item, index }) => (
                <article key={`${order.id}:${item.id ?? 'noid'}:${index}`} className="bb-card flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">{item.title}</p>
                    <p className="text-sm text-secondary">{t('items.quantity', { count: item.quantity ?? 1 })}</p>
                  </div>
                  <p className="text-sm font-medium text-primary">
                    {formatAccountCurrency(item.unit_price ?? 0, primaryOrder?.currency_code ?? 'PLN', locale)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="bb-card space-y-2">
              <h3 className="heading-sm text-primary">{t('delivery.heading')}</h3>
              <p className="text-sm text-secondary">
                {primaryOrder?.shipping_address?.address_1 || t('delivery.pending')}
              </p>
              <p className="text-sm text-secondary">
                {primaryOrder?.shipping_address?.city || t('delivery.pending')}
              </p>
            </article>
            <article className="bb-card space-y-2">
              <h3 className="heading-sm text-primary">{t('payment.heading')}</h3>
              <p className="text-sm text-secondary">
                {t('payment.total', {
                  amount: formatAccountCurrency(orderGroup.total ?? 0, primaryOrder?.currency_code ?? 'PLN', locale)
                })}
              </p>
              <p className="text-sm text-secondary">{t('payment.method', { value: t(providerLabelKey.key, providerLabelKey.vars) })}</p>
            </article>
          </section>

          <section className="space-y-3">
            <h3 className="heading-sm text-primary">{t('timeline.heading')}</h3>
            <div className="space-y-3">
              {timeline.map(event => (
                <article key={event.id} className="bb-card flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">{t(event.labelKey)}</p>
                    <p className="text-sm text-secondary">{t(event.detailKey)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(event.tone)}`}>
                      {t(`status.${event.tone}`)}
                    </span>
                    <span className="text-xs text-secondary">{formatAccountDate(event.at, locale) ?? t('labels.date_pending')}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="heading-sm text-primary">{t('actions.heading')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <ActionTile title={t('actions.resend.title')} description={t(primaryOrder ? 'actions.resend.available' : 'actions.resend.unavailable')} href={resendHref} enabled={Boolean(resendHref)} cta={t('actions.resend.cta')} />
              <ActionTile title={t('actions.invoice.title')} description={t(invoiceHref ? 'actions.invoice.available' : 'actions.invoice.unavailable')} href={invoiceHref} enabled={Boolean(invoiceHref)} cta={t('actions.invoice.cta')} />
              <ActionTile title={t('actions.return.title')} description={t(returnHref ? 'actions.return.available' : 'actions.return.unavailable')} href={returnHref} enabled={Boolean(returnHref)} cta={t('actions.return.cta')} />
              <ActionTile title={t('actions.contact.title')} description={t('actions.contact.available')} href={contactHref} enabled cta={t('actions.contact.cta')} />
            </div>
          </section>

          <CrossActorHandoff
            forYou={t('handoff.for_you')}
            forUs={t('handoff.for_us')}
            labelForYou={t('handoff.label_for_you')}
            labelForUs={t('handoff.label_for_us')}
          />
          <CrossActorHandoff
            forYou={t('handoff.for_recipient')}
            forUs={t('handoff.for_salon')}
            labelForYou={t('handoff.label_for_recipient')}
            labelForUs={t('handoff.label_for_salon')}
          />
        </div>
      }
    />
  );
}
