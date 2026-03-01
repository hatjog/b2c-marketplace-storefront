import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function LoginPage() {
  const user = await retrieveCustomer();

  if (user) {
    redirect('/user');
  }

  return <LoginForm />;
}
