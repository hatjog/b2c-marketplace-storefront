import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/components/molecules';
import { SavedAddressesSurface } from '@/components/sections/AccountWriteSurfaces';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';
import { listRegions } from '@/lib/data/regions';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, user, regions, orders] = await Promise.all([
    getTranslations('account_write'),
    retrieveCustomer(),
    listRegions(),
    listOrders(),
  ]);

  const countries = regions.flatMap((region) => region.countries ?? []);

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-08"
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
        { label: t('breadcrumbs.addresses'), href: `/${locale}/user/addresses` },
      ]}
      quickActions={[
        {
          id: 'addresses',
          label: t('quick_actions.addresses'),
          href: `/user/addresses`,
          description: t('quick_actions.addresses_desc'),
        },
        {
          id: 'settings',
          label: t('quick_actions.settings'),
          href: `/user/settings`,
          description: t('quick_actions.settings_desc'),
        },
      ]}
      snapshotSections={[
        { id: 'orders', label: t('snapshot.orders'), value: String(orders.length) },
        { id: 'addresses', label: t('snapshot.addresses'), value: String(user?.addresses?.length ?? 0) },
        { id: 'reviews', label: t('snapshot.reviews'), value: '0' },
      ]}
      mainContent={
        user ? (
          <SavedAddressesSurface
            addresses={user.addresses ?? []}
            countries={countries.map((country) => ({
              iso_2: country?.iso_2 ?? '',
              display_name: country?.display_name ?? country?.iso_2?.toUpperCase() ?? '',
            }))}
            customerEmail={user.email}
            customerPhone={user.phone}
          />
        ) : (
          <LoginForm />
        )
      }
    />
  );
}
