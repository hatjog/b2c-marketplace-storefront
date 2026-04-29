import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

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
import { resolveStorefrontBaseUrl } from '@/lib/env';

type PageParams = { handle: string; locale: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { handle, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller_page' });
  const seller = await getSellerByHandle(handle);

  if (!seller) {
    return { title: t('meta_fallback_title') };
  }

  const title = `${seller.name} | BonBeauty`;
  const description = seller.description
    ? seller.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : t('meta_description', { name: seller.name });

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
  const t = await getTranslations({ locale, namespace: 'seller_page' });

  const seller = await getSellerByHandle(handle);

  if (!seller) {
    redirect('/salony');
  }

  const countryCode = await getCountryCode(locale);

  let products: Awaited<ReturnType<typeof listProductsWithSort>>['response']['products'] = [];
  try {
    const result = await listProductsWithSort({
      countryCode,
      seller_id: seller.id,
    });
    products = result.response.products;
  } catch {
    // Gracefully degrade — show seller profile without services
  }

  const pageUrl = `${resolveStorefrontBaseUrl()}/salony/${seller.handle}`;

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': pageUrl,
    name: seller.name,
    url: pageUrl,
    ...(seller.photo ? { image: seller.photo } : {}),
  };

  return (
    <main id="main-content" className="bb-page-shell">
      <Breadcrumbs
        items={[
          { label: t('home'), href: '/' },
          { label: t('salons'), href: '/salony' },
          { label: seller.name, href: `/salony/${seller.handle}` },
        ]}
      />

      <div className="space-y-8">
        <div className="bb-section-shell bb-section-shell-strong">
          <SellerHero name={seller.name} photo={seller.photo || null} />
        </div>

        <div className="bb-section-shell flex flex-wrap items-center gap-4">
          <SellerSocialLinks socialLinks={seller.social_links} />
          <SellerContact phone={seller.phone} email={seller.email} />
        </div>

        {seller.description && (
          <section aria-labelledby="seller-description-heading" className="bb-section-shell">
            <h2 id="seller-description-heading" className="mb-3 text-xl font-bold">
              {t('about')}
            </h2>
            <SanitizedHTML html={seller.description} className="label-md" />
          </section>
        )}

        <div className="bb-section-shell">
          <SellerServiceList products={products} />
        </div>

        <div className="bb-section-shell">
          <SellerGallery gallery={seller.gallery} sellerName={seller.name} />
        </div>

        <div className="bb-section-shell">
          <SellerLocations locations={seller.locations} />
        </div>
      </div>

      <script type="application/ld+json">{JSON.stringify(localBusinessJsonLd)}</script>
    </main>
  );
}
