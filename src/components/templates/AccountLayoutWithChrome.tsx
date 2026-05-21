import { getTranslations } from 'next-intl/server';

import { MobileBottomNav } from '@/components/organisms/MobileBottomNav/MobileBottomNav';
import { SiteFooter } from '@/components/organisms/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/organisms/SiteHeader/SiteHeader';
import { AccountLayout, type AccountLayoutProps, type AccountUser } from '@/components/templates/AccountLayout';
import { retrieveCustomer } from '@/lib/data/customer';
import { resolveMarketConfig } from '@/lib/portal.server';

export type AccountLayoutWithChromeProps = Omit<
  AccountLayoutProps,
  'headerSlot' | 'footerSlot' | 't' | 'user'
> & {
  user?: AccountUser;
};

export async function AccountLayoutWithChrome({
  user: userOverride,
  locale,
  ...rest
}: AccountLayoutWithChromeProps) {
  const tLayout = await getTranslations('account.layout');

  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const { marketConfig } = await resolveMarketConfig(marketId);

  const customer = userOverride ? null : await retrieveCustomer().catch(() => null);
  const resolvedUser: AccountUser =
    userOverride ??
    (customer
      ? {
          id: customer.id,
          displayName: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || customer.email,
          email: customer.email,
        }
      : null);

  return (
    <AccountLayout
      {...rest}
      locale={locale}
      user={resolvedUser}
      t={(key) => tLayout(key as any)}
      headerSlot={<SiteHeader locale={locale} marketConfig={marketConfig} />}
      footerSlot={
        <>
          <SiteFooter locale={locale} marketConfig={marketConfig} />
          <MobileBottomNav locale={locale} />
        </>
      }
    />
  );
}
