import { LoginForm, UserNavigation } from '@/components/molecules';
import { ReviewsToWrite } from '@/components/organisms';
import { retrieveCustomer } from '@/lib/data/customer';
import { listOrders } from '@/lib/data/orders';

export default async function Page() {
  const user = await retrieveCustomer();

  if (!user) return <LoginForm />;

  const orders = await listOrders();

  if (!orders) return null;

  return (
    <main id="main-content" className="container">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <ReviewsToWrite orders={orders.filter(order => order.reviews.length === 0)} />
      </div>
    </main>
  );
}
