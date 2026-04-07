import type { HttpTypes } from '@medusajs/types';
import clsx from 'clsx';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import { convertToLocale } from '@/lib/helpers/money';
import type { Wishlist } from '@/types/wishlist';

import { WishlistButton } from '../WishlistButton/WishlistButton';

export const WishlistItem = async ({
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
  const t = await getTranslations('products');
  const { cheapestPrice } = getProductPrice({ product });
  const price = convertToLocale({
    amount: cheapestPrice?.calculated_price_number,
    currency_code: cheapestPrice?.currency_code
  });

  return (
    <div
      className={clsx(
        'group relative flex w-full max-w-[370px] flex-col justify-between overflow-hidden rounded-[28px] border border-[rgba(144,112,50,0.14)] bg-[rgba(255,255,255,0.84)] p-2 shadow-[0_16px_40px_rgba(90,67,28,0.08)]'
      )}
      data-testid={testIdPrefix}
    >
      <div className="relative aspect-[4/5] h-full w-full overflow-hidden rounded-[22px] bg-primary">
        <div className="absolute right-3 top-3 z-10 cursor-pointer">
          <WishlistButton
            productId={product.id}
            wishlist={wishlist}
            user={user}
          />
        </div>
        <LocalizedClientLink href={`/products/${product.handle}`}>
          <div className="align-center flex h-full w-full justify-center overflow-hidden rounded-[22px]">
            {product.thumbnail ? (
              <Image
                src={safeDecodeURIComponent(product.thumbnail)}
                alt={product.title}
                width={360}
                height={360}
                className="aspect-[4/5] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
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
          <span
            className="bb-primary-cta absolute bottom-3 left-3 right-3 z-10 hidden justify-center rounded-full px-4 py-2 text-[12px] lg:inline-flex lg:opacity-0 lg:transition-opacity lg:duration-300 lg:group-hover:opacity-100"
            data-testid={testIdPrefix ? `${testIdPrefix}-see-more-button` : undefined}
          >
            {t('see_more')}
          </span>
        </LocalizedClientLink>
      </div>
      <LocalizedClientLink href={`/products/${product.handle}`}>
        <div className="flex justify-between p-4">
          <div className="w-full">
            <h3
              className="heading-sm line-clamp-2"
              data-testid={testIdPrefix ? `${testIdPrefix}-title` : undefined}
            >
              {product.title}
            </h3>
            <div
              className="mt-2 flex items-center gap-2 text-lg font-medium"
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
