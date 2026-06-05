import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/atoms';
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
  const marketName = marketConfig?.name ?? null;
  const t = await getTranslations('checkout');
  const tHeader = await getTranslations('header');

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
            <LocalizedClientLink
              href="/"
              className="flex items-center gap-2"
            >
              {marketLogoUrl && (
                <Image
                  src={marketLogoUrl}
                  width={126}
                  height={40}
                  alt={marketName ?? 'Logo'}
                  priority
                />
              )}
              {marketName ? (
                <span className="font-bold text-xl">{marketName}</span>
              ) : !marketLogoUrl ? (
                <span className="font-bold text-xl">{tHeader('home_fallback')}</span>
              ) : null}
            </LocalizedClientLink>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
