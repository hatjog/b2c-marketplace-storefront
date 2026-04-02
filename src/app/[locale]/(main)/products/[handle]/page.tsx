import type { Metadata } from 'next';
import { cache } from 'react';

import { ProductDetailsPage } from '@/components/sections';
import { listProducts } from '@/lib/data/products';
import { generateProductMetadata, resolveGpSeoMetadata } from '@/lib/helpers/seo';
import { getGpField } from '@/lib/helpers/metadata-utils';
import { getCountryCode } from '@/lib/helpers/country-code';

const fetchProductForPage = cache(async (handle: string, locale: string) => {
  const countryCode = await getCountryCode(locale);

  return listProducts({
    countryCode,
    queryParams: { handle: [handle], limit: 1 },
    forceCache: true
  }).then(({ response }) => response.products[0]);
});

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
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}) {
  const { handle, locale } = await params;
  // Full product fetch (no field restriction) — variants include calculated_price + inventory_quantity
  const product = await fetchProductForPage(handle, locale);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const gpVendor =
    getGpField<string>(product?.metadata as Record<string, unknown>, 'vendor_name') ?? siteName;

  const seo = resolveGpSeoMetadata(
    product?.metadata as Record<string, unknown> | null | undefined
  );
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
  const offers = priceRaw != null
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

  return (
    <main id="main-content" className="container">
      {productSchema ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      ) : null}
      <ProductDetailsPage
        handle={handle}
        locale={locale}
      />
    </main>
  );
}
