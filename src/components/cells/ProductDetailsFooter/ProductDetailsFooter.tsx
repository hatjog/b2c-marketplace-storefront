import type { HttpTypes } from '@medusajs/types';

import { ProductPostedDate, ProductReportButton, ProductTags } from '@/components/molecules';

export const ProductDetailsFooter = ({
  tags = [],
  posted
}: {
  tags?: HttpTypes.StoreProductTag[];
  posted: HttpTypes.StoreProduct['created_at'];
}) => {
  return (
    <>
      <div className="rounded-sm border p-4">
        <ProductTags tags={tags} />
        <div className="mt-4 flex items-center justify-between">
          <ProductPostedDate posted={posted} />
          <ProductReportButton />
        </div>
      </div>
    </>
  );
};
