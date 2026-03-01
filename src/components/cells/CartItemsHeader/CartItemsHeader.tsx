import { format } from 'date-fns';

import { Divider } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import type { SingleProductSeller } from '@/types/product';

import { SellerAvatar } from '../SellerAvatar/SellerAvatar';

export const CartItemsHeader = ({ seller }: { seller: SingleProductSeller }) => {
  return (
    <LocalizedClientLink href={`/sellers/${seller.handle}`}>
      <div className="flex items-center gap-4 rounded-sm border p-4">
        <SellerAvatar
          photo={seller.photo}
          size={32}
          alt={seller.name}
        />

        <div className="gap-2 lg:flex">
          <p className="heading-xs uppercase">{seller.name}</p>
          {seller.id !== 'fleek' && (
            <div className="flex items-center gap-2">
              <Divider square />
              <p className="label-md text-secondary">
                Joined: {format(seller.created_at || '', 'yyyy-MM-dd')}
              </p>
            </div>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  );
};
