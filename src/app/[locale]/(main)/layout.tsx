import { Session } from '@talkjs/react';
import { redirect } from 'next/navigation';

import { Footer } from '@/components/organisms';
import { Header } from '@/components/organisms/Header/Header';
import { retrieveCustomer } from '@/lib/data/customer';
import { checkRegion } from '@/lib/helpers/check-region';
import { resolveMarketConfig } from '@/lib/portal';

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const APP_ID = process.env.NEXT_PUBLIC_TALKJS_APP_ID;
  const { locale } = await params;
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);

  const user = await retrieveCustomer();
  const regionCheck = await checkRegion(locale);

  if (!regionCheck) {
    return redirect('/');
  }

  if (!APP_ID || !user)
    return (
      <>
        <Header
          locale={locale}
          marketConfig={marketConfig}
        />
        {children}
        <Footer marketConfig={marketConfig} />
      </>
    );

  return (
    <>
      <Session
        appId={APP_ID}
        userId={user.id}
      >
        <Header
          locale={locale}
          marketConfig={marketConfig}
        />
        {children}
        <Footer marketConfig={marketConfig} />
      </Session>
    </>
  );
}
