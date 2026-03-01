import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function Page() {
  const user = await retrieveCustomer();

  if (user) {
    redirect('/user');
  }

  return <RegisterForm />;
}
