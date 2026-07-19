import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LoginForm } from '@/components/molecules';
import { AccountSettingsSurface } from '@/components/sections/AccountWriteSurfaces';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';
import { resolveMarketLocales } from '@/lib/market-locales';

export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, user, marketLocales] = await Promise.all([
    getTranslations('account_write'),
    retrieveCustomer(),
    resolveMarketLocales(),
  ]);
  const orders = user ? await listOrders() : [];

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-13"
      user={
        user
          ? {
              id: user.id,
              displayName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email,
              email: user.email,
            }
          : null
      }
      breadcrumbs={[
        { label: t('breadcrumbs.account'), href: `/${locale}/user` },
        { label: t('breadcrumbs.settings'), href: `/${locale}/user/settings` },
      ]}
      quickActions={[
        {
          id: 'settings',
          label: t('quick_actions.settings'),
          href: `/user/settings`,
          description: t('quick_actions.settings_desc'),
        },
        {
          id: 'addresses',
          label: t('quick_actions.addresses'),
          href: `/user/addresses`,
          description: t('quick_actions.addresses_desc'),
        },
      ]}
      snapshotSections={[
        { id: 'orders', label: t('snapshot.orders'), value: String(orders.length) },
        { id: 'addresses', label: t('snapshot.addresses'), value: String(user?.addresses?.length ?? 0) },
        { id: 'reviews', label: t('snapshot.reviews'), value: '0' },
      ]}
      mainContent={
        user ? (
          <AccountSettingsSurface
            customer={{
              firstName: user.first_name ?? '',
              lastName: user.last_name ?? '',
              phone: user.phone ?? '',
              email: user.email,
              locale,
            }}
            supportedLocales={marketLocales.supported}
          />
        ) : (
          <LoginForm />
        )
      }
    />
  );
}
