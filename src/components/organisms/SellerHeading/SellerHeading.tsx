import type { HttpTypes } from '@medusajs/types';

import { SanitizedHTML, SellerInfo } from '@/components/molecules';
import type { SellerProps } from '@/types/seller';

import { Chat } from '../Chat/Chat';

export const SellerHeading = ({
  seller,
  user,
  header
}: {
  header: boolean;
  seller: SellerProps;
  user: HttpTypes.StoreCustomer | null;
}) => {
  return (
    <div className="border-b">
      <div className="flex flex-col justify-between md:flex-row">
        <div>
          <SellerInfo
            header={header}
            seller={seller}
          />
        </div>
        {user && (
          <div className="flex gap-2 p-5 md:ml-auto md:mt-0">
            <Chat
              user={user}
              seller={seller}
              buttonClassNames="uppercase h-10"
              variant="filled"
              buttonSize="small"
            />
          </div>
        )}
      </div>
      <div className="px-5 pb-5">
        <SanitizedHTML
          html={seller.description}
          className="label-md"
        />
      </div>
    </div>
  );
};
