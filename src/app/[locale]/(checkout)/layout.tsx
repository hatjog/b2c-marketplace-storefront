import { getTranslations } from 'next-intl/server';

import { Button, LogoLockup } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { CollapseIcon } from '@/icons';
import { getMarketLogoUrl } from '@/lib/portal';
import { resolveMarketConfig } from '@/lib/portal.server';

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);
  const marketLogoUrl = getMarketLogoUrl(marketConfig);
  const t = await getTranslations('checkout');

  return (
    <>
      <header>
        <div className="relative w-full px-4 py-2 lg:px-8">
          <div className="absolute top-3">
            <LocalizedClientLink href="/cart">
              <Button
                variant="tonal"
                className="flex items-center gap-2"
              >
                <CollapseIcon className="rotate-90" />
                <span className="hidden lg:block">{t('back_to_cart')}</span>
              </Button>
            </LocalizedClientLink>
          </div>
          <div className="flex w-full items-center justify-center pl-4 lg:pl-0">
            <LogoLockup
              logoSrc={marketLogoUrl}
              className="flex items-center gap-2"
              data-testid="checkout-logo-link"
            />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
