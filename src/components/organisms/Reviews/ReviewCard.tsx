import Image from 'next/image';

import { Card } from '@/components/atoms';
import { StarIcon } from '@/icons';
import type { Review } from '@/lib/data/reviews.shared';
import { cn } from '@/lib/utils';

export const ReviewCard = ({ review }: { review: Review }) => {
  return (
    <Card
      className="flex flex-col gap-6 px-4 lg:grid lg:grid-cols-6"
      key={review.id}
    >
      <div className="flex gap-2 max-lg:items-center lg:flex-col">
        {review.seller.photo ? (
          <Image
            alt="Seller photo"
            src={review.seller.photo}
            className="border-base-primary size-8 rounded-xs border"
          />
        ) : null}
        <p className="label-md text-primary">{review.seller.name}</p>
      </div>
      <div className="col-span-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div
          className={cn('flex flex-col gap-2 px-4', review?.seller ? 'col-span-5' : 'col-span-6')}
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {new Array(review.rating).fill('').map((_, index) => (
                <StarIcon
                  className="size-3.5"
                  key={`${review.id}-${index}`}
                />
              ))}
            </div>
            <div className="h-2.5 w-px bg-action" />
            <p className="text-md text-primary">
              {new Date(review.updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
                ? `${Math.ceil(
                    (Date.now() - new Date(review.updated_at).getTime()) / (24 * 60 * 60 * 1000)
                  )} day${Date.now() - 2 * 24 * 60 * 60 * 1000 ? '' : 's'} ago`
                : `${Math.floor(
                    (Date.now() - new Date(review.updated_at).getTime()) / (7 * 24 * 60 * 60 * 1000)
                  )} week${Date.now() - 2 * 24 * 60 * 60 * 1000 ? '' : 's'} ago`}
            </p>
          </div>
          <div className="col-span-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <p className="text-md text-primary">{review.customer_note}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
