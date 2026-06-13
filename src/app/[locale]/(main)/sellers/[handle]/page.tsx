// @trust-invariant-scope: v180
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { SellerProof } from '@/components/atoms/SellerProof/SellerProof';
import { DirectionsBlock } from '@/components/organisms/DirectionsBlock';
import { SellerCard } from '@/components/organisms/seller/SellerCard/SellerCard';
import { SellerTabs } from '@/components/organisms/SellerTabs/SellerTabs';
import { SellerPageHeader } from '@/components/sections';
import { retrieveCustomer } from '@/lib/data/customer';
import { getRegion } from '@/lib/data/regions';
import { getSellerByHandle, getSellers } from '@/lib/data/seller';
import { getCountryCode } from '@/lib/helpers/country-code';
import { buildLocaleSocialMetadata } from '@/lib/seo/hreflang';
import { buildSellerAlternates } from '@/lib/seo/sellerAlternates';
import { assessSellerStructuredData } from '@/lib/seo/sellerStructuredData';

export const revalidate = 60;

type SellerDetailTab = 'products' | 'about' | 'location' | 'policy';

function deriveSellerYears(joinDate?: string): number | undefined {
  if (!joinDate) return undefined;
  const joined = new Date(joinDate);
  if (Number.isNaN(joined.getTime())) return undefined;
  return Math.max(0, new Date().getFullYear() - joined.getFullYear());
}

function parseSellerDetailTab(raw: string | string[] | undefined): SellerDetailTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'about' || value === 'location' || value === 'policy' ? value : 'products';
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
  const social = buildLocaleSocialMetadata(locale);

  if (!seller) {
    // R-6: rozszerzony OG fallback — daje crawlerom title/description/type
    // nawet gdy seller jest null (noindex+nofollow nadal aktywne).
    const fallbackTitle = tDetail('meta_fallback_title');
    const fallbackDescription = tDetail('meta_default_description');
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates,
      robots: { index: false, follow: false },
      openGraph: {
        ...social.openGraph,
        title: fallbackTitle,
        description: fallbackDescription,
        type: 'website'
      },
      other: social.other
    };
  }

  const sellerSeo = seller.seo ?? null;
  const title = sellerSeo?.meta_title ?? tDetail('title_template', { name: seller.name });
  const rawDescription = (seller.description ?? '').trim();
  const description =
    sellerSeo?.meta_description ??
    (rawDescription
      ? rawDescription.slice(0, 160)
      : tDetail('meta_description', { name: seller.name }));
  const structuredData = assessSellerStructuredData(seller);

  const ogImage = sellerSeo?.og_image_url || seller.photo || null;

  return {
    title,
    description,
    alternates,
    robots: structuredData.canIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      ...social.openGraph,
      title,
      description,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage }] } : {})
    },
    other: social.other
  };
}

export default async function SellerPage({
  params,
  searchParams
}: {
  params: Promise<{ handle: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle, locale } = await params;
  const sp = await searchParams;

  let seller: Awaited<ReturnType<typeof getSellerByHandle>> = null;
  try {
    seller = await getSellerByHandle(handle);
  } catch {
    seller = null;
  }

  if (!seller) {
    notFound();
  }

  const tDetail = await getTranslations('seller.detail');
  const tSellerProof = await getTranslations('pdp.seller_proof');

  const user = await retrieveCustomer();
  const countryCode = await getCountryCode(locale);
  const currency_code = (await getRegion(countryCode))?.currency_code || 'usd';

  const tab = parseSellerDetailTab(sp.tab);

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
  const structuredData = assessSellerStructuredData(seller);
  const sellerYears = deriveSellerYears(seller.created_at);
  const sellerReviews = Array.isArray(seller.reviews)
    ? (seller.reviews.filter(Boolean) as Array<{ rating?: number | null }>)
    : [];
  const sellerRatingCount = sellerReviews.length;
  const sellerRating = sellerRatingCount
    ? sellerReviews.reduce((sum, review) => sum + Number(review?.rating ?? 0), 0) /
      sellerRatingCount
    : undefined;
  const sellerTreatments =
    Array.isArray(seller.products) && seller.products.length > 0
      ? seller.products.length
      : sellerRatingCount;
  const otherSellers = (await getSellers())
    .filter(item => item.handle !== seller.handle)
    .slice(0, 4);

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
      <SellerPageHeader
        header
        seller={seller}
        user={user}
        locale={locale}
      />
      <div className="container py-4">
        {/* Trust Invariant #2: <SellerProof with >=3 proof points on seller detail. */}
        <SellerProof
          years={sellerYears}
          treatments={sellerTreatments}
          rating={sellerRating}
          ratingCount={sellerRatingCount}
          sellerName={seller.name}
          locale={locale}
          labels={{
            aria: tSellerProof('aria', { name: seller.name }),
            viewSeller: tSellerProof('view_seller'),
            yearsValue: count => tSellerProof('years_value', { count }),
            yearsLabel: tSellerProof('years_label'),
            treatmentsValue: count => tSellerProof('treatments_value', { count }),
            treatmentsLabel: tSellerProof('treatments_label'),
            ratingValue: (rating, count) =>
              tSellerProof('rating_value', { rating: rating.toFixed(1), count }),
            ratingLabel: tSellerProof('rating_label'),
            responseTimeValue: '~4h',
            responseTimeLabel: tDetail('response_time_label'),
            noRatings: tSellerProof('no_ratings'),
            warningTitle: tSellerProof('warning_title'),
            warningBody: tSellerProof('warning_body')
          }}
          data-testid="seller-detail-seller-proof"
        />
      </div>
      <div className="container py-6">
        {!structuredData.canIndex && (
          <div
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            data-testid="seller-detail-runtime-fallback"
          >
            {tDetail('runtime_fallback_notice')}
          </div>
        )}
        {structuredData.jsonLd && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line no-restricted-syntax -- JSON-LD structured data, not user HTML
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData.jsonLd) }}
          />
        )}
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
        seller={seller}
        seller_id={seller.id}
        seller_handle={seller.handle}
        locale={locale}
        countryCode={countryCode}
        currency_code={currency_code}
      />
      {otherSellers.length > 0 ? (
        <section
          className="container py-8"
          data-testid="seller-detail-others-strip"
        >
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="bb-eyebrow text-[var(--gold)]">{tDetail('others_eyebrow')}</p>
              <h2 className="heading-md text-primary">{tDetail('others_title')}</h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {otherSellers.map(other => (
              <SellerCard
                key={other.handle}
                name={other.name}
                handle={other.handle}
                photo_url={other.photo_url}
                city={other.city}
                district={other.district}
                product_count={other.product_count}
              />
            ))}
          </div>
        </section>
      ) : null}
      <div
        className="sticky bottom-0 z-20 border-t border-[var(--bb-border-soft)] bg-[var(--bb-surface-96)] px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-testid="seller-sticky-bar"
      >
        <div className="container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label-sm text-secondary">{tDetail('sticky_eyebrow')}</p>
            <p className="label-md text-primary">{seller.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {seller.phone ? (
              <a
                href={`tel:${seller.phone}`}
                className="rounded-full bg-[var(--cta)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--cta-hover)]"
              >
                {tDetail('sticky_call')}
              </a>
            ) : null}
            {seller.email ? (
              <a
                href={`mailto:${seller.email}`}
                className="rounded-full border border-[var(--bb-border-strong)] px-4 py-2 text-sm font-medium text-primary"
              >
                {tDetail('sticky_email')}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
