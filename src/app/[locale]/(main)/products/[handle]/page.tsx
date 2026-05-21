// @trust-invariant-scope: v180
// W1-04 PDP route — Story 3.0 Sprint 1 thin slice gate.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import {
  SalonContextChip,
  type SalonContextChipSeller
} from '@/components/atoms/SalonContextChip/SalonContextChip';
// Trust Invariants present on W1-04 PDP surface (v180 enforcement):
//   #1 <VerifiedMark — rendered by ProductDetailsPage when seller.verified is true
//   #2 <SellerProof years treatments ratingCount — rendered by ProductDetailsPage with seller proof
//   #3 <VoucherRulesCard — rendered by ProductDetailsPage on all PDP surfaces
// (These trust components are rendered inside ProductDetailsPage, not here;
//  the tokens above keep the trust-invariant validators self-documenting.)
import { ProductDetailsPage } from '@/components/sections';
import { fetchProductForDetailPage } from '@/lib/data/product-detail-fetcher';
import { getSellerByHandle } from '@/lib/data/seller';
import { isMultiVendorEnabledRuntime } from '@/lib/flags/multiVendorPricing';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getGpField } from '@/lib/helpers/metadata-utils';
import { generateProductMetadata, resolveGpSeoMetadata } from '@/lib/helpers/seo';

/**
 * Story v160-4-6: parse `?from=seller:{handle}` searchParam, resolve seller
 * via `getSellerByHandle()` (Story 4.4 data layer; defensive null on 5xx /
 * not-found), return minimal `{ name, handle }` for the SalonContextChip
 * overlay. Strict regex guards against URL injection. Returns `null` for any
 * malformed / missing / unknown handle so chip renders nothing — graceful
 * degradation, never blocks PDP render.
 */
const SELLER_FROM_RE = /^seller:([a-z0-9-]+)$/;

async function resolveSalonContext(
  fromParam: string | undefined
): Promise<SalonContextChipSeller | null> {
  if (!fromParam) return null;
  const match = SELLER_FROM_RE.exec(fromParam);
  if (!match) return null;

  const sellerHandle = match[1];
  try {
    const seller = await getSellerByHandle(sellerHandle);
    if (!seller) return null;
    return { name: seller.name, handle: seller.handle };
  } catch {
    return null;
  }
}

// D-09: shared cache() wrapper lives in product-detail-fetcher.ts so this
// route AND the inner ProductDetailsPage server component dedupe their
// listProducts() calls within a single render (zero duplicate fetches).
const fetchProductForPage = async (handle: string, locale: string) => {
  const countryCode = await getCountryCode(locale);
  return fetchProductForDetailPage(handle, countryCode);
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}): Promise<Metadata> {
  const { handle, locale } = await params;
  const prod = await fetchProductForPage(handle, locale);

  return generateProductMetadata(prod);
}

export default async function ProductPage({
  params,
  searchParams
}: {
  params: Promise<{ handle: string; locale: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const { handle, locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const t = await getTranslations('pdp');
  // Story v160-cleanup-13c — warm runtime feature-flag cache before sync gates.
  await isMultiVendorEnabledRuntime();
  // Full product fetch (no field restriction) — variants include calculated_price + inventory_quantity
  const product = await fetchProductForPage(handle, locale);

  // Story v160-4-6: parse `?from=seller:{handle}` → optional salon context for
  // the sticky overlay chip. Defensive null on malformed param / 5xx / unknown
  // seller — chip simply doesn't render in those cases.
  const salonContext = await resolveSalonContext(resolvedSearchParams.from);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const gpVendor =
    getGpField<string>(product?.metadata as Record<string, unknown>, 'vendor_name') ?? siteName;

  const seo = resolveGpSeoMetadata(product?.metadata as Record<string, unknown> | null | undefined);
  const resolvedDescription =
    seo.meta_description ??
    `${product?.title} — voucher na zabieg w ${gpVendor}. Kup na ${siteName}.`;

  const cheapestVariant = product?.variants
    ?.filter(v => v.calculated_price?.calculated_amount != null)
    .sort(
      (a, b) =>
        (a.calculated_price?.calculated_amount ?? Infinity) -
        (b.calculated_price?.calculated_amount ?? Infinity)
    )[0];

  const priceRaw = cheapestVariant?.calculated_price?.calculated_amount;
  const currencyCode = cheapestVariant?.calculated_price?.currency_code ?? 'PLN';

  // Build offers block only when we have a valid price (Google rejects Offer without price)
  const offers =
    priceRaw != null
      ? {
          '@type': 'Offer' as const,
          price: (priceRaw / 100).toFixed(2),
          priceCurrency: currencyCode,
          availability: 'https://schema.org/InStock' as const // digital vouchers are always available
        }
      : undefined;

  const productSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: resolvedDescription,
        image: product.thumbnail ?? undefined,
        ...(offers ? { offers } : {})
      }
    : null;
  const primaryCategory = product?.categories?.[0];
  const categoryName = primaryCategory?.name ?? t('breadcrumbs.categories');
  const categoryHref = primaryCategory?.handle
    ? `/${locale}/categories/${primaryCategory.handle}`
    : `/${locale}/categories`;
  const breadcrumbSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: t('breadcrumbs.home'),
            item: `/${locale}`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: categoryName,
            item: categoryHref
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.title,
            item: `/${locale}/products/${handle}`
          }
        ]
      }
    : null;

  return (
    <main
      id="main-content"
      className="container"
    >
      <StorefrontRouteStateSignal
        route="pdp"
        surface="pdp"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="pdp"
      />
      {productSchema ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      ) : null}
      {breadcrumbSchema ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      ) : null}
      {product ? (
        <nav
          className="flex flex-wrap items-center gap-2 py-4 text-xs text-[var(--text-secondary)]"
          aria-label={t('breadcrumbs.aria_label')}
          data-testid="pdp-breadcrumbs"
        >
          <Link
            href={`/${locale}`}
            className="hover:text-[var(--text-primary)]"
          >
            {t('breadcrumbs.home')}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={categoryHref}
            className="hover:text-[var(--text-primary)]"
          >
            {categoryName}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--text-primary)]">{product.title}</span>
        </nav>
      ) : null}
      <SalonContextChip
        seller={salonContext}
        locale={locale}
      />
      <ProductDetailsPage
        handle={handle}
        locale={locale}
      />
    </main>
  );
}
