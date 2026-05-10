import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { RegisterForm } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function RegisterPage() {
  const user = await retrieveCustomer();

  if (user) {
    redirect('/user');
  }

  return (
    <>
      <StorefrontRouteStateSignal
        route="auth-register"
        surface="auth-register"
      />
      <RegisterForm />
    </>
  );
}
