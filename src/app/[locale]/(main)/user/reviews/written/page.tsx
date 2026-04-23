import { LoginForm, UserNavigation } from '@/components/molecules';
import { ReviewsWritten } from '@/components/organisms';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';
import { getReviews } from '@/lib/data/reviews';
import { isReviewableOrder } from '@/lib/data/reviews.shared';

export default async function Page() {
  const user = await retrieveCustomer();

  const reviewsRes = await getReviews();
  const orders = await listOrders();
  const reviewableOrders = orders.filter(isReviewableOrder);

  if (!user) return <LoginForm />;

  return (
    <main id="main-content" className="container">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <ReviewsWritten
          orders={reviewableOrders.filter(order => order.reviews.length > 0)}
          reviews={reviewsRes.data?.reviews.filter(Boolean) ?? []}
          isError={!reviewsRes.ok}
        />
      </div>
    </main>
  );
}
