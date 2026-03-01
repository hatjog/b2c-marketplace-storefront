'use client';

import { isEmpty } from 'lodash';
import { usePathname } from 'next/navigation';

import { Card, NavigationItem } from '@/components/atoms';
import { RefreshButton } from '@/components/cells/RefreshButton/RefreshButton';
import type { Order, Review } from '@/lib/data/reviews';

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
  const pathname = usePathname();

  function renderReviews() {
    if (isError) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-negative">Something went wrong while fetching reviews</p>
          <RefreshButton label="Refresh" />
        </div>
      );
    }

    if (isEmpty(reviews)) {
      return (
        <Card>
          <div className="py-6 text-center">
            <h3 className="heading-lg uppercase text-primary">No written reviews</h3>
            <p className="mt-2 text-lg text-secondary">
              You haven&apos;t written any reviews yet. Once you write a review, it will appear
              here.
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
      <h1 className="heading-md uppercase">Reviews</h1>
      <div className="flex gap-4">
        {navigation.map(item => (
          <NavigationItem
            key={item.label}
            href={item.href}
            active={pathname === item.href}
            className="px-0"
          >
            {item.label}
          </NavigationItem>
        ))}
      </div>
      {renderReviews()}
    </div>
  );
};
