import type { HttpTypes } from '@medusajs/types';
import { getTranslations } from 'next-intl/server';

import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { SellerFooter, SellerHeading } from '@/components/organisms';
import { SellerContact, SellerHero, SellerSocialLinks } from '@/components/organisms/seller';

export const SellerPageHeader = async ({
  header: _header = false,
  seller,
  user,
  locale
}: {
  header?: boolean;
  seller: any;
  user: HttpTypes.StoreCustomer | null;
  locale: string;
}) => {
  // QD-03 (CAP-3): jawne locale we wszystkich czterech namespace'ach tej
  // powierzchni — `locale` jest w propsach, więc nic nie usprawiedliwia
  // odczytu z request store.
  const t = await getTranslations({ locale, namespace: 'products' });
  // `verified_seller` lives in the `pdp` namespace (shared trust label with the
  // product detail page) — resolving it from `products` throws MISSING_MESSAGE
  // under the fail-loud rawKeyGuard and 500s the whole seller surface.
  const pdpT = await getTranslations({ locale, namespace: 'pdp' });
  const sellerT = await getTranslations({ locale, namespace: 'seller.detail' });
  const sharedT = await getTranslations({ locale, namespace: 'seller.shared' });
  const reviews = Array.isArray(seller.reviews)
    ? (seller.reviews.filter(Boolean) as Array<{ rating?: number | null }>)
    : [];
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? reviews.reduce(
        (sum: number, review: { rating?: number | null }) => sum + Number(review?.rating ?? 0),
        0
      ) / reviewCount
    : null;
  // Story 6.2 AC5 — hero band must surface dzielnica when backend exposes it.
  // `seller.district` propagates from SellerProps (types/seller.ts) — backend
  // Mercur 2.1.1 will populate it via FR7.4 admin-edit; for now nullable fields
  // silently drop without an empty leading separator (defensive filter pipeline).
  const locationText = [seller.district, seller.city, seller.address_line]
    .map((value: string | null | undefined) => value?.trim())
    .filter(Boolean)
    .join(' · ');
  const contactText = [seller.phone, seller.email]
    .map((value: string | null | undefined) => value?.trim())
    .find(Boolean);

  return (
    <div className="bb-section-shell bb-section-shell-strong overflow-hidden">
      <div className="space-y-6">
        <SellerHero
          name={seller.name}
          photo={seller.photo || null}
          verified={seller.verified === true}
          verifiedLabel={pdpT('verified_seller')}
          tagline={sellerT('hero_tagline')}
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: sharedT('breadcrumb_home'), href: `/${locale}/` },
                { label: sharedT('breadcrumb_sellers'), href: `/${locale}/sellers` },
                { label: seller.name, href: `/${locale}/sellers/${seller.handle}` }
              ]}
            />
          }
        />
        <SellerHeading
          header
          seller={seller}
          user={user}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {rating != null && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_reviews')}</p>
              <p className="heading-sm text-primary">
                {rating.toFixed(1)} · {t('reviews_count', { count: reviewCount })}
              </p>
            </div>
          )}
          {locationText && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_address')}</p>
              <p className="label-md text-primary">{locationText}</p>
            </div>
          )}
          {contactText && (
            <div className="bb-card-muted space-y-1">
              <p className="label-sm text-secondary">{t('seller_contact')}</p>
              <p className="label-md text-primary">{contactText}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SellerSocialLinks socialLinks={seller.social_links} />
          <SellerContact
            phone={seller.phone}
            email={seller.email}
          />
        </div>
        <SellerFooter seller={seller} />
      </div>
    </div>
  );
};
