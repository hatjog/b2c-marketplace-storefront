import { LoginForm, UserNavigation } from '@/components/molecules';
import { ReviewsWritten } from '@/components/organisms';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';
import { getReviews } from '@/lib/data/reviews';

export default async function Page() {
  const user = await retrieveCustomer();

  const reviewsRes = await getReviews();
  const orders = await listOrders();

  if (!user) return <LoginForm />;

  return (
    <main className="container">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <ReviewsWritten
          orders={orders.filter(order => order.reviews.length)}
          reviews={reviewsRes.data?.reviews.filter(Boolean) ?? []}
          isError={!reviewsRes.ok}
        />
      </div>
    </main>
  );
}
