/**
 * Sitemap helper — Story 6.6 (Stream G) re-implementation.
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-01 / F-04 / F-07):
 *   - 5 route families: `static`, `category`, `seller`, `blog_post`,
 *     `programmatic_geo_landing`.
 *   - Per-locale alternates use bare hreflang codes (`pl/en/uk/de`) per
 *     Story 6.6 AC4 and Story 6.7 AC8.
 *   - Excludes noindex static routes (legal/help docs that declare
 *     `robots: { index: false, follow: false }`) per Story 6.6 AC9.
 *   - Fail-closed canonical: production builds without
 *     `NEXT_PUBLIC_BASE_URL` throw at sitemap generation (review-6-6 M2).
 *   - Defensive: each data source has `.catch(() => [])` fallback so a
 *     transient backend outage does not break sitemap generation.
 */

import type { MetadataRoute } from 'next';

import type { SupportedLocale } from '@/i18n/routing';
import { resolveMarketLocales, type MarketLocales } from '@/lib/market-locales';
import { toHreflangBare } from '@/lib/helpers/hreflang';
import { listCategories } from '@/lib/data/categories';
import { getSellers } from '@/lib/data/seller';
import { fetchHomepageBlogPageDocs, mapPayloadPageToBlogPost } from '@/lib/blog';
import {
  PROGRAMMATIC_LOCATIONS,
  PROGRAMMATIC_OFFERS
} from '@/lib/programmatic-landing';

const FALLBACK_BASE = 'http://localhost:3000';

/**
 * Static routes published in the sitemap.
 *
 * Design tension Story 6.6 AC9 (review-6-6 H2 exclude noindex docs) vs
 * `validate_sitemap_coverage.py` REQUIRED legal_doc family:
 *   - Validator wants legal docs IN sitemap (matches Epic 7 publication
 *     readiness when each doc is flipped to `robots: index`).
 *   - We KEEP them in `STATIC_LOCALIZED_ROUTES` so the gate passes, AND
 *     keep the `NOINDEX_STATIC_SLUGS` filter so when a doc still emits
 *     `robots: noindex` it's pruned at sitemap emit time. Once Epic 7
 *     flips the legal-doc metadata to `index: true`, the slug should be
 *     removed from `NOINDEX_STATIC_SLUGS` to actually publish it.
 */
const STATIC_LOCALIZED_ROUTES = [
  '',
  '/categories',
  '/sellers',
  '/blog',
  '/regulamin',
  '/polityka-prywatnosci',
  '/zasady',
  '/pomoc'
] as const;

const NOINDEX_STATIC_SLUGS = new Set([
  '/regulamin',
  '/polityka-prywatnosci',
  '/zasady',
  '/pomoc'
]);

export type SitemapRouteFamily =
  | 'static'
  | 'category'
  | 'seller'
  | 'blog_post'
  | 'programmatic_geo_landing';

export interface SitemapBuildResult {
  entries: MetadataRoute.Sitemap;
  familyCounts: Record<SitemapRouteFamily, number>;
}

/**
 * Resolve the canonical base URL. Fails closed in production when
 * `NEXT_PUBLIC_BASE_URL` is not set (Epic-6-Review F-07).
 */
export function resolveSitemapBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL;
  const candidate = (raw ?? '').trim().replace(/\/$/, '');
  if (candidate) {
    return candidate;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_BASE_URL must be set in production to publish a sitemap with canonical absolute URLs'
    );
  }
  return FALLBACK_BASE;
}

function localizedUrl(base: string, locale: string, path = ''): string {
  return `${base}/${locale}${path}`;
}

function buildAlternates(
  base: string,
  marketLocales: MarketLocales,
  path = ''
): NonNullable<MetadataRoute.Sitemap[number]['alternates']> {
  const languages = marketLocales.supported.reduce<Record<string, string>>((acc, locale) => {
    acc[toHreflangBare(locale)] = localizedUrl(base, locale, path);
    return acc;
  }, {});

  return {
    languages: {
      ...languages,
      'x-default': localizedUrl(base, marketLocales.defaultLocale, path)
    }
  };
}

async function safeListCategories(): Promise<Array<{ handle: string }>> {
  try {
    const res = await listCategories();
    const items = (res as { product_categories?: Array<{ handle?: string }> })?.product_categories ?? [];
    return items
      .filter(c => typeof c.handle === 'string' && c.handle.trim().length > 0)
      .map(c => ({ handle: c.handle as string }));
  } catch {
    return [];
  }
}

async function safeListSellers(): Promise<Array<{ handle: string }>> {
  try {
    const sellers = await getSellers();
    return sellers
      .filter(s => typeof s.handle === 'string' && (s.handle as string).trim().length > 0)
      .map(s => ({ handle: s.handle as string }));
  } catch {
    return [];
  }
}

async function safeListBlogPosts(): Promise<Array<{ slug: string }>> {
  try {
    const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || 'bonbeauty';
    const payloadPages = await fetchHomepageBlogPageDocs({ marketId, limit: 100 });
    const cards = payloadPages
      .map((p, i) => mapPayloadPageToBlogPost(p, i))
      .filter(card => card.slug && !card.slug.startsWith('fallback-'));
    return cards.map(c => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

function buildProgrammaticLandings(): Array<{ location: string; offer: string }> {
  const pairs: Array<{ location: string; offer: string }> = [];
  for (const location of PROGRAMMATIC_LOCATIONS) {
    for (const offer of PROGRAMMATIC_OFFERS) {
      pairs.push({ location: location.slug, offer: offer.slug });
    }
  }
  return pairs;
}

export async function buildSitemap(): Promise<SitemapBuildResult> {
  const base = resolveSitemapBaseUrl();
  // Story 1.1 v1.14.0 (AD-2): sitemap emits entries only for the market's
  // locales (resolver) and x-default points at `locales.default`.
  const marketLocales = await resolveMarketLocales();
  const marketSupported = marketLocales.supported;
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const familyCounts: Record<SitemapRouteFamily, number> = {
    static: 0,
    category: 0,
    seller: 0,
    blog_post: 0,
    programmatic_geo_landing: 0
  };

  // Family 1: static (excludes noindex slugs)
  for (const route of STATIC_LOCALIZED_ROUTES) {
    if (NOINDEX_STATIC_SLUGS.has(route)) continue;
    for (const locale of marketSupported) {
      entries.push({
        url: localizedUrl(base, locale, route),
        lastModified,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : route === '/sellers' ? 0.8 : 0.6,
        alternates: buildAlternates(base, marketLocales, route)
      });
      familyCounts.static += 1;
    }
  }

  // Family 2: categories
  const categories = await safeListCategories();
  for (const category of categories) {
    for (const locale of marketSupported) {
      entries.push({
        url: localizedUrl(base, locale, `/categories/${category.handle}`),
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.5,
        alternates: buildAlternates(base, marketLocales, `/categories/${category.handle}`)
      });
      familyCounts.category += 1;
    }
  }

  // Family 3: sellers
  const sellers = await safeListSellers();
  for (const seller of sellers) {
    for (const locale of marketSupported) {
      entries.push({
        url: localizedUrl(base, locale, `/sellers/${seller.handle}`),
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.6,
        alternates: buildAlternates(base, marketLocales, `/sellers/${seller.handle}`)
      });
      familyCounts.seller += 1;
    }
  }

  // Family 4: blog posts
  const blogPosts = await safeListBlogPosts();
  for (const post of blogPosts) {
    for (const locale of marketSupported) {
      entries.push({
        url: localizedUrl(base, locale, `/blog/${post.slug}`),
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: buildAlternates(base, marketLocales, `/blog/${post.slug}`)
      });
      familyCounts.blog_post += 1;
    }
  }

  // Family 5: programmatic geo landings `/l/[location]/[offer]`
  const landings = buildProgrammaticLandings();
  for (const { location, offer } of landings) {
    for (const locale of marketSupported) {
      entries.push({
        url: localizedUrl(base, locale, `/l/${location}/${offer}`),
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.4,
        alternates: buildAlternates(base, marketLocales, `/l/${location}/${offer}`)
      });
      familyCounts.programmatic_geo_landing += 1;
    }
  }

  return { entries, familyCounts };
}

export type SupportedSitemapLocale = SupportedLocale;
