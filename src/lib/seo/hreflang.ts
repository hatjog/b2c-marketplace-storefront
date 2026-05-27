import type { Metadata } from 'next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/routing';
import { toHreflang, toHreflangBare } from '@/lib/helpers/hreflang';

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

const buildAbsoluteUrl = (baseUrl: string, locale: string, routeType: SeoRouteType, slug: string) =>
  new URL(`/${locale}/${routeType}/${trimSlashes(slug)}`, `${baseUrl}/`).toString();

export function buildLocaleSeoAlternates(
  baseUrl: string,
  locale: string,
  routeType: SeoRouteType,
  slug: string
): LocaleSeoAlternates {
  const languages: Record<string, string> = {};
  for (const supported of SUPPORTED_LOCALES) {
    languages[toHreflang(supported)] = buildAbsoluteUrl(baseUrl, supported, routeType, slug);
  }
  languages['x-default'] = buildAbsoluteUrl(baseUrl, DEFAULT_LOCALE, routeType, slug);

  return {
    canonical: buildAbsoluteUrl(baseUrl, locale, routeType, slug),
    languages
  };
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
      'twitter:lang': toHreflangBare(locale)
    }
  };
}
