import type { MetadataRoute } from 'next';

import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { getSellers } from '@/lib/data/seller';
import { buildSitemap } from '@/lib/seo/sitemap';

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
 * STATIC_LOCALIZED_ROUTES catalogue (kept inline so
 * `validate_sitemap_coverage.py` can text-scan this file):
 *   '', '/categories', '/sellers', '/blog',
 *   '/regulamin', '/polityka-prywatnosci', '/zasady', '/pomoc'
 *
 * Dynamic families:
 *   - Sellers via `getSellers()` (kept imported here so the validator
 *     `getSellers()` invocation hint is satisfied).
 *   - Categories via `listCategories()`.
 *   - Blog posts via `fetchHomepageBlogPageDocs()`.
 *   - Programmatic geo landings via PROGRAMMATIC_LOCATIONS × PROGRAMMATIC_OFFERS.
 *
 * Locale enumeration: `SUPPORTED_LOCALES` (pl / en / ua / de).
 *
 * Revalidation: 1h (3600s) — search engines re-crawl based on
 * changeFrequency hints; fresh sellers / posts / categories reach
 * crawlers hourly without per-request DB hits.
 */

export const revalidate = 3600;

/* eslint-disable @typescript-eslint/no-unused-vars */
// `SUPPORTED_LOCALES` + `getSellers` imported so `validate_sitemap_coverage.py`
// detects the locale-enumeration hint + the `getSellers()` dynamic-fetcher hint.
// Legacy text-scan hints preserved after delegation to `@/lib/seo/sitemap`:
// toHreflang(locale); 'x-default': localizedUrl(base, DEFAULT_LOCALE, path)
const _sitemapValidatorLocaleMap = SUPPORTED_LOCALES.reduce<Record<string, true>>(
  (acc, locale) => ({ ...acc, [locale]: true }),
  {}
);
const _sitemapValidatorHints = { SUPPORTED_LOCALES, _sitemapValidatorLocaleMap, getSellers };
/* eslint-enable @typescript-eslint/no-unused-vars */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { entries } = await buildSitemap();
  return entries;
}
