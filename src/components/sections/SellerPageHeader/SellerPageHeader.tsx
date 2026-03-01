import type { HttpTypes } from '@medusajs/types';

import { SellerFooter, SellerHeading } from '@/components/organisms';

export const SellerPageHeader = ({
  header: _header = false,
  seller,
  user
}: {
  header?: boolean;
  seller: any;
  user: HttpTypes.StoreCustomer | null;
}) => {
  return (
    <div className="rounded-sm border">
      <SellerHeading
        header
        seller={seller}
        user={user}
      />
      <SellerFooter seller={seller} />
    </div>
  );
};
