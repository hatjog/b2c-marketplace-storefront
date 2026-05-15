// W1-01 layout — Wave 6 chrome: SiteHeader (W6-01) + SiteFooter (W6-02) + MobileBottomNav (W6-07)
// Story 3.0 Sprint 1 thin slice gate.
// @chrome-manifest: W6-01
// @chrome-manifest: W6-02
// @chrome-manifest: W6-07
import { Session } from '@talkjs/react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { SkipLink } from '@/components/atoms';
import { SiteFooter } from '@/components/organisms/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/organisms/SiteHeader/SiteHeader';
import { MobileBottomNav } from '@/components/organisms/MobileBottomNav/MobileBottomNav';
import { retrieveCustomer } from '@/lib/data/customer';
import { checkRegion } from '@/lib/helpers/check-region';
import { resolveMarketConfig } from '@/lib/portal.server';

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
  const tA11y = await getTranslations('accessibility');

  if (!regionCheck) {
    return redirect('/');
  }

  if (!APP_ID || !user)
    return (
      <>
        <SkipLink label={tA11y('skip_to_content')} />
        {/* W6-01 SiteHeader */}
        <SiteHeader
          locale={locale}
          marketConfig={marketConfig}
        />
        {children}
        {/* W6-02 SiteFooter */}
        <SiteFooter
          marketConfig={marketConfig}
          locale={locale}
        />
        {/* W6-07 MobileBottomNav */}
        <MobileBottomNav locale={locale} />
      </>
    );

  return (
    <>
      <Session
        appId={APP_ID}
        userId={user.id}
      >
        <SkipLink label={tA11y('skip_to_content')} />
        {/* W6-01 SiteHeader */}
        <SiteHeader
          locale={locale}
          marketConfig={marketConfig}
        />
        {children}
        {/* W6-02 SiteFooter */}
        <SiteFooter
          marketConfig={marketConfig}
          locale={locale}
        />
        {/* W6-07 MobileBottomNav */}
        <MobileBottomNav locale={locale} />
      </Session>
    </>
  );
}
