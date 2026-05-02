import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/routing';

/**
 * Story v160-3-3: SEO continuity helper for `/[locale]/sellers/*` routes.
 *
 * Builds Next.js `Metadata.alternates` shape for `<link rel="canonical">`
 * + `<link rel="alternate" hreflang="...">` cross-locale tags.
 *
 * Path semantics:
 *   - suffix `''` → list page    `/[locale]/sellers`
 *   - suffix `/<handle>` → detail page `/[locale]/sellers/<handle>`
 *
 * Returns relative URLs (no scheme/host prefix). Next.js resolves them
 * against `metadataBase` (or current request origin) when rendering. This
 * mirrors the `robots.ts` pattern where `NEXT_PUBLIC_BASE_URL` is treated
 * as opt-in.
 *
 * BCP 47: `pl`, `en` only (per `routing.ts` SUPPORTED_LOCALES). Region-
 * specific codes (`pl-PL`, `en-GB`) NOT used — out-of-scope v1.6.0.
 *
 * `x-default`: per Google docs, points to canonical fallback (DEFAULT_LOCALE
 * = `pl`). Search engines use this when user locale matches none in the map.
 */
export interface SellerAlternates {
  canonical: string;
  languages: Record<string, string>;
}

const buildPath = (locale: string, suffix: string): string =>
  `/${locale}/sellers${suffix}`;

export function buildSellerAlternates(
  locale: string,
  suffix: string = ''
): SellerAlternates {
  const languages: Record<string, string> = {};
  for (const supported of SUPPORTED_LOCALES) {
    languages[supported] = buildPath(supported, suffix);
  }
  languages['x-default'] = buildPath(DEFAULT_LOCALE, suffix);

  return {
    canonical: buildPath(locale, suffix),
    languages
  };
}
