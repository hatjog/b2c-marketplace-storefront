import type { Metadata } from 'next';

import { ProductDetailsPage } from '@/components/sections';
import { listProducts } from '@/lib/data/products';
import { generateProductMetadata, resolveGpSeoMetadata } from '@/lib/helpers/seo';
import { getCountryCode } from '@/lib/helpers/country-code';

export async function generateMetadata({
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}): Promise<Metadata> {
  const { handle, locale } = await params;

  const countryCode = await getCountryCode(locale);
  const prod = await listProducts({
    countryCode,
    queryParams: { handle: [handle], limit: 1 },
    forceCache: true
  }).then(({ response }) => response.products[0]);

  return generateProductMetadata(prod);
}

export default async function ProductPage({
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}) {
  const { handle, locale } = await params;

  const countryCode = await getCountryCode(locale);
  const product = await listProducts({
    countryCode,
    queryParams: { handle: [handle], limit: 1, fields: 'id,title,description,thumbnail,handle,variants,metadata' },
    forceCache: true
  }).then(({ response }) => response.products[0]);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'BonBeauty';
  const gpVendor =
    (
      (product?.metadata?.gp as Record<string, unknown> | undefined)
        ?.vendor_name as string | undefined
    ) ?? siteName;

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

  const productSchema = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: resolvedDescription,
        image: product.thumbnail ?? undefined,
        offers: {
          '@type': 'Offer',
          price: cheapestVariant?.calculated_price?.calculated_amount,
          priceCurrency: 'PLN',
          availability: product.variants?.some(
            v => v.inventory_quantity != null && v.inventory_quantity > 0
          )
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock'
        }
      }
    : null;

  return (
    <main id="main-content" className="container">
      {productSchema ? (
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
      ) : null}
      <ProductDetailsPage
        handle={handle}
        locale={locale}
      />
    </main>
  );
}
