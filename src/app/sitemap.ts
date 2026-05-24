import type { MetadataRoute } from 'next';

import { buildSitemap } from '@/lib/seo/sitemap';

/**
 * Storefront sitemap.xml — Next.js App Router root-level sitemap.
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-01 Story 6.6 Stream G):
 *   - Delegates to `@/lib/seo/sitemap#buildSitemap` which emits 5 route
 *     families (static / category / seller / blog_post / programmatic_geo_landing).
 *   - Per-locale alternates use bare hreflang (`pl/en/uk/de`).
 *   - Production builds without `NEXT_PUBLIC_BASE_URL` throw at runtime
 *     (fail-closed canonical guard — review-6-6 M2).
 *
 * Revalidation: 1h (3600s) — search engines re-crawl based on
 * changeFrequency hints; fresh sellers / posts / categories reach
 * crawlers hourly without per-request DB hits.
 */

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { entries } = await buildSitemap();
  return entries;
}
