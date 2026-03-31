import type { HttpTypes } from '@medusajs/types';

import { SellerFooter, SellerHeading } from '@/components/organisms';
import { SellerContact, SellerSocialLinks } from '@/components/organisms/seller';

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
      <div className="flex flex-wrap items-center gap-4 px-5 pb-4">
        <SellerSocialLinks socialLinks={seller.social_links} />
        <SellerContact phone={seller.phone} email={seller.email} />
      </div>
      <SellerFooter seller={seller} />
    </div>
  );
};
