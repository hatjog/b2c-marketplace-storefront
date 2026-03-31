import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { SanitizedHTML } from '@/components/molecules/SanitizedHTML/SanitizedHTML';
import { SellerHero } from '@/components/organisms/seller/SellerHero';
import { SellerServiceList } from '@/components/organisms/seller/SellerServiceList';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getSellerByHandle } from '@/lib/data/seller';
import { listProductsWithSort } from '@/lib/data/products';
import { getRegion } from '@/lib/data/regions';
import { STOREFRONT_BASE_URL } from '@/lib/env';

type PageParams = { handle: string; locale: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { handle } = await params;
  const seller = await getSellerByHandle(handle);

  if (!seller || Array.isArray(seller)) {
    return { title: 'Salon | BonBeauty' };
  }

  const title = `${seller.name} | BonBeauty`;
  const description = seller.description
    ? seller.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Odkryj ofertę salonu ${seller.name} na BonBeauty.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(seller.photo ? { images: [{ url: seller.photo }] } : {}),
    },
  };
}

export default async function SalonProfilPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { handle, locale } = await params;

  const seller = await getSellerByHandle(handle);

  if (!seller || Array.isArray(seller)) {
    redirect('/salony');
  }

  const countryCode = await getCountryCode(locale);
  const region = await getRegion(countryCode);
  const currencyCode = region?.currency_code ?? 'pln';

  const { response: { products } } = await listProductsWithSort({
    countryCode,
    seller_id: seller.id,
    limit: 50,
  });

  const pageUrl = `${STOREFRONT_BASE_URL}/salony/${seller.handle}`;

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': pageUrl,
    name: seller.name,
    url: pageUrl,
    ...(seller.photo ? { image: seller.photo } : {}),
  };

  return (
    <main id="main-content" className="container py-8">
      <Breadcrumbs
        items={[
          { label: 'Strona główna', href: '/' },
          { label: 'Salony', href: '/salony' },
          { label: seller.name, href: `/salony/${seller.handle}` },
        ]}
      />

      <div className="mt-6 space-y-8">
        <SellerHero name={seller.name} photo={seller.photo || null} />

        {seller.description && (
          <section aria-labelledby="seller-description-heading">
            <h2 id="seller-description-heading" className="mb-3 text-xl font-bold">
              O salonie
            </h2>
            <SanitizedHTML html={seller.description} className="label-md" />
          </section>
        )}

        <SellerServiceList products={products} currencyCode={currencyCode} />
      </div>

      <script type="application/ld+json">{JSON.stringify(localBusinessJsonLd)}</script>
    </main>
  );
}
