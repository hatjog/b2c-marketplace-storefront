import { redirect } from 'next/navigation';

import { Footer } from '@/components/organisms';
import { Header } from '@/components/organisms/Header/Header';
import { checkRegion } from '@/lib/helpers/check-region';
import { resolveMarketConfig } from '@/lib/portal.server';

export default async function AuthLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const regionCheck = await checkRegion(locale);
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);

  if (!regionCheck) {
    return redirect('/');
  }

  return (
    <>
      <Header
        locale={locale}
        marketConfig={marketConfig}
      />
      {children}
      <Footer
        marketConfig={marketConfig}
        locale={locale}
      />
    </>
  );
}
