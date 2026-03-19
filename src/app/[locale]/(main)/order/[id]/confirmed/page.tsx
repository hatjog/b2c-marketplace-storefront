import type { Metadata } from 'next';

import { ConfirmationPageContent } from '@/components/sections/ConfirmationPageContent/ConfirmationPageContent';

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: 'Your purchase was successful'
};

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params;

  return (
    <main id="main-content" className="container">
      <ConfirmationPageContent orderId={params.id} />
    </main>
  );
}
