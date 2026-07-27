import type { Metadata } from 'next';

import { resolveMarketLocales } from '@/lib/market-locales';
import { toHreflang } from '@/lib/helpers/hreflang';

export interface LocaleSeoAlternates {
  canonical: string;
  languages: Record<string, string>;
}

export interface LocaleSocialMetadata {
  openGraph: Pick<NonNullable<Metadata['openGraph']>, 'locale' | 'alternateLocale'>;
  other: Record<string, string>;
}

export type SeoRouteType = 'categories' | 'products' | 'sellers';

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '');

const composePath = (locale: string, routeType: SeoRouteType, slug: string): string => {
  const trimmed = trimSlashes(slug);
  return trimmed ? `/${locale}/${routeType}/${trimmed}` : `/${locale}/${routeType}`;
};

/**
 * SSOT for locale alternates (canonical + BCP47 languages + x-default).
 * `pathFor(locale)` returns a path beginning with `/`. When `baseUrl` is
 * provided each path is resolved to an absolute URL; otherwise relative
 * paths are returned and Next.js resolves them against `metadataBase`.
 *
 * Single source per D-122 (R-3); since Story 1.1 v1.14.0 entries are emitted
 * only for the market's locales (resolver, AD-2) and x-default points at the
 * market's `locales.default` — the `ua↔uk-UA` map stays in `toHreflang`.
 *
 * Story 1.4 v1.14.0 (ADR-153 pkt 3, amend ADR-164): opcjonalny `includeLocale`
 * pozwala wyłączyć z hreflang-setu locale, w których dana encja jest poniżej
 * progu jakości. Sygnały SEO mają być SPÓJNE — `noindex` bez hreflang-exclude
 * to dokładnie alternatywa odrzucona w ADR-153. `canonical` zostaje self-em
 * bieżącego locale nawet przy `noindex` (poprawne: strona istnieje i jest
 * serwowana, po prostu nie chcemy jej w indeksie).
 */
export async function buildLocaleAlternates(
  locale: string,
  pathFor: (loc: string) => string,
  baseUrl?: string,
  options?: { includeLocale?: (loc: string) => boolean }
): Promise<LocaleSeoAlternates> {
  const { supported, defaultLocale } = await resolveMarketLocales();
  const includeLocale = options?.includeLocale ?? (() => true);

  const toUrl = (loc: string): string => {
    const path = pathFor(loc);
    return baseUrl ? new URL(path, `${baseUrl}/`).toString() : path;
  };

  const languages: Record<string, string> = {};
  for (const marketLocale of supported) {
    if (includeLocale(marketLocale)) {
      languages[toHreflang(marketLocale)] = toUrl(marketLocale);
    }
  }
  if (includeLocale(defaultLocale)) {
    languages['x-default'] = toUrl(defaultLocale);
  }

  return {
    canonical: toUrl(locale),
    languages
  };
}

export async function buildLocaleSeoAlternates(
  baseUrl: string,
  locale: string,
  routeType: SeoRouteType,
  slug: string,
  options?: { includeLocale?: (loc: string) => boolean }
): Promise<LocaleSeoAlternates> {
  return buildLocaleAlternates(
    locale,
    (loc) => composePath(loc, routeType, slug),
    baseUrl,
    options
  );
}

export async function buildLocaleSocialMetadata(locale: string): Promise<LocaleSocialMetadata> {
  const { supported } = await resolveMarketLocales();
  const current = toHreflang(locale);
  const alternateLocale = supported.map(toHreflang).filter(code => code !== current);

  // Open Graph requires `language_TERRITORY` (underscore: pl_PL); crawlers ignore
  // the hyphenated BCP-47 form. hreflang/<html lang> keep the hyphen (correct there).
  const toOgLocale = (code: string): string => code.replace('-', '_');

  return {
    openGraph: {
      locale: toOgLocale(current),
      alternateLocale: alternateLocale.map(toOgLocale)
    },
    other: {
      // Twitter accepts BCP-47 hyphenated form.
      'twitter:lang': current
    }
  };
}
