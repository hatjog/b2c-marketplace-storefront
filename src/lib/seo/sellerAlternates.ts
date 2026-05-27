import { buildLocaleAlternates, type LocaleSeoAlternates } from './hreflang';

/**
 * Story v160-3-3: SEO continuity helper for `/[locale]/sellers/*` routes.
 *
 * Thin wrapper na `buildLocaleAlternates` (SSOT) — Story 2.3 R-3 dedup:
 * jeden helper iteruje SUPPORTED_LOCALES + x-default; seller-specific
 * pozostaje tylko shape ścieżki (`/[locale]/sellers[<suffix>]`).
 *
 * Suffix shape:
 *   - `''` → list page    `/[locale]/sellers`
 *   - `/<handle>` → detail page `/[locale]/sellers/<handle>`
 *   - `/<handle>/reviews` → reviews tab `/[locale]/sellers/<handle>/reviews`
 *
 * Returns relative URLs; Next.js resolves them against `metadataBase`.
 */
export type SellerAlternates = LocaleSeoAlternates;

export function buildSellerAlternates(locale: string, suffix: string = ''): SellerAlternates {
  return buildLocaleAlternates(locale, (loc) => `/${loc}/sellers${suffix}`);
}
