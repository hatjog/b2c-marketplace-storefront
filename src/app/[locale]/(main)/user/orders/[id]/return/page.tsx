import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/components/molecules';
import { ReturnRequestSurface } from '@/components/sections/AccountWriteSurfaces';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders, retrieveReturnReasons } from '@/lib/data/orders';

export default async function ReturnOrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, customer, orders, returnReasons] = await Promise.all([
    getTranslations('account_write'),
    retrieveCustomer(),
    listOrders(),
    retrieveReturnReasons(),
  ]);

  const reasons = (returnReasons ?? []).map((reason) => ({
    value: reason.id,
    label: reason.label ?? reason.value ?? reason.id,
  }));

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-05"
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
        { label: t('breadcrumbs.return_request'), href: `/${locale}/user/orders/${id}/return` },
      ]}
      quickActions={[
        {
          id: 'order-list',
          label: t('quick_actions.orders'),
          href: `/user/orders`,
          description: t('quick_actions.orders_desc'),
        },
        {
          id: 'addresses',
          label: t('quick_actions.addresses'),
          href: `/user/addresses`,
          description: t('quick_actions.addresses'),
        },
        {
          id: 'reviews',
          label: t('quick_actions.reviews'),
          href: `/user/reviews/written`,
          description: t('quick_actions.reviews'),
        },
      ]}
      snapshotSections={[
        { id: 'orders', label: t('snapshot.orders'), value: String(orders.length) },
        { id: 'addresses', label: t('snapshot.addresses'), value: String(customer?.addresses?.length ?? 0) },
        { id: 'reviews', label: t('snapshot.reviews'), value: String(orders.reduce((count, order) => count + (order.reviews?.length ?? 0), 0)) },
      ]}
      mainContent={
        customer ? (
          <ReturnRequestSurface orderId={id} reasons={reasons} />
        ) : (
          <LoginForm />
        )
      }
    />
  );
}
