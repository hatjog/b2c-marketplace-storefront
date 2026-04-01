import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { SanitizedHTML } from '@/components/molecules/SanitizedHTML/SanitizedHTML';
import { SellerContact } from '@/components/organisms/seller/SellerContact/SellerContact';
import { SellerGallery } from '@/components/organisms/seller/SellerGallery';
import { SellerHero } from '@/components/organisms/seller/SellerHero';
import { SellerLocations } from '@/components/organisms/seller/SellerLocations';
import { SellerServiceList } from '@/components/organisms/seller/SellerServiceList';
import { SellerSocialLinks } from '@/components/organisms/seller/SellerSocialLinks/SellerSocialLinks';
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

  if (!seller) {
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

  if (!seller) {
    redirect('/salony');
  }

  const countryCode = await getCountryCode(locale);
  const region = await getRegion(countryCode);
  const currencyCode = region?.currency_code ?? 'pln';

  let products: Awaited<ReturnType<typeof listProductsWithSort>>['response']['products'] = [];
  try {
    const result = await listProductsWithSort({
      countryCode,
      seller_id: seller.id,
      limit: 50,
    });
    products = result.response.products;
  } catch {
    // Gracefully degrade — show seller profile without services
  }

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

        <div className="flex flex-wrap items-center gap-4">
          <SellerSocialLinks socialLinks={seller.social_links} />
          <SellerContact phone={seller.phone} email={seller.email} />
        </div>

        {seller.description && (
          <section aria-labelledby="seller-description-heading">
            <h2 id="seller-description-heading" className="mb-3 text-xl font-bold">
              O salonie
            </h2>
            <SanitizedHTML html={seller.description} className="label-md" />
          </section>
        )}

        <SellerServiceList products={products} currencyCode={currencyCode} />

        <SellerGallery gallery={seller.gallery} sellerName={seller.name} />

        <SellerLocations locations={seller.locations} />
      </div>

      <script type="application/ld+json">{JSON.stringify(localBusinessJsonLd)}</script>
    </main>
  );
}
