import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LoginForm } from '@/components/molecules';
import { ReviewsToWriteSurface } from '@/components/sections/AccountWriteSurfaces';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';
import { isReviewableOrder } from '@/lib/data/reviews.shared';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, user] = await Promise.all([
    getTranslations('account_write'),
    retrieveCustomer(),
  ]);
  const orders = user ? await listOrders() : [];

  const reviewableOrders = orders.filter(isReviewableOrder).filter((order) => (order.reviews?.length ?? 0) === 0);

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-10"
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
        { label: t('breadcrumbs.reviews_to_write'), href: `/${locale}/user/reviews` },
      ]}
      quickActions={[
        {
          id: 'written',
          label: t('quick_actions.written_reviews'),
          href: `/user/reviews/written`,
          description: t('quick_actions.written_reviews_desc'),
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
        { id: 'reviews', label: t('snapshot.reviews'), value: String(orders.reduce((count, order) => count + (order.reviews?.length ?? 0), 0)) },
      ]}
      mainContent={
        user ? (
          <ReviewsToWriteSurface
            orders={reviewableOrders.map((order) => ({
              id: order.id,
              displayId: order.display_id ? `#${order.display_id}` : order.id.slice(0, 8),
              sellerId: order.seller.id,
              sellerName: order.seller?.name ?? t('written_reviews.list.unknown_seller'),
              createdAt: order.created_at ?? null,
              existingReview: null,
            }))}
          />
        ) : (
          <LoginForm />
        )
      }
    />
  );
}
