import type { MetadataRoute } from 'next';

import { applyServingExclusions, buildSitemap } from '@/lib/seo/sitemap';

/**
 * Storefront sitemap.xml — Next.js App Router root-level sitemap.
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-01 / Story 6.6 Stream G):
 *   - Delegates to `@/lib/seo/sitemap#buildSitemap` which emits 5 route
 *     families (static / category / seller / blog_post / programmatic_geo_landing).
 *   - Per-locale alternates use bare hreflang (`pl/en/uk/de`).
 *   - Production builds without `NEXT_PUBLIC_BASE_URL` throw at runtime
 *     (fail-closed canonical guard — review-6-6 M2).
 *
 * Katalog tras, fetchery i wyliczenie locale żyją w `@/lib/seo/sitemap` —
 * ten plik jest wyłącznie warstwą SERWOWANIA (AD-21). Do v1.15.0 stały tu
 * atrapy (`_sitemapValidatorHints` z importem `getSellers` i `SUPPORTED_LOCALES`)
 * wyłącznie po to, żeby uciszyć `validate_sitemap_coverage.py`. Review 2.2
 * [MEDIUM] wykazał, że walidator utrwalał w ten sposób jako „wymagane"
 * wywołanie `getSellers()`, którego ta story WPROST ZAKAZUJE na ścieżce
 * sitemapy (połyka błąd i zwraca `[]`, AD-19) — powrót do wariantu
 * tolerancyjnego byłby dla walidatora BARDZIEJ zielony, nie mniej.
 * Walidator jest od tego fixu przepięty na realny katalog
 * (`GP/storefront/src/lib/seo/sitemap.ts`), więc atrapy zniknęły.
 *
 * Renderowanie: `force-dynamic` — rozstrzygnięte, nie odziedziczone
 * (review 2.2, [HIGH] blast radius + [LOW] martwy `revalidate`).
 *
 * Historycznie stało tu `export const revalidate = 3600` z uzasadnieniem
 * „crawler dostaje świeży wynik co godzinę bez odczytów per żądanie". Pomiar
 * na prod-buildzie (`evidence/2-2/t7-degradacja-prod-build.txt`) pokazał, że
 * ta deklaracja była MARTWA: fetch `market-configs` ma `revalidate: 0`, więc
 * Next i tak schodził na ścieżkę dynamiczną (`DYNAMIC_SERVER_USAGE`), a dwa
 * kolejne żądania `curl` podbijały licznik degradacji. Deklarowany cache nie
 * działał.
 *
 * Skutkiem ubocznym prerenderu było to, że fail-closed z AD-19 wybuchał
 * w NIEWŁAŚCIWYM miejscu: `Export encountered an error on /sitemap.xml/route,
 * exiting the build` — awaria backendu przestawała kosztować pozycje
 * organiczne, a zaczynała kosztować możliwość wydania czegokolwiek (także
 * hotfixa niezwiązanego z SEO). AD-19 wymaga „nie publikuj nowej wersji
 * ARTEFAKTU INDEKSACYJNEGO", nie „nie publikuj storefrontu".
 *
 * `force-dynamic` rozdziela te dwie rzeczy: build przechodzi, a awaria źródła
 * bez ostatniego dobrego wyniku daje crawlerowi `5xx` NA ŻĄDANIU — czyli
 * „spróbuj później", nigdy pusty `<urlset>`. Koszt jest zerowy, bo route
 * i tak renderował się dynamicznie.
 */

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Story 2.2 v1.15.0 (AD-19/AD-21): `buildSitemap()` RZUCA, gdy źródło padło
  // i nie ma ostatniego dobrego wyniku — celowo nie łapiemy tego tutaj.
  // Wyjątek daje crawlerowi `5xx` („spróbuj później"), a pusty `<urlset>`
  // dałby mu oświadczenie „tych stron już nie ma". Wykluczenia noindex
  // stosujemy dopiero TU, na ścieżce serwowania.
  const result = await buildSitemap();

  if (result.freshness.status === 'stale') {
    console.warn(
      JSON.stringify({
        event: 'sitemap.served_stale',
        max_age_seconds: result.freshness.maxAgeSeconds,
        degraded_sources: result.freshness.degradedSources,
        generated_at: result.freshness.generatedAt,
        // Wiek danych jest też odczytywalny przez /api/seo/sitemap-health.
        health_endpoint: '/api/seo/sitemap-health'
      })
    );
  }

  return applyServingExclusions(result);
}
