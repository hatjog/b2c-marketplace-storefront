import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayout';
import { formatAccountDate, loadReturns, orderStatusToTone, toDisplayName, toneToBadgeClass } from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.returns' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const result = await loadReturns();

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-07"
      user={{
        id: customer.id,
        displayName: toDisplayName(customer) ?? customer.email,
        email: customer.email
      }}
      snapshotSections={[
        { id: 'returns', label: t('snapshot.returns'), value: String(result.data.length) },
        { id: 'email', label: t('snapshot.email'), value: customer.email }
      ]}
      mainContent={
        <div className="space-y-6" data-testid="returns-page">
          <div>
            <h2 className="heading-md text-primary">{t('heading')}</h2>
            <p className="text-sm text-secondary">{t('intro')}</p>
          </div>
          {result.state === 'access_denied' ? (
            <StateCard variant="error" title={t('error.access_denied_title')} description={t('error.access_denied_body')} />
          ) : result.state === 'failed' ? (
            <StateCard variant="error" title={t('error.failed_title')} description={t('error.failed_body')} />
          ) : result.state === 'unavailable' ? (
            <StateCard variant="unavailable" title={t('error.unavailable_title')} description={t('error.unavailable_body')} />
          ) : result.data.length === 0 ? (
            <StateCard variant="empty" title={t('empty.title')} description={t('empty.body')} />
          ) : (
            <div className="space-y-3">
              {result.data.map(returnRequest => {
                const tone = orderStatusToTone(returnRequest.status);
                return (
                  <article key={returnRequest.id} className="bb-card flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary">{t('return_label', { id: returnRequest.id })}</p>
                      <p className="text-sm text-secondary">
                        {formatAccountDate(returnRequest.created_at ?? returnRequest.line_items?.[0]?.created_at, locale) ?? t('labels.date_pending')}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${toneToBadgeClass(tone)}`}>
                      {t(`status.${tone}`)}
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      }
    />
  );
}
