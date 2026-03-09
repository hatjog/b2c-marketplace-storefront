import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { getMarketLogoUrl, resolveMarketConfig } from '@/lib/portal';

export default async function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);
  const marketLogoUrl = getMarketLogoUrl(marketConfig);
  const marketName = marketConfig?.name ?? null;

  return (
    <>
      <header>
        <div className="relative w-full px-4 py-2 lg:px-8">
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
                <span className="font-bold text-xl">Home</span>
              ) : null}
            </LocalizedClientLink>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
