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
  const inboxChannels = [
    {
      id: 'salon',
      title: t('channels.salon.title'),
      body: t('channels.salon.body')
    },
    {
      id: 'support',
      title: t('channels.support.title'),
      body: t('channels.support.body')
    }
  ];

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
          <div className="grid gap-3 md:grid-cols-2" role="list" aria-label={t('channels.aria_label')}>
            {inboxChannels.map(channel => (
              <article key={channel.id} className="bb-card space-y-2" role="listitem">
                <h3 className="text-sm font-semibold text-primary">{channel.title}</h3>
                <p className="text-sm text-secondary">{channel.body}</p>
              </article>
            ))}
          </div>
          <StateCard
            variant={talkJsConfigured ? 'unavailable' : 'empty'}
            title={talkJsConfigured ? t('provider.title') : t('empty.title')}
            description={talkJsConfigured ? t('provider.body') : t('empty.body')}
          />
        </div>
      }
    />
  );
}
