import type { Metadata } from 'next';

import { ProductDetailsPage } from '@/components/sections';
import { listProducts } from '@/lib/data/products';
import { generateProductMetadata } from '@/lib/helpers/seo';
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

  return (
    <main id="main-content" className="container">
      <ProductDetailsPage
        handle={handle}
        locale={locale}
      />
    </main>
  );
}
