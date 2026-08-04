// W1-01 layout — Wave 6 chrome: SiteHeader (W6-01) + SiteFooter (W6-02) + MobileBottomNav (W6-07)
// Story 3.0 Sprint 1 thin slice gate.
// @chrome-manifest: W6-01
// @chrome-manifest: W6-02
// @chrome-manifest: W6-07
import { Session } from '@talkjs/react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { SkipLink } from '@/components/atoms';
import {
  FALLBACK_LOCALE,
  LocaleFallbackNotice,
  type LocaleFallbackTargetLocale
} from '@/components/locale';
import { MobileBottomNav } from '@/components/organisms/MobileBottomNav/MobileBottomNav';
import { SiteFooter } from '@/components/organisms/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/organisms/SiteHeader/SiteHeader';
import { isSupportedLocale } from '@/i18n/routing';
import { retrieveCustomer } from '@/lib/data/customer';
import { checkRegion } from '@/lib/helpers/check-region';
import { computeLocaleCoverage } from '@/lib/i18n/localeCoverage';
import { resolveMarketLocales } from '@/lib/market-locales';
import { resolveMarketConfig } from '@/lib/portal.server';

const BCP47_LOCALE_BY_ROUTE_LOCALE: Record<string, LocaleFallbackTargetLocale> = {
  pl: 'pl-PL',
  en: 'en-US',
  ua: 'uk-UA',
  de: 'de-DE'
};

function resolveTargetLocale(locale: string): LocaleFallbackTargetLocale {
  return BCP47_LOCALE_BY_ROUTE_LOCALE[locale] ?? FALLBACK_LOCALE;
}

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const APP_ID = process.env.NEXT_PUBLIC_TALKJS_APP_ID;
  const { locale } = await params;
  setRequestLocale(locale);
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  // QD-01: market copy is resolved for the route locale (see resolveMarketConfig).
  const marketLocales = await resolveMarketLocales();
  const { marketConfig } = await resolveMarketConfig(
    marketId,
    isSupportedLocale(locale) ? locale : marketLocales.defaultLocale
  );

  const user = await retrieveCustomer();
  const regionCheck = await checkRegion(locale);
  // Locale JAWNIE, nie ze stanu żądania.
  //
  // ZMIERZONE (prod-build, gp-config BonBeauty, zimny cache):
  //   - PDP, seller-detail i collection renderowały polski skip-link na /en,
  //     /ua i /de; `category` renderowało poprawnie — przy TYM SAMYM layoucie;
  //   - w tym samym renderze `targetLocale` wynosił już "de-DE", więc `locale`
  //     było poprawne — degradował wyłącznie translator;
  //   - po przekazaniu `locale` jawnie: 0 wystąpień PL na wszystkich trzech
  //     powierzchniach i w trzech locale, bez regresji na /pl.
  //
  // NIEUSTALONE: dokładny mechanizm degradacji. `src/i18n.ts` czyta
  // `await requestLocale`, które next-intl zasila m.in. z `setRequestLocale`,
  // więc teza „niejawne rozwiązanie nie ma źródła" NIE jest potwierdzona.
  // Dopóki mechanizm nie jest zmierzony, nie należy zakładać, że ta klasa
  // defektu jest zamknięta — ~88 wywołań `getTranslations` w storefroncie
  // nadal nie przekazuje locale jawnie, w tym `sellers/[handle]/page.tsx`.
  //
  // `setRequestLocale` niżej zostaje — korzystają z niego komponenty potomne.
  // Wzorzec jawnego locale: QD-03/CAP-3.
  const tA11y = await getTranslations({ locale, namespace: 'accessibility' });
  const targetLocale = resolveTargetLocale(locale);
  // Real SSR catalog-coverage probe (FR-B.4 / Trust Invariant #7): fraction of
  // PL leaf translation keys that the active locale ships as non-empty strings.
  // PL (canonical fallback) is always 1; non-PL locales surface the banner only
  // when they are materially behind PL (per LocaleFallbackNotice hysteresis).
  // TODO(Story 2.x): fragmenty pochodzące z PL fallback messages MUSZĄ być w
  // `<div lang="pl">` per NFR5.4 (`<html lang>` integrity dla fallback fragments).
  const pageCoverage = computeLocaleCoverage(locale);

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
        <LocaleFallbackNotice
          fallbackLocale={FALLBACK_LOCALE}
          pageCoverage={pageCoverage}
          targetLocale={targetLocale}
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
        <LocaleFallbackNotice
          fallbackLocale={FALLBACK_LOCALE}
          pageCoverage={pageCoverage}
          targetLocale={targetLocale}
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
