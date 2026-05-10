import type { MetadataRoute } from 'next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/routing';
import { getSellers } from '@/lib/data/seller';
import { toHreflang } from '@/lib/helpers/hreflang';

/**
 * Story v160-3-3: Sitemap.xml + canonical SEO continuity for `/sellers/*`.
 *
 * Next.js 15.5+ App Router root-level sitemap. Single handler emits all
 * locale × route entries; search engines fetch one `/sitemap.xml` endpoint.
 * Decision rationale (per Story 3.3 Dev Notes T2.3): single-domain
 * multi-locale setup (`/{pl,en}/...`) — root-level preferred over per-locale
 * `[locale]/sitemap.ts` (which would need a sitemap index for multi-domain).
 *
 * Entries:
 *   - per locale × static `/sellers` (list page) — changeFrequency weekly,
 *     priority 0.8
 *   - per locale × per active seller `/sellers/<handle>` — changeFrequency
 *     monthly, priority 0.6
 *
 * Excluded:
 *   - legacy `/salony/*` URLs — directory removed Story 3.1, redirect chain
 *     handled by middleware in Story 3.2; sitemap exposes only canonical
 *     `/sellers/*` paths
 *
 * Defensive: `getSellers()` already `.catch(() => [])`s any backend error;
 * sitemap renders static portions even when Mercur 2 `/store/sellers` is
 * unreachable (matches Story 3.0 baseline degradation note).
 *
 * lastModified: constant `new Date()` MVP — search engines re-crawl based on
 * changeFrequency hints. Per-seller `updated_at` upgrade tracked as Epic 4
 * follow-up if/when Mercur 2 payload exposes the field.
 *
 * Base URL: `NEXT_PUBLIC_BASE_URL` if set (matches `robots.ts` pattern), else
 * relative URLs. Production deploy MUST set `NEXT_PUBLIC_BASE_URL` for
 * absolute `<loc>` in sitemap.xml.
 *
 * Revalidation: 1h (3600s) — fresh sellers reach search engines hourly
 * without forcing per-request DB hits. Build-time freeze would require
 * redeploy on every new seller; runtime + revalidate strikes the balance.
 */

export const revalidate = 3600;

const SAFE_FALLBACK_BASE = 'http://localhost:3000';
const STATIC_LOCALIZED_ROUTES = [
  '',
  '/categories',
  '/regulamin',
  '/polityka-prywatnosci',
  '/zasady',
  '/pomoc',
  '/sellers',
] as const;

function resolveBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL;
  const candidate = (raw ?? '').trim().replace(/\/$/, '');
  return candidate || SAFE_FALLBACK_BASE;
}

function localizedUrl(base: string, locale: string, path = ''): string {
  return `${base}/${locale}${path}`;
}

function buildAlternates(base: string, path = ''): NonNullable<MetadataRoute.Sitemap[number]['alternates']> {
  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, locale) => {
    acc[toHreflang(locale)] = localizedUrl(base, locale, path);
    return acc;
  }, {});

  return {
    languages: {
      ...languages,
      'x-default': localizedUrl(base, DEFAULT_LOCALE, path),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolveBaseUrl();
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [];

  // Static localized entries: per active locale with cross-locale alternates.
  for (const route of STATIC_LOCALIZED_ROUTES) {
    for (const locale of SUPPORTED_LOCALES) {
      entries.push({
        url: localizedUrl(base, locale, route),
        lastModified,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : route === '/sellers' ? 0.8 : 0.6,
        alternates: buildAlternates(base, route),
      });
    }
  }

  // Dynamic detail entries: per locale × per active seller handle
  let sellers: Awaited<ReturnType<typeof getSellers>> = [];
  try {
    sellers = await getSellers();
  } catch {
    sellers = [];
  }

  for (const locale of SUPPORTED_LOCALES) {
    for (const seller of sellers) {
      if (!seller.handle) continue;
      entries.push({
        url: localizedUrl(base, locale, `/sellers/${seller.handle}`),
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.6,
        alternates: buildAlternates(base, `/sellers/${seller.handle}`),
      });
    }
  }

  return entries;
}
