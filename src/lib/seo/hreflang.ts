import type { Metadata } from 'next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/routing';
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
 * SSOT for locale alternates (canonical + 4 BCP47 languages + x-default).
 * `pathFor(locale)` returns a path beginning with `/`. When `baseUrl` is
 * provided each path is resolved to an absolute URL; otherwise relative
 * paths are returned and Next.js resolves them against `metadataBase`.
 *
 * Single source iterating SUPPORTED_LOCALES + x-default per D-122 (R-3).
 */
export function buildLocaleAlternates(
  locale: string,
  pathFor: (loc: string) => string,
  baseUrl?: string
): LocaleSeoAlternates {
  const toUrl = (loc: string): string => {
    const path = pathFor(loc);
    return baseUrl ? new URL(path, `${baseUrl}/`).toString() : path;
  };

  const languages: Record<string, string> = {};
  for (const supported of SUPPORTED_LOCALES) {
    languages[toHreflang(supported)] = toUrl(supported);
  }
  languages['x-default'] = toUrl(DEFAULT_LOCALE);

  return {
    canonical: toUrl(locale),
    languages
  };
}

export function buildLocaleSeoAlternates(
  baseUrl: string,
  locale: string,
  routeType: SeoRouteType,
  slug: string
): LocaleSeoAlternates {
  return buildLocaleAlternates(locale, (loc) => composePath(loc, routeType, slug), baseUrl);
}

export function buildLocaleSocialMetadata(locale: string): LocaleSocialMetadata {
  const current = toHreflang(locale);
  const alternateLocale = SUPPORTED_LOCALES.map(toHreflang).filter(code => code !== current);

  return {
    openGraph: {
      locale: current,
      alternateLocale
    },
    other: {
      // Use BCP47 canonical (R-2): aligns with invariant "BCP 47 canonical only"
      // and with og:locale shape. Twitter accepts both forms.
      'twitter:lang': current
    }
  };
}
