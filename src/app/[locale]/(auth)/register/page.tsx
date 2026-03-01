import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function RegisterPage() {
  const user = await retrieveCustomer();

  if (user) {
    redirect('/user');
  }

  return <RegisterForm />;
}
