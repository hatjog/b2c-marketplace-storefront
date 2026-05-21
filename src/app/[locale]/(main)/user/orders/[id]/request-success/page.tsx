import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/components/molecules';
import { ReturnRequestSuccessSurface } from '@/components/sections/AccountWriteSurfaces';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';

export default async function RequestSuccessPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, customer] = await Promise.all([
    getTranslations('account_write'),
    retrieveCustomer(),
  ]);
  const orders = customer ? await listOrders() : [];

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-06"
      user={
        customer
          ? {
              id: customer.id,
              displayName: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || customer.email,
              email: customer.email,
            }
          : null
      }
      breadcrumbs={[
        { label: t('breadcrumbs.account'), href: `/${locale}/user` },
        { label: t('breadcrumbs.orders'), href: `/${locale}/user/orders` },
        { label: t('breadcrumbs.return_success'), href: `/${locale}/user/orders/${id}/request-success` },
      ]}
      quickActions={[
        {
          id: 'return-form',
          label: t('quick_actions.return_request'),
          href: `/user/orders/${id}/return`,
          description: t('quick_actions.return_request_desc'),
        },
        {
          id: 'orders',
          label: t('quick_actions.orders'),
          href: `/user/orders`,
          description: t('quick_actions.orders_desc'),
        },
      ]}
      snapshotSections={[
        { id: 'orders', label: t('snapshot.orders'), value: String(orders.length) },
        { id: 'addresses', label: t('snapshot.addresses'), value: String(customer?.addresses?.length ?? 0) },
        { id: 'reviews', label: t('snapshot.reviews'), value: String(orders.reduce((count, order) => count + (order.reviews?.length ?? 0), 0)) },
      ]}
      mainContent={customer ? <ReturnRequestSuccessSurface orderId={id} /> : <LoginForm />}
    />
  );
}
