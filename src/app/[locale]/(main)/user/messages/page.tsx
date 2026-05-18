import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayout';
import { toDisplayName } from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'accountRead.messages' }),
    retrieveCustomer()
  ]);

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const talkJsConfigured = Boolean(process.env.NEXT_PUBLIC_TALKJS_APP_ID);

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-12"
      user={{
        id: customer.id,
        displayName: toDisplayName(customer) ?? customer.email,
        email: customer.email
      }}
      snapshotSections={[
        { id: 'status', label: t('snapshot.status'), value: talkJsConfigured ? t('snapshot.connected') : t('snapshot.passive') },
        { id: 'email', label: t('snapshot.email'), value: customer.email }
      ]}
      mainContent={
        <div className="space-y-6" data-testid="messages-page">
          <div>
            <h2 className="heading-md text-primary">{t('heading')}</h2>
            <p className="text-sm text-secondary">{t('intro')}</p>
          </div>
          {talkJsConfigured ? (
            <StateCard variant="unavailable" title={t('provider.title')} description={t('provider.body')} />
          ) : (
            <StateCard variant="empty" title={t('empty.title')} description={t('empty.body')} />
          )}
        </div>
      }
    />
  );
}
