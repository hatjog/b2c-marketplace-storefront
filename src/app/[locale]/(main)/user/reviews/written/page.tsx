import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LoginForm } from '@/components/molecules';
import { WrittenReviewsSurface } from '@/components/sections/AccountWriteSurfaces';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';
import { getReviews } from '@/lib/data/reviews';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, user] = await Promise.all([
    getTranslations({ locale, namespace: 'account_write' }),
    retrieveCustomer(),
  ]);
  const [reviewsRes, orders] = user
    ? await Promise.all([getReviews(), listOrders()])
    : [{ data: { reviews: [] } }, []];

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-11"
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
        { label: t('breadcrumbs.written_reviews'), href: `/${locale}/user/reviews/written` },
      ]}
      quickActions={[
        {
          id: 'to-write',
          label: t('quick_actions.reviews'),
          href: `/user/reviews`,
          description: t('quick_actions.reviews_desc'),
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
        { id: 'addresses', label: t('snapshot.addresses'), value: String(user?.addresses?.length ?? 0) },
        { id: 'reviews', label: t('snapshot.reviews'), value: String(reviewsRes.data?.reviews?.length ?? 0) },
      ]}
      mainContent={
        user ? (
          <WrittenReviewsSurface
            reviews={(reviewsRes.data?.reviews?.filter(Boolean) ?? []).map((review: any) => ({
              id: review.id,
              rating: review.rating ?? 0,
              customer_note: review.customer_note ?? '',
              updated_at: review.updated_at ?? review.created_at ?? null,
              seller: { name: review.seller?.name ?? t('written_reviews.list.unknown_seller') },
              order_id: review.order_id ?? '',
            }))}
          />
        ) : (
          <LoginForm />
        )
      }
    />
  );
}
