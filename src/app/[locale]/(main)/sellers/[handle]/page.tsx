// @trust-invariant-scope: v180
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { SellerProof } from '@/components/atoms/SellerProof/SellerProof';
import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { DirectionsBlock } from '@/components/organisms/DirectionsBlock';
import { SellerTabs } from '@/components/organisms/SellerTabs/SellerTabs';
import { SellerPageHeader } from '@/components/sections';
import { retrieveCustomer } from '@/lib/data/customer';
import { getRegion } from '@/lib/data/regions';
import { getSellerByHandle } from '@/lib/data/seller';
import { getCountryCode } from '@/lib/helpers/country-code';
import { buildSellerAlternates } from '@/lib/seo/sellerAlternates';

export const revalidate = 60;

function deriveSellerYears(joinDate?: string): number | undefined {
  if (!joinDate) return undefined;
  const joined = new Date(joinDate);
  if (Number.isNaN(joined.getTime())) return undefined;
  return Math.max(0, new Date().getFullYear() - joined.getFullYear());
}

/**
 * Story v160-4-4: refresh of `/[locale]/sellers/[handle]` per Hybrid D Phase B.
 *
 * Path B (per Story 2.4 / 2.6): consumes `getSellerByHandle()` from
 * `@/lib/data/seller`. The current `getSellerByHandle()` calls the legacy
 * Mercur 1.5 `/store/seller/:handle` route via `sdk.client.fetch` because
 * Mercur 2 native `/store/sellers/:id` is ID-only — handle-path lookup is not
 * first-class. Per Story 2.6 risk note, list-then-filter fallback is the
 * acceptable MVP for <1000 sellers if/when the legacy 1.5 route is dropped.
 * `getSellerByHandle()` already returns `null` on any fetch error → the
 * `if (!seller) notFound()` pattern below produces a graceful 404 in both the
 * page render and SEO metadata path.
 *
 * Boundaries (NIE w 4.4):
 * - DirectionsBlock / map embed → Story 4.5
 * - PDP `?seller=<handle>` context preservation → Story 4.6
 * - Anti-Booksy HTML sanitization → Story 4.7
 */

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; handle: string }>;
}): Promise<Metadata> {
  const { locale, handle } = await params;
  const tDetail = await getTranslations('seller.detail');

  let seller: Awaited<ReturnType<typeof getSellerByHandle>> = null;
  try {
    seller = await getSellerByHandle(handle);
  } catch {
    seller = null;
  }

  // Story v160-3-3: canonical + hreflang per locale × handle. Even on the
  // not-found branch we keep the alternates pointing at the requested handle
  // so that crawlers reaching the URL via a stale link see the right
  // cross-locale signal (the page itself stays `noindex`).
  const alternates = buildSellerAlternates(locale, `/${handle}`);

  if (!seller) {
    return {
      title: tDetail('meta_fallback_title'),
      description: tDetail('meta_default_description'),
      alternates,
      robots: { index: false, follow: false }
    };
  }

  const title = tDetail('title_template', { name: seller.name });
  const rawDescription = (seller.description ?? '').trim();
  const description = rawDescription
    ? rawDescription.slice(0, 160)
    : tDetail('meta_description', { name: seller.name });

  const ogImage = seller.photo || null;

  return {
    title,
    description,
    alternates,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage }] } : {})
    }
  };
}

export default async function SellerPage({
  params
}: {
  params: Promise<{ handle: string; locale: string }>;
}) {
  const { handle, locale } = await params;

  let seller: Awaited<ReturnType<typeof getSellerByHandle>> = null;
  try {
    seller = await getSellerByHandle(handle);
  } catch {
    seller = null;
  }

  if (!seller) {
    notFound();
  }

  const tShared = await getTranslations('seller.shared');

  const user = await retrieveCustomer();
  const countryCode = await getCountryCode(locale);
  const currency_code = (await getRegion(countryCode))?.currency_code || 'usd';

  const tab = 'products';

  // Story v160-4-5 — assemble human-readable address z `SellerProps` shape
  // (`address_line`, `postal_code`, `city`, `country_code`). `lat`/`lng` are
  // NOT yet exposed on `SellerProps` — pass `null` defensively; DirectionsBlock
  // gracefully falls back do search-query deeplink mode (per AC4). Backend
  // augmentation tracked under Story 4.x follow-up (same blocker as
  // `vendor_offer.seller_lat` w SellerSelector).
  const sellerAddressParts = [
    seller.address_line,
    [seller.postal_code, seller.city].filter(Boolean).join(' '),
    seller.country_code
  ]
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(part => part.length > 0);
  const sellerAddress = sellerAddressParts.length > 0 ? sellerAddressParts.join(', ') : null;
  const sellerLat = (seller as { lat?: number | null }).lat ?? null;
  const sellerLng = (seller as { lng?: number | null }).lng ?? null;
  const sellerYears = deriveSellerYears(seller.created_at);
  const sellerReviews = Array.isArray(seller.reviews)
    ? (seller.reviews.filter(Boolean) as Array<{ rating?: number | null }>)
    : [];
  const sellerRatingCount = sellerReviews.length;
  const sellerRating = sellerRatingCount
    ? sellerReviews.reduce((sum, review) => sum + Number(review?.rating ?? 0), 0) / sellerRatingCount
    : undefined;
  const sellerTreatments =
    Array.isArray(seller.products) && seller.products.length > 0
      ? seller.products.length
      : sellerRatingCount;

  return (
    <main
      id="main-content"
      className="bb-page-shell"
    >
      <StorefrontRouteStateSignal
        route="seller-detail"
        surface="listing"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="seller-detail"
      />
      <div className="container pt-4">
        <Breadcrumbs
          items={[
            { label: tShared('breadcrumb_home'), href: `/${locale}/` },
            { label: tShared('breadcrumb_sellers'), href: `/${locale}/sellers` },
            { label: seller.name, href: `/${locale}/sellers/${seller.handle}` }
          ]}
        />
      </div>
      <SellerPageHeader
        header
        seller={seller}
        user={user}
      />
      <div className="container py-4">
        {/* Trust Invariant #2: <SellerProof with >=3 proof points on seller detail. */}
        <SellerProof
          years={sellerYears}
          treatments={sellerTreatments}
          rating={sellerRating}
          ratingCount={sellerRatingCount}
          sellerName={seller.name}
          data-testid="seller-detail-seller-proof"
        />
      </div>
      <div className="container py-6">
        <DirectionsBlock
          seller={{
            name: seller.name,
            handle: seller.handle,
            address: sellerAddress,
            lat: sellerLat,
            lng: sellerLng
          }}
          locale={locale}
        />
      </div>
      <SellerTabs
        tab={tab}
        seller_id={seller.id}
        seller_handle={seller.handle}
        locale={locale}
        countryCode={countryCode}
        currency_code={currency_code}
      />
    </main>
  );
}
