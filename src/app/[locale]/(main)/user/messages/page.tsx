import { LoginForm } from '@/components/molecules/LoginForm/LoginForm';
import { UserNavigation } from '@/components/molecules/UserNavigation/UserNavigation';
import { UserMessagesSection } from '@/components/sections/UserMessagesSection/UserMessagesSection';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function MessagesPage() {
  const user = await retrieveCustomer();

  if (!user) return <LoginForm />;

  return (
    <main className="container">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="space-y-8 md:col-span-3">
          <UserMessagesSection />
        </div>
      </div>
    </main>
  );
}
