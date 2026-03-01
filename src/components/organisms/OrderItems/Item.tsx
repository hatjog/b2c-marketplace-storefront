import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';

import { convertToLocale } from '@/lib/helpers/money';

export const Item = ({
  item,
  currencyCode
}: {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem;
  currencyCode: string;
}) => {
  const original_total = convertToLocale({
    amount: item.original_total,
    currency_code: currencyCode
  });

  const total = convertToLocale({
    amount: item.total,
    currency_code: currencyCode
  });

  return (
    <div className="flex gap-2 rounded-sm border p-1">
      <div className="flex h-[132px] w-[100px] items-center justify-center">
        {item.thumbnail ? (
          <Image
            src={decodeURIComponent(item.thumbnail)}
            alt="Product thumbnail"
            width={100}
            height={132}
            className="h-[132px] w-[100px] rounded-xs object-contain"
          />
        ) : (
          <Image
            src={'/images/placeholder.svg'}
            alt="Product thumbnail"
            width={50}
            height={66}
            className="h-[66px] w-[50px] rounded-xs object-contain opacity-30"
          />
        )}
      </div>

      <div className="w-full p-2">
        <div className="flex justify-between lg:mb-4">
          <div className="mb-6 w-[150px] md:w-[200px] lg:w-[300px] xl:w-[calc(100%-120px)]">
            <h3 className="heading-xs truncate uppercase">
              {item.subtitle} {item.title}
            </h3>
          </div>
        </div>
        <div className="-mt-4 justify-between lg:mt-0 lg:flex">
          <div className="label-md text-secondary">
            <p>
              Quantity: <span className="text-primary">{item.quantity}</span>
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 lg:mt-0 lg:block lg:text-right">
            {total !== original_total && (
              <p className="label-md text-secondary line-through">{original_total}</p>
            )}
            <p className="label-lg">{total}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
