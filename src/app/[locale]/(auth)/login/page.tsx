import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { LoginForm } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function LoginPage() {
  const user = await retrieveCustomer();

  if (user) {
    redirect('/user');
  }

  return (
    <>
      <StorefrontRouteStateSignal
        route="auth-login"
        surface="auth-login"
      />
      <LoginForm />
    </>
  );
}
