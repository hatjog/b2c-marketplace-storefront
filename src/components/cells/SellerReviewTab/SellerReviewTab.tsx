import { SellerReviewList, SellerScore } from '@/components/molecules';
import { getSellerByHandle } from '@/lib/data/seller';
import type { SellerProps } from '@/types/seller';

export const SellerReviewTab = async ({ seller_handle }: { seller_handle: string }) => {
  const seller = (await getSellerByHandle(seller_handle)) as SellerProps;

  const filteredReviews = seller.reviews?.filter(r => r !== null);

  const reviewCount = filteredReviews ? filteredReviews?.length : 0;

  const rating =
    filteredReviews && filteredReviews.length > 0
      ? filteredReviews.reduce((sum, r) => sum + r?.rating, 0) / filteredReviews.length
      : 0;

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-4">
      <div className="rounded-sm border p-4">
        <SellerScore
          rate={rating}
          reviewCount={reviewCount}
        />
      </div>
      <div className="col-span-3 rounded-sm border p-4">
        <h3 className="heading-sm border-b pb-4 uppercase">Seller reviews</h3>
        <SellerReviewList reviews={seller.reviews} />
      </div>
    </div>
  );
};
