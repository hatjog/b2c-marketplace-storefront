import { format, isValid } from 'date-fns';

import { Divider } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import type { SingleProductSeller } from '@/types/product';

import { SellerAvatar } from '../SellerAvatar/SellerAvatar';

export const CartItemsHeader = ({ seller }: { seller: SingleProductSeller }) => {
  const joinedDate = formatSellerJoinDate(seller.created_at);

  const content = (
    <div className="flex items-center gap-4 rounded-sm border p-4">
      <SellerAvatar
        photo={seller.photo}
        size={32}
        alt={seller.name}
      />

      <div className="gap-2 lg:flex">
        <p className="heading-xs uppercase">{seller.name}</p>
        {seller.id !== 'fleek' && joinedDate && (
          <div className="flex items-center gap-2">
            <Divider square />
            <p className="label-md text-secondary">
              Joined: {joinedDate}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (!seller.handle) {
    return content;
  }

  return <LocalizedClientLink href={`/sellers/${seller.handle}`}>{content}</LocalizedClientLink>;
};

function formatSellerJoinDate(value: unknown): string | null {
  if (value instanceof Date) {
    return isValid(value) ? format(value, 'yyyy-MM-dd') : null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
  }

  return null;
}
