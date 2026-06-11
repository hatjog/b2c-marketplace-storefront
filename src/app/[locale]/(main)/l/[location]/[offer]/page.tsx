import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { RichTextRenderer } from '@/components/rich-text';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/routing';
import { toHreflang } from '@/lib/helpers/hreflang';
import { getProgrammaticLandingData } from '@/lib/programmatic-landing';
import {
  buildProgrammaticLandingJsonLd,
  serializeJsonLd
} from '@/lib/seo/programmaticLandingJsonLd';

export const revalidate = 600;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

function buildLandingAlternates(baseUrl: string, locale: string, location: string, offer: string) {
  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, code) => {
    acc[toHreflang(code)] = new URL(`/${code}/l/${location}/${offer}`, `${baseUrl}/`).toString();
    return acc;
  }, {});

  return {
    canonical: new URL(`/${locale}/l/${location}/${offer}`, `${baseUrl}/`).toString(),
    languages: {
      ...languages,
      'x-default': new URL(`/pl/l/${location}/${offer}`, `${baseUrl}/`).toString()
    }
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; location: string; offer: string }>;
}): Promise<Metadata> {
  const { locale, location, offer } = await params;
  const data = getProgrammaticLandingData({
    locale: locale as SupportedLocale,
    locationSlug: location,
    offerSlug: offer
  });

  if (!data) {
    return {};
  }

  const t = await getTranslations('programmaticLanding');
  const baseUrl = await getBaseUrl();
  const alternates = buildLandingAlternates(baseUrl, locale, data.location.slug, data.offer.slug);

  return {
    title: t('metadata_title', {
      offer: data.offer.labels[data.locale],
      location: data.location.labels[data.locale]
    }),
    description: t('metadata_description', {
      offer: data.offer.labels[data.locale],
      location: data.location.labels[data.locale]
    }),
    alternates,
    openGraph: {
      type: 'website',
      title: t('metadata_title', {
        offer: data.offer.labels[data.locale],
        location: data.location.labels[data.locale]
      }),
      description: t('metadata_description', {
        offer: data.offer.labels[data.locale],
        location: data.location.labels[data.locale]
      }),
      url: alternates.canonical
    }
  };
}

export default async function ProgrammaticLandingPage({
  params
}: {
  params: Promise<{ locale: string; location: string; offer: string }>;
}) {
  const [{ locale, location, offer }, t] = await Promise.all([
    params,
    getTranslations('programmaticLanding')
  ]);
  const data = getProgrammaticLandingData({
    locale: locale as SupportedLocale,
    locationSlug: location,
    offerSlug: offer
  });

  if (!data) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const canonicalUrl = new URL(data.canonicalPath, `${baseUrl}/`).toString();
  const jsonLd = buildProgrammaticLandingJsonLd(data, canonicalUrl);
  const offerLabel = data.offer.labels[data.locale];
  const locationLabel = data.location.labels[data.locale];

  return (
    <main
      id="main-content"
      className="bb-page-shell pb-12"
      data-testid="programmatic-landing-page"
    >
      <script type="application/ld+json">{serializeJsonLd(jsonLd)}</script>

      <section className="bb-section-shell bb-section-shell-strong border-y border-[var(--bb-border-soft)]">
        <div className="container grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-secondary">
              {t('eyebrow')}
            </p>
            <div className="max-w-4xl space-y-4">
              <h1
                className="heading-xl text-primary"
                data-testid="programmatic-landing-title"
              >
                {t('hero_title', { offer: offerLabel, location: locationLabel })}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-secondary">
                {t('hero_summary', { location: locationLabel })}
              </p>
            </div>
            <LocalizedClientLink
              href="#local-salons"
              className="label-md inline-flex rounded-full bg-[var(--bg-action)] px-5 py-3 uppercase text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)] focus-visible:ring-offset-2"
            >
              {t('hero_cta')}
            </LocalizedClientLink>
          </div>
          <dl className="grid gap-3 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-white p-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">
                {t('geo_label')}
              </dt>
              <dd className="mt-1 text-sm text-primary">
                {data.location.geo.latitude}, {data.location.geo.longitude}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">
                {t('locality_label')}
              </dt>
              <dd className="mt-1 text-sm text-primary">{data.location.addressLocality}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        className="container grid gap-4 py-8 md:grid-cols-3"
        aria-label={t('trust_aria')}
      >
        {['trust_verified', 'trust_geo', 'trust_schema'].map(key => (
          <div
            key={key}
            className="rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-white p-5"
          >
            <p className="text-sm font-semibold text-primary">{t(key)}</p>
          </div>
        ))}
      </section>

      <section
        id="local-salons"
        className="container space-y-5 py-8"
      >
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-secondary">
            {t('salons_eyebrow')}
          </p>
          <h2 className="heading-md text-primary">{t('salons_heading')}</h2>
        </div>
        {data.salons.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.salons.map(salon => (
              <LocalizedClientLink
                key={salon.handle}
                href={salon.href}
                className="block h-full rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]"
              >
                <h3 className="heading-sm text-primary">{salon.displayName}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{salon.streetAddress}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                  {t('rating_label', {
                    rating: salon.ratingAverage,
                    count: salon.ratingCount
                  })}
                </p>
              </LocalizedClientLink>
            ))}
          </div>
        ) : (
          <p
            role="status"
            aria-label={t('empty_salons_aria')}
            className="rounded-[var(--bb-radius-panel)] border border-dashed border-[var(--bb-tint-gold-24)] bg-[var(--bb-tint-gold-05)] p-5 text-sm leading-6 text-secondary"
          >
            {t('empty_salons')}
          </p>
        )}
      </section>

      <section className="container space-y-5 py-8">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-secondary">
            {t('offers_eyebrow')}
          </p>
          <h2 className="heading-md text-primary">{t('offers_heading')}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.featuredOffers.map(item => (
            <LocalizedClientLink
              key={`${item.sellerName}-${item.href}`}
              href={item.href}
              className="block rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]"
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                {item.sellerName}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-primary">{item.title}</h3>
              <p className="mt-3 text-sm text-secondary">{item.priceDisplay}</p>
            </LocalizedClientLink>
          ))}
        </div>
      </section>

      <section className="container py-8">
        <RichTextRenderer
          slug={`${data.location.slug}-${data.offer.slug}`}
          content={data.seoContent}
          disallowedEmbedLabel={t('disallowed_embed')}
          inlineEmbedLabel={t('inline_embed_label')}
        />
      </section>

      <section className="container space-y-5 py-8">
        <h2 className="heading-md text-primary">{t('related_locations_heading')}</h2>
        <div className="flex flex-wrap gap-3">
          {data.relatedLocations.map(item => (
            <LocalizedClientLink
              key={item.slug}
              href={`/l/${item.slug}/${data.offer.slug}`}
              className="rounded-full border border-[var(--bb-tint-gold-18)] bg-white px-4 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]"
            >
              {item.labels[data.locale]}
            </LocalizedClientLink>
          ))}
        </div>
      </section>

      <section className="container py-8">
        <div className="flex flex-col gap-4 rounded-[var(--bb-radius-panel)] bg-[var(--bg-action)] p-6 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="heading-sm">{t('bottom_cta_heading')}</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">{t('bottom_cta_body')}</p>
          </div>
          <LocalizedClientLink
            href="/sellers"
            className="label-md inline-flex rounded-full bg-white px-5 py-3 uppercase text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-action)]"
          >
            {t('bottom_cta_label')}
          </LocalizedClientLink>
        </div>
      </section>
    </main>
  );
}