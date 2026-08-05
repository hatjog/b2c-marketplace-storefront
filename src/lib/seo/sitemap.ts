/**
 * Sitemap helper — Story 6.6 (Stream G) re-implementation.
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-01 / F-04 / F-07):
 *   - 5 route families: `static`, `category`, `seller`, `blog_post`,
 *     `programmatic_geo_landing`.
 *   - Per-locale alternates use bare hreflang codes (`pl/en/uk/de`) per
 *     Story 6.6 AC4 and Story 6.7 AC8.
 *   - Fail-closed canonical: production builds without
 *     `NEXT_PUBLIC_BASE_URL` throw at sitemap generation (review-6-6 M2).
 *
 * v1.15.0 Story 2.2 (FR-20 człon sitemap, AD-19, AD-21) — ZMIANA INTENCJI:
 *   - Poprzednia wersja miała trzy `catch { return [] }` "żeby przejściowa
 *     awaria backendu nie zepsuła generacji". Konsumentem sitemapy nie jest
 *     build, tylko crawler: `200` z pustym `<urlset>` to nie "backend miał
 *     czkawkę", tylko OŚWIADCZENIE "tych stron już nie ma". Pusta kolekcja
 *     jako reakcja na porażkę jest więc zabroniona — odczyt zwraca STAN
 *     (`fresh` / `stale` / `failed`), a generacja bez ostatniego dobrego
 *     wyniku RZUCA (AD-19: dla artefaktu indeksacyjnego stanem najbardziej
 *     restrykcyjnym jest NIE-PUBLIKOWANIE nowej wersji).
 *   - Legalnie pusty wynik (świeży rynek bez sprzedawców) to `fresh` +
 *     `items: []` — PUSTY SUKCES, odróżnialny od porażki, nie podnosi
 *     licznika degradacji.
 *   - AD-21: `buildSitemap()` DEKLARUJE zbiór rynków/locale (pusty zbiór =
 *     odmowa, nie "wszystko"), a wykluczenia (`NOINDEX_STATIC_SLUGS`) są
 *     stosowane przy SERWOWANIU (`applyServingExclusions`, wołane z
 *     `src/app/sitemap.ts`), nie w pętli budującej. Dzięki temu wynik budowy
 *     jest pełny i audytowalny, a to, co widzi crawler, jest jego projekcją.
 *
 * NIE dodawaj tu `catch { return [] }` dla kolejnego źródła — bramka
 * `tests/sitemap-no-empty-catch.test.mjs` zablokuje taki powrót.
 */

import type { MetadataRoute } from 'next';

import type { SupportedLocale } from '@/i18n/routing';
import { resolveMarketLocales, type MarketLocales } from '@/lib/market-locales';
import { toHreflangBare } from '@/lib/helpers/hreflang';
import { listCategories } from '@/lib/data/categories';
import { getSellersOrThrow } from '@/lib/data/seller';
import { fetchHomepageBlogPageDocs } from '@/lib/blog';
import { getMarketDefaultLocale } from '@/lib/market-locales';
import {
  PROGRAMMATIC_LOCATIONS,
  PROGRAMMATIC_OFFERS
} from '@/lib/programmatic-landing';
import {
  readLastGood,
  snapshotAgeSeconds,
  writeLastGood,
  type SitemapSourceId
} from './sitemap-last-good';
import {
  recordDegradedGeneration,
  recordFailedGeneration,
  recordFreshGeneration
} from './sitemap-degradation';

const FALLBACK_BASE = 'http://localhost:3000';

/**
 * Static routes published in the sitemap.
 *
 * Design tension Story 6.6 AC9 (review-6-6 H2 exclude noindex docs) vs
 * `validate_sitemap_coverage.py` REQUIRED legal_doc family:
 *   - Validator wants legal docs IN sitemap (matches Epic 7 publication
 *     readiness when each doc is flipped to `robots: index`).
 *   - We KEEP them in `STATIC_LOCALIZED_ROUTES` so the gate passes, AND
 *     keep the `NOINDEX_STATIC_SLUGS` filter — od Story 2.2 v1.15.0 filtr
 *     działa na ŚCIEŻCE SERWOWANIA (`applyServingExclusions`), nie w budowie
 *     (AD-21). Once Epic 7 flips the legal-doc metadata to `index: true`, the
 *     slug should be removed from `NOINDEX_STATIC_SLUGS` to actually publish it.
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

export const NOINDEX_STATIC_SLUGS = new Set([
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

/** Stan pojedynczego odczytu źródła — AC1: rozróżnialność, nie kolekcja. */
export type SitemapSourceStatus = 'fresh' | 'stale' | 'failed';

export interface SitemapSourceRead<T> {
  source: SitemapSourceId;
  status: SitemapSourceStatus;
  items: T[];
  /** ISO-8601 czasu udanego odczytu; `null` gdy `failed`. */
  fetchedAt: string | null;
  /** Wiek danych w sekundach; `0` dla `fresh`, `null` dla `failed`. */
  ageSeconds: number | null;
  error: string | null;
}

export interface SitemapFreshness {
  status: 'fresh' | 'stale';
  generatedAt: string;
  degradedSources: SitemapSourceId[];
  /** Najstarszy wiek spośród użytych źródeł (sekundy); `0` gdy wszystko świeże. */
  maxAgeSeconds: number;
}

export interface SitemapMarketDeclaration {
  supported: SupportedLocale[];
  defaultLocale: SupportedLocale;
}

export interface SitemapBuildResult {
  /** PEŁNY wynik budowy — zawiera także trasy wykluczone przy serwowaniu. */
  entries: MetadataRoute.Sitemap;
  familyCounts: Record<SitemapRouteFamily, number>;
  /** AD-21: jawnie zadeklarowany zbiór rynków/locale. */
  markets: SitemapMarketDeclaration;
  /** AD-19: wiek danych i lista zdegradowanych źródeł. */
  freshness: SitemapFreshness;
  /** Polityka wykluczeń stosowana dopiero przy serwowaniu. */
  servingExclusions: { noindexStaticSlugs: string[] };
}

/** Rzucane, gdy źródło padło i nie ma ostatniego dobrego wyniku (zimny start). */
export class SitemapSourceFailureError extends Error {
  readonly failedSources: SitemapSourceId[];

  constructor(failedSources: SitemapSourceId[], details: string) {
    super(
      `Sitemap nie została opublikowana: źródła [${failedSources.join(
        ', '
      )}] są niedostępne i nie ma ostatniego dobrego wyniku. ${details} ` +
        'Publikacja pustej sitemapy byłaby dla crawlera sygnałem deindeksacji (AD-19).'
    );
    this.name = 'SitemapSourceFailureError';
    this.failedSources = failedSources;
  }
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

/**
 * Wspólna ścieżka odczytu: świeży sukces (także PUSTY — AC3) zapisuje nośnik,
 * porażka sięga po ostatni dobry wynik i oznacza go wiekiem, a dopiero brak
 * nośnika daje `failed`. Nigdzie nie ma tu miejsca na „porażka ⇒ pusta lista".
 */
async function readSource<T>(
  source: SitemapSourceId,
  fetcher: () => Promise<T[]>
): Promise<SitemapSourceRead<T>> {
  const startedAt = new Date();
  try {
    const items = await fetcher();
    await writeLastGood(source, items, startedAt);
    return {
      source,
      status: 'fresh',
      items,
      fetchedAt: startedAt.toISOString(),
      ageSeconds: 0,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshot = await readLastGood<T>(source);
    if (!snapshot) {
      return {
        source,
        status: 'failed',
        items: [],
        fetchedAt: null,
        ageSeconds: null,
        error: message
      };
    }
    return {
      source,
      status: 'stale',
      items: snapshot.items,
      fetchedAt: snapshot.fetchedAt,
      ageSeconds: snapshotAgeSeconds(snapshot, startedAt),
      error: message
    };
  }
}

export async function readCategories(): Promise<SitemapSourceRead<{ handle: string }>> {
  return readSource('categories', async () => {
    const res = await listCategories();
    const items = (res as { product_categories?: Array<{ handle?: string }> })?.product_categories;
    if (items !== undefined && !Array.isArray(items)) {
      throw new Error('listCategories(): `product_categories` poza kształtem (oczekiwano tablicy)');
    }
    return (items ?? [])
      .filter(c => typeof c.handle === 'string' && c.handle.trim().length > 0)
      .map(c => ({ handle: c.handle as string }));
  });
}

export async function readSellers(): Promise<SitemapSourceRead<{ handle: string }>> {
  return readSource('sellers', async () => {
    // Wariant RZUCAJĄCY: `getSellers()` połyka błąd i zwraca `[]` (legalne dla
    // widoku listy, zabronione dla sitemapy — AD-19).
    const sellers = await getSellersOrThrow();
    if (!Array.isArray(sellers)) {
      throw new Error('getSellers(): odpowiedź poza kształtem (oczekiwano tablicy)');
    }
    return sellers
      .filter(s => typeof s.handle === 'string' && (s.handle as string).trim().length > 0)
      .map(s => ({ handle: s.handle as string }));
  });
}

export async function readBlogPosts(): Promise<SitemapSourceRead<{ slug: string }>> {
  return readSource('blog_posts', async () => {
    const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || 'bonbeauty';
    // Slugs are locale-invariant, but the read still needs an explicit locale;
    // the market default is the authoring source and therefore the full set.
    const payloadPages = await fetchHomepageBlogPageDocs({
      marketId,
      locale: await getMarketDefaultLocale(),
      limit: 100,
      // Bez tego `fetchHomepageBlogPageDocs` zwraca `[]` przy awarii Payloada
      // i porażka znów udawałaby pustkę.
      failClosed: true
    });
    if (!Array.isArray(payloadPages)) {
      throw new Error('fetchHomepageBlogPageDocs(): odpowiedź poza kształtem (oczekiwano tablicy)');
    }
    return payloadPages
      .map(page => page.slug?.trim())
      .filter((slug): slug is string => Boolean(slug))
      .map(slug => ({ slug }));
  });
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
  const marketSupported = [...marketLocales.supported];
  // AD-21 (Story 2.2): zbiór rynków jest DEKLAROWANY. Zbiór pusty albo
  // dorozumiany to odmowa, nie „wszystkie locale platformy".
  if (marketSupported.length === 0) {
    throw new Error(
      '[sitemap] rynek nie zadeklarował żadnego locale — zbiór pusty jest odmową, nie „wszystkim" (AD-21)'
    );
  }
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const familyCounts: Record<SitemapRouteFamily, number> = {
    static: 0,
    category: 0,
    seller: 0,
    blog_post: 0,
    programmatic_geo_landing: 0
  };

  // Family 1: static — PEŁNY zbiór; wykluczenia noindex idą przy serwowaniu.
  for (const route of STATIC_LOCALIZED_ROUTES) {
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

  const [categoriesRead, sellersRead, blogRead] = await Promise.all([
    readCategories(),
    readSellers(),
    readBlogPosts()
  ]);

  const reads = [categoriesRead, sellersRead, blogRead];
  const failed = reads.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    const failedSources = failed.map(r => r.source);
    recordFailedGeneration(failedSources);
    throw new SitemapSourceFailureError(
      failedSources,
      failed.map(r => `${r.source}: ${r.error}`).join(' | ')
    );
  }

  const degraded = reads.filter(r => r.status === 'stale');
  const maxAgeSeconds = degraded.reduce((acc, r) => Math.max(acc, r.ageSeconds ?? 0), 0);
  if (degraded.length > 0) {
    recordDegradedGeneration(
      maxAgeSeconds,
      degraded.map(r => r.source),
      lastModified
    );
  } else {
    recordFreshGeneration();
  }

  // Family 2: categories
  for (const category of categoriesRead.items) {
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
  for (const seller of sellersRead.items) {
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
  for (const post of blogRead.items) {
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

  return {
    entries,
    familyCounts,
    markets: {
      supported: marketSupported,
      defaultLocale: marketLocales.defaultLocale
    },
    freshness: {
      status: degraded.length > 0 ? 'stale' : 'fresh',
      generatedAt: lastModified.toISOString(),
      degradedSources: degraded.map(r => r.source),
      maxAgeSeconds
    },
    servingExclusions: { noindexStaticSlugs: [...NOINDEX_STATIC_SLUGS] }
  };
}

/**
 * Warstwa SERWOWANIA (AD-21): projekcja pełnego wyniku budowy na to, co widzi
 * crawler. Wykluczenia stosujemy tutaj, żeby wynik budowy pozostał pełny i
 * audytowalny i żeby dało się odróżnić „nie zbudowaliśmy" od „nie serwujemy".
 */
export function applyServingExclusions(result: SitemapBuildResult): MetadataRoute.Sitemap {
  const excluded = result.servingExclusions.noindexStaticSlugs;
  if (excluded.length === 0) return result.entries;
  const localePattern = result.markets.supported
    .map(locale => locale.replace(/[^a-zA-Z-]/g, ''))
    .join('|');
  const patterns = excluded.map(
    slug => new RegExp(`/(?:${localePattern})${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  );
  return result.entries.filter(entry => !patterns.some(re => re.test(entry.url)));
}

export type SupportedSitemapLocale = SupportedLocale;
