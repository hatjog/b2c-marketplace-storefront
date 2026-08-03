import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { toDisplayName } from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';

// Story 4.2 review fix 2026-05-23 (N4 MEDIUM — messages always-on StateCard +
// static channel cards):
// Previously the page always rendered 2 static channel cards (`salon`,
// `support`) plus an always-on StateCard underneath, regardless of whether
// any real message threads existed — visually contradictory ("here are the
// channels" vs "your inbox is empty"). Per AC8 + UX-DR19 + ES6 the surface
// must be PASSIVE: no fake threads, no CTAs, and the empty state must own
// the surface until a live message read-model integration lands.
//
// Behaviour now:
//   - `talkJsConfigured` is true  → StateCard `unavailable` (provider
//     configured but no live read-model wired yet for buyer-salon inbox).
//   - `talkJsConfigured` is false → StateCard `empty` (ES6 passive: "no
//     conversations yet"), no CTA.
// Static channel cards removed entirely — they were not real channels.

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
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
          <StateCard
            variant={talkJsConfigured ? 'unavailable' : 'empty'}
            title={talkJsConfigured ? t('provider.title') : t('empty.title')}
            description={talkJsConfigured ? t('provider.body') : t('empty.body')}
            data-testid={talkJsConfigured ? 'messages-unavailable-state' : 'messages-empty-state'}
          />
        </div>
      }
    />
  );
}
