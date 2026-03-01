import type { HttpTypes } from '@medusajs/types';
import clsx from 'clsx';
import Image from 'next/image';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { convertToLocale } from '@/lib/helpers/money';
import type { Wishlist } from '@/types/wishlist';

import { WishlistButton } from '../WishlistButton/WishlistButton';

export const WishlistItem = ({
  product,
  wishlist,
  user,
  testIdPrefix
}: {
  product: HttpTypes.StoreProduct & {
    calculated_amount: number;
    currency_code: string;
  };
  wishlist: Wishlist;
  user?: HttpTypes.StoreCustomer | null;
  testIdPrefix?: string;
}) => {
  const { cheapestPrice } = getProductPrice({ product });
  const price = convertToLocale({
    amount: cheapestPrice?.calculated_price_number,
    currency_code: cheapestPrice?.currency_code
  });

  return (
    <div
      className={clsx(
        'group relative flex w-[250px] flex-col justify-between rounded-sm border p-1 lg:w-[370px]'
      )}
      data-testid={testIdPrefix}
    >
      <div className="relative aspect-square h-full w-full bg-primary">
        <div className="absolute right-3 top-3 z-10 cursor-pointer">
          <WishlistButton
            productId={product.id}
            wishlist={wishlist}
            user={user}
          />
        </div>
        <LocalizedClientLink href={`/products/${product.handle}`}>
          <div className="align-center flex h-full w-full justify-center overflow-hidden rounded-sm">
            {product.thumbnail ? (
              <Image
                src={decodeURIComponent(product.thumbnail)}
                alt={product.title}
                width={360}
                height={360}
                className="aspect-square h-full w-full rounded-xs object-cover object-center transition-all duration-300 lg:group-hover:-mt-14"
                priority
                data-testid={testIdPrefix ? `${testIdPrefix}-thumbnail` : undefined}
              />
            ) : (
              <Image
                src="/images/placeholder.svg"
                alt="Product placeholder"
                width={100}
                height={100}
                className="margin-auto flex h-auto w-[100px]"
                data-testid={testIdPrefix ? `${testIdPrefix}-placeholder` : undefined}
              />
            )}
          </div>
        </LocalizedClientLink>
        <LocalizedClientLink href={`/products/${product.handle}`}>
          <Button
            className="absolute bottom-1 z-10 hidden h-auto w-full rounded-sm bg-action uppercase text-action-on-primary lg:h-[48px] lg:group-hover:block"
            data-testid={testIdPrefix ? `${testIdPrefix}-see-more-button` : undefined}
          >
            See More
          </Button>
        </LocalizedClientLink>
      </div>
      <LocalizedClientLink href={`/products/${product.handle}`}>
        <div className="flex justify-between p-4">
          <div className="w-full">
            <h3
              className="heading-sm truncate"
              data-testid={testIdPrefix ? `${testIdPrefix}-title` : undefined}
            >
              {product.title}
            </h3>
            <div
              className="mt-2 flex items-center gap-2"
              data-testid={testIdPrefix ? `${testIdPrefix}-price` : undefined}
            >
              {price}
            </div>
          </div>
        </div>
      </LocalizedClientLink>
    </div>
  );
};
