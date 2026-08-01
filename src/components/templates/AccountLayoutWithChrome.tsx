import { getTranslations } from 'next-intl/server';

import { AccountLayout, type AccountLayoutProps, type AccountUser } from '@/components/templates/AccountLayout';
import { retrieveCustomer } from '@/lib/data/customer';

// Story 4.2 review fix 2026-05-23 (N1 HIGH — double chrome):
// `(main)/layout.tsx` already renders SiteHeader (W6-01) + SiteFooter (W6-02)
// + MobileBottomNav (W6-07) around {children}. Re-emitting them here as
// AccountLayout headerSlot/footerSlot duplicated the chrome on every W2
// surface (two headers, two footers, two bottom navs). Slots are now empty —
// AccountLayout retains its hero/sidebar/main composition, chrome stays in
// (main)/layout.tsx exclusively.

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
  // QD-03 (CAP-3): jawne locale — to samo, którym `AccountLayout` buduje
  // `localizedHref`. Zakres treści transakcyjnych kont pozostaje w QD-05.
  const tLayout = await getTranslations({ locale, namespace: 'account.layout' });

  // Story 4.3 M3 fix 2026-05-23: page-level auth gate already calls retrieveCustomer()
  // and passes `user` explicitly (including `user: null` for unauthenticated visitors).
  // Only fetch here when caller omitted the prop entirely (userOverride === undefined) —
  // prevents duplicate protected fetch + chrome-vs-page race. Compatible with Story 4.2
  // N1 chrome dedup (slots stay empty regardless of fetch outcome).
  const shouldFetch = userOverride === undefined;
  const customer = shouldFetch ? await retrieveCustomer().catch(() => null) : null;
  const resolvedUser: AccountUser = shouldFetch
    ? (customer
        ? {
            id: customer.id,
            displayName: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || customer.email,
            email: customer.email,
          }
        : null)
    : (userOverride ?? null);

  return (
    <AccountLayout
      {...rest}
      locale={locale}
      user={resolvedUser}
      t={(key) => tLayout(key as any)}
      headerSlot={null}
      footerSlot={null}
    />
  );
}
