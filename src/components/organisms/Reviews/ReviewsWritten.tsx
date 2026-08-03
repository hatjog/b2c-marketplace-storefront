'use client';

import { isEmpty } from 'lodash';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { Card, NavigationItem } from '@/components/atoms';
import { RefreshButton } from '@/components/cells/RefreshButton/RefreshButton';
import type { Order, Review } from '@/lib/data/reviews.shared';

import { navigation } from './navigation';
import { OrderCard } from './OrderCard';

export const ReviewsWritten = ({
  reviews,
  orders,
  isError
}: {
  reviews: Review[];
  orders: Order[];
  isError: boolean;
}) => {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  function renderReviews() {
    if (isError) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-negative">{t('reviews_error')}</p>
          <RefreshButton label={tCommon('refresh')} />
        </div>
      );
    }

    if (isEmpty(reviews)) {
      return (
        <Card>
          <div className="py-6 text-center">
            <h3 className="heading-lg uppercase text-primary">{t('no_reviews')}</h3>
            <p className="mt-2 text-lg text-secondary">
              {t('no_reviews_message')}
            </p>
          </div>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 md:col-span-3">
      <h1 className="heading-md uppercase">{t('reviews')}</h1>
      <div className="flex gap-4">
        {navigation.map(item => (
          <NavigationItem
            key={item.key}
            href={item.href}
            active={pathname === item.href}
            className="px-0"
          >
            {t(item.key)}
          </NavigationItem>
        ))}
      </div>
      {renderReviews()}
    </div>
  );
};
