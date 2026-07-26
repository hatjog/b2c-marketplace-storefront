import type { HttpTypes } from '@medusajs/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';

import { toStorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';
import { buildLocaleSeoAlternates, buildLocaleSocialMetadata } from '@/lib/seo/hreflang';

import { getGpField, readContentBarFlag } from './metadata-utils';

/**
 * Story 1.4 v1.14.0 — ADR-153 pkt 3 (spójność sygnałów SEO), amend ADR-164.
 *
 * PDP poniżej progu jakości w danym locale dostaje `noindex` ORAZ wypada
 * z hreflang-setu. Sygnałem jest `metadata.gp.content_bar[<locale>].bar`,
 * liczony w sync-time (AD-4) — TEN SAM, którego używa `checkQualityGate`;
 * storefront nadal nie liczy słów i nie ma drugiego miejsca oceny jakości.
 *
 * Trzeci sygnał ADR-153 — sitemap-exclude — jest spełniony konstrukcyjnie:
 * `src/lib/seo/sitemap.ts` publikuje pięć rodzin route'ów (`static`,
 * `category`, `seller`, `blog_post`, `programmatic_geo_landing`) i NIE emituje
 * PDP w ogóle. Regresję pilnuje `src/lib/seo/sitemap-pdp-exclusion.test.ts`.
 *
 * EE-1: encja BEZ `content_bar` (okno deploy→re-sync) zachowuje zastane
 * zachowanie — `index, follow` + pełny hreflang-set. Brak sygnału nie może
 * po cichu wygasić SEO całego katalogu.
 */
function isLocaleAboveContentBar(
  metadata: Record<string, unknown> | null | undefined,
  locale: string
): boolean {
  return readContentBarFlag(metadata, locale) !== false;
}

/**
 * Returns `url` unless it points to an SVG file, in which case returns `fallback`.
 * SVG is not supported as OG image by Facebook, Twitter/X, LinkedIn, or Slack crawlers.
 */
export function toSafeOgImageUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  // Block SVG data URIs (unsupported by social crawlers, not remotely fetchable)
  if (url.toLowerCase().startsWith('data:image/svg')) return fallback;
  // Strip query string and fragment before checking extension
  const cleanUrl = url.split('?')[0].split('#')[0];
  if (cleanUrl.toLowerCase().endsWith('.svg')) return fallback;
  return url;
}

export interface GpSeoMetadata {
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
}

/**
 * Resolves GP SEO metadata from entity metadata using ADR-054 namespace:
 * metadata.gp.seo.* → undefined
 */
export function resolveGpSeoMetadata(
  metadata: Record<string, unknown> | null | undefined
): GpSeoMetadata {
  const gpSeo = getGpField<GpSeoMetadata>(metadata, 'seo');
  return {
    meta_title: gpSeo?.meta_title,
    meta_description: gpSeo?.meta_description,
    og_image_url: gpSeo?.og_image_url
  };
}

/**
 * Builds Next.js Metadata for PDP including BCP47 hreflang matrix + OG/Twitter
 * per locale (Story 2.3 / D-122).
 *
 * @param product Store product (handle drives canonical slug).
 * @param locale  Request locale — MUST originate z route param (`params.locale`),
 *                NIE z cookie/header, aby zachować deterministic crawler behavior
 *                (R-7). Param wymagany — wszyscy callers muszą propagować locale.
 *
 * `metadataBase` (R-8) celowo ustawione na `baseUrl` (origin) — wszystkie URL w
 * tym helperze są już absolutne, więc semantycznie no-op. Wcześniej było
 * `${baseUrl}/products/${handle}` — bug, bo metadataBase powinno wskazywać na
 * origin, nie konkretną stronę.
 */
export const generateProductMetadata = async (
  product: HttpTypes.StoreProduct,
  locale: string
): Promise<Metadata> => {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  // Story 1.3 (review 1-3-F15): surowy param route'u normalizowany tym samym
  // torem co warstwa danych (`page.tsx` → toStorefrontLocaleSlug) — bez tego
  // nieobsługiwana wartość szłaby do getTranslations/hreflang i cofała metadane
  // na DEFAULT_LOCALE innym mechanizmem niż render (rozjazd klasy v1.13.0).
  const localeSlug = toStorefrontLocaleSlug(locale);

  const seo = resolveGpSeoMetadata(product?.metadata as Record<string, unknown> | null | undefined);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const gpVendor =
    getGpField<string>(product?.metadata as Record<string, unknown>, 'vendor_name') ?? siteName;

  const title = seo.meta_title ?? product?.title ?? siteName;
  // Story 1.3 (AC3): fallback description przez i18n z JAWNYM locale z route'u
  // (R-7 — nigdy auto-resolve w kontynuacji metadanych), tym samym kluczem,
  // którego używa ProductPage. Poprzedni hardcoded PL literał wyciekał do
  // SERP/og:description/twitter:description na /ua /de /en. Fallback liczony
  // leniwie (review 1-3-F14): przy jawnym meta_description nie ładujemy
  // namespace'u na gorącej ścieżce crawlera.
  const description =
    seo.meta_description ??
    (await getTranslations({ locale: localeSlug, namespace: 'pdp' }))(
      'meta.description_fallback',
      {
        title: product?.title ?? siteName,
        vendor: gpVendor,
        siteName
      }
    );
  const ogImageRaw = seo.og_image_url ?? product?.thumbnail ?? null;
  const ogImage = toSafeOgImageUrl(
    ogImageRaw,
    `${protocol}://${host}/B2C_Storefront_Open_Graph.png`
  );
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
  const productMetadata = product?.metadata as Record<string, unknown> | null | undefined;
  const alternates = await buildLocaleSeoAlternates(
    baseUrl,
    localeSlug,
    'products',
    product?.handle ?? '',
    { includeLocale: (loc) => isLocaleAboveContentBar(productMetadata, loc) }
  );
  const social = await buildLocaleSocialMetadata(localeSlug);

  return {
    title,
    description,
    robots: isLocaleAboveContentBar(productMetadata, localeSlug)
      ? 'index, follow'
      : 'noindex, follow',
    metadataBase: new URL(baseUrl),
    alternates,

    openGraph: {
      ...social.openGraph,
      title,
      description,
      url: alternates.canonical,
      siteName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title
        }
      ],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    },
    other: social.other
  };
};
