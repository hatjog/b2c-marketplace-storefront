'use client';

import Link from 'next/link';

import { Button } from '@/components/atoms';

export const OrderReturn = ({ order }: { order: any }) => {
  return (
    <div className="items-center justify-between md:flex">
      <div className="mb-4 md:mb-0">
        <h2 className="label-lg uppercase text-primary">Return Order</h2>
        <p className="label-md max-w-sm text-secondary">
          Once you receive your order, you will have [14] days to return items. Find out more about{' '}
          <Link
            href="/returns"
            className="underline"
          >
            returns and refunds
          </Link>
          .
        </p>
      </div>
      <Link href={`/user/orders/${order.id}/return`}>
        <Button
          variant="tonal"
          className="uppercase"
          onClick={() => null}
        >
          Return
        </Button>
      </Link>
    </div>
  );
};
