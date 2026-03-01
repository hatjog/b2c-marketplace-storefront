import { Divider } from '@medusajs/ui';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

import { StarRating } from '@/components/atoms';
import type { SingleProductReview } from '@/types/product';

export const SellerReview = ({ review }: { review: SingleProductReview }) => {
  return (
    <div
      className={clsx(
        'flex flex-col justify-center gap-2',
        review.seller_note && 'mb-4 border-b pb-4'
      )}
    >
      <div className="flex items-center gap-3">
        <StarRating
          starSize={14}
          rate={Number(review.rating.toFixed(1))}
        />
        <div className="flex items-center gap-2">
          <p className="label-md truncate text-primary">
            {review.customer.first_name} {review.customer.last_name}
          </p>
          <Divider
            orientation="vertical"
            className="h-[10px] border-disabled"
          />
          <p className="label-md text-secondary">
            {formatDistanceToNow(new Date(review.created_at), {
              addSuffix: true
            })}
          </p>
        </div>
      </div>
      <div className="w-5/6">
        <p className="text-md whitespace-pre-line break-words text-primary">
          {review.customer_note}
        </p>
        {review.seller_note && (
          <div className="mt-4 flex gap-4">
            <Divider
              orientation="vertical"
              className="h-auto"
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="label-md text-primary">Reply from {review.seller.name}</p>
                <Divider
                  orientation="vertical"
                  className="h-[10px] border-disabled"
                />

                <p className="label-md text-secondary">
                  {formatDistanceToNow(new Date(review.updated_at), {
                    addSuffix: true
                  })}
                </p>
              </div>
              <p className="label-sm">{review.seller_note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
