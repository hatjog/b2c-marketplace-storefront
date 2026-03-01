import { SellerInfo } from '@/components/molecules';
import type { SellerProps } from '@/types/seller';

export const ProductDetailsSeller = ({ seller }: { seller?: SellerProps }) => {
  if (!seller) return null;

  return (
    <div className="rounded-sm border">
      <div>
        <div className="flex justify-between">
          <SellerInfo
            seller={seller}
            showArrow
            bottomBorder
          />
        </div>
      </div>
    </div>
  );
};
