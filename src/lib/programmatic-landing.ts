import type { SupportedLocale } from '@/i18n/routing';
import { SELLER_DIRECTORY_FIXTURES } from '@/lib/data/seller-directory-fixtures';
import { toHreflangBare } from '@/lib/helpers/hreflang';
import { convertToLocale } from '@/lib/helpers/money';
import type { BlogRichTextNode } from '@/types/blog';

type LocalizedLabel = Record<SupportedLocale, string>;

export type ProgrammaticLocation = {
  slug: string;
  labels: LocalizedLabel;
  city: string;
  district: string | null;
  addressLocality: string;
  geo: {
    latitude: number;
    longitude: number;
  };
};

export type ProgrammaticOffer = {
  slug: string;
  labels: LocalizedLabel;
  category: string;
};

export type ProgrammaticSalon = {
  handle: string;
  name: string;
  displayName: string;
  city: string;
  district: string | null;
  streetAddress: string;
  href: string;
  geo: {
    latitude: number;
    longitude: number;
  };
  ratingAverage: number;
  ratingCount: number;
};

export type ProgrammaticFeaturedOffer = {
  title: string;
  href: string;
  sellerName: string;
  priceDisplay: string;
};

export type ProgrammaticLandingData = {
  locale: SupportedLocale;
  location: ProgrammaticLocation;
  offer: ProgrammaticOffer;
  canonicalPath: string;
  heroTitle: string;
  heroSummary: string;
  salons: ProgrammaticSalon[];
  featuredOffers: ProgrammaticFeaturedOffer[];
  relatedLocations: ProgrammaticLocation[];
  seoContent: BlogRichTextNode[];
};

const OFFER_LABELS: Record<string, LocalizedLabel> = {
  'pielegnacja-twarzy': {
    pl: 'Pielęgnacja twarzy',
    en: 'Facial care',
    ua: 'Догляд за обличчям',
    de: 'Gesichtspflege'
  },
  kwasy: {
    pl: 'Kwasy',
    en: 'Acid treatments',
    ua: 'Кислотні процедури',
    de: 'Säurebehandlungen'
  },
  konsultacje: {
    pl: 'Konsultacje',
    en: 'Consultations',
    ua: 'Консультації',
    de: 'Beratungen'
  },
  masaz: {
    pl: 'Masaż',
    en: 'Massage',
    ua: 'Масаж',
    de: 'Massage'
  },
  manicure: {
    pl: 'Manicure',
    en: 'Manicure',
    ua: 'Манікюр',
    de: 'Maniküre'
  },
  spa: {
    pl: 'SPA',
    en: 'SPA',
    ua: 'SPA',
    de: 'SPA'
  },
  'brwi-i-rzesy': {
    pl: 'Brwi i rzęsy',
    en: 'Brows and lashes',
    ua: 'Брови та вії',
    de: 'Brauen und Wimpern'
  },
  'rytualy-ciala': {
    pl: 'Rytuały ciała',
    en: 'Body rituals',
    ua: 'Ритуали для тіла',
    de: 'Körperrituale'
  },
  pedicure: {
    pl: 'Pedicure',
    en: 'Pedicure',
    ua: 'Педикюр',
    de: 'Pediküre'
  },
  brwi: {
    pl: 'Brwi',
    en: 'Brows',
    ua: 'Брови',
    de: 'Brauen'
  }
};

export function slugifyProgrammaticPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function averageGeo(items: Array<{ geo: { latitude: number; longitude: number } }>) {
  const latitude = items.reduce((sum, item) => sum + item.geo.latitude, 0) / items.length;
  const longitude = items.reduce((sum, item) => sum + item.geo.longitude, 0) / items.length;

  return {
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4))
  };
}

function buildLocations(): ProgrammaticLocation[] {
  const fixtures = Object.values(SELLER_DIRECTORY_FIXTURES);
  const cityGroups = new Map<string, typeof fixtures>();

  for (const fixture of fixtures) {
    cityGroups.set(fixture.city, [...(cityGroups.get(fixture.city) ?? []), fixture]);
  }

  const cityLocations = Array.from(cityGroups.entries()).map(([city, items]) => ({
    slug: slugifyProgrammaticPart(city),
    labels: {
      pl: city,
      en: city,
      ua: city,
      de: city
    },
    city,
    district: null,
    addressLocality: city,
    geo: averageGeo(items)
  }));

  const districtLocations = fixtures
    .filter(fixture => fixture.district)
    .map(fixture => ({
      slug: slugifyProgrammaticPart(fixture.district ?? ''),
      labels: {
        pl: fixture.district ?? fixture.city,
        en: fixture.district ?? fixture.city,
        ua: fixture.district ?? fixture.city,
        de: fixture.district ?? fixture.city
      },
      city: fixture.city,
      district: fixture.district,
      addressLocality: fixture.city,
      geo: fixture.geo
    }));

  return [...cityLocations, ...districtLocations].sort((left, right) =>
    left.slug.localeCompare(right.slug)
  );
}

function buildOffers(): ProgrammaticOffer[] {
  const categories = new Set<string>();

  for (const fixture of Object.values(SELLER_DIRECTORY_FIXTURES)) {
    fixture.categories.forEach(category => categories.add(category));
  }

  return Array.from(categories)
    .map(category => {
      const slug = slugifyProgrammaticPart(category);
      return {
        slug,
        category,
        labels:
          OFFER_LABELS[slug] ??
          ({
            pl: category,
            en: category,
            ua: category,
            de: category
          } satisfies LocalizedLabel)
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

export const PROGRAMMATIC_LOCATIONS = buildLocations();
export const PROGRAMMATIC_OFFERS = buildOffers();

function matchesLocation(
  fixture: (typeof SELLER_DIRECTORY_FIXTURES)[string],
  location: ProgrammaticLocation
) {
  if (location.district) {
    return fixture.district === location.district;
  }

  return fixture.city === location.city;
}

function matchesOffer(
  fixture: (typeof SELLER_DIRECTORY_FIXTURES)[string],
  offer: ProgrammaticOffer
) {
  return fixture.categories.some(category => slugifyProgrammaticPart(category) === offer.slug);
}

function formatPrice(locale: SupportedLocale, priceMinor: number) {
  // toHreflangBare resolves ua→uk (canonical R9 source). convertToLocale applies the PLN
  // "kwota zł" convention (whole amounts drop the .00) consistently across the storefront.
  return convertToLocale({
    amount: priceMinor,
    currency_code: 'PLN',
    locale: toHreflangBare(locale),
    isMinorUnit: true,
  });
}

function buildSeoContent(
  locale: SupportedLocale,
  location: ProgrammaticLocation,
  offer: ProgrammaticOffer
): BlogRichTextNode[] {
  const locationLabel = location.labels[locale];
  const offerLabel = offer.labels[locale];
  const heading =
    locale === 'pl'
      ? `${offerLabel} w lokalizacji ${locationLabel}`
      : locale === 'ua'
        ? `${offerLabel} у ${locationLabel}`
        : locale === 'de'
          ? `${offerLabel} in ${locationLabel}`
          : `${offerLabel} in ${locationLabel}`;
  const paragraph =
    locale === 'pl'
      ? `Ta strona zbiera salony i oferty dla zapytania ${offerLabel} w ${locationLabel}. Treść może zostać zastąpiona przez CMS, ale dane lokalizacji, powiązane miejsca i SEO schema pochodzą z deterministycznego read modelu.`
      : locale === 'ua'
        ? `Ця сторінка збирає салони та пропозиції для запиту ${offerLabel} у ${locationLabel}. Текст може бути замінений із CMS, а дані локації, пов'язані місця та SEO schema походять із детермінованої read model.`
        : locale === 'de'
          ? `Diese Seite sammelt Salons und Angebote für ${offerLabel} in ${locationLabel}. Der redaktionelle Inhalt kann aus dem CMS ersetzt werden, während Standortdaten, verwandte Orte und SEO-Schema aus dem deterministischen Read Model stammen.`
          : `This page gathers salons and offers for ${offerLabel} in ${locationLabel}. The editorial body can be replaced from the CMS, while location data, related places and SEO schema come from the deterministic read model.`;

  return [
    {
      type: 'heading-2',
      text: heading
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: paragraph
        }
      ]
    },
    {
      type: 'unordered-list',
      items: [
        [
          {
            type: 'text',
            text: `${locationLabel}: ${location.geo.latitude}, ${location.geo.longitude}`
          }
        ],
        [{ type: 'text', text: offerLabel }],
        [{ type: 'text', text: location.city }]
      ]
    }
  ];
}

/**
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-06):
 *   - `marketId` defaults to `process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID`,
 *     not the previous hard-coded `'bonbeauty'` literal. This eliminates
 *     the cross-market data leak risk when bonevent / bongarden go live
 *     in v1.10.0+ — runtime market boundary is now read from env.
 *   - Callers can override per-request via the explicit `marketId` prop.
 */
export function getProgrammaticLandingData({
  locale,
  locationSlug,
  offerSlug,
  marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || 'bonbeauty'
}: {
  locale: SupportedLocale;
  locationSlug: string;
  offerSlug: string;
  marketId?: string;
}): ProgrammaticLandingData | null {
  const normalizedLocation = slugifyProgrammaticPart(locationSlug);
  const normalizedOffer = slugifyProgrammaticPart(offerSlug);
  const location = PROGRAMMATIC_LOCATIONS.find(item => item.slug === normalizedLocation);
  const offer = PROGRAMMATIC_OFFERS.find(item => item.slug === normalizedOffer);

  if (!location || !offer) {
    return null;
  }

  const fixtures = Object.values(SELLER_DIRECTORY_FIXTURES).filter(
    fixture => fixture.marketId === marketId
  );
  const matchingFixtures = fixtures.filter(
    fixture => matchesLocation(fixture, location) && matchesOffer(fixture, offer)
  );

  const salons = matchingFixtures.map(fixture => ({
    handle: fixture.handle,
    name: fixture.name,
    displayName: fixture.district ? `${fixture.name} · ${fixture.district}` : fixture.name,
    city: fixture.city,
    district: fixture.district,
    streetAddress: fixture.street,
    href: `/sellers/${fixture.handle}`,
    geo: fixture.geo,
    ratingAverage: fixture.ratingAverage,
    ratingCount: fixture.ratingCount
  }));

  const featuredOffers = matchingFixtures.flatMap(fixture =>
    fixture.offers.slice(0, 2).map(item => ({
      title: item.title,
      href: `/products/${item.slug}`,
      sellerName: fixture.name,
      priceDisplay: formatPrice(locale, item.priceMinor)
    }))
  );

  const relatedLocations = PROGRAMMATIC_LOCATIONS.filter(
    candidate =>
      candidate.slug !== location.slug &&
      fixtures.some(fixture => matchesLocation(fixture, candidate) && matchesOffer(fixture, offer))
  ).slice(0, 4);

  const locationLabel = location.labels[locale];
  const offerLabel = offer.labels[locale];
  const heroTitle =
    locale === 'pl'
      ? `${offerLabel} w ${locationLabel}`
      : locale === 'ua'
        ? `${offerLabel} у ${locationLabel}`
        : locale === 'de'
          ? `${offerLabel} in ${locationLabel}`
          : `${offerLabel} in ${locationLabel}`;
  const heroSummary =
    locale === 'pl'
      ? `Porównaj lokalne salony, dostępne oferty i powiązane miejsca dla ${locationLabel}.`
      : locale === 'ua'
        ? `Порівняйте локальні салони, доступні пропозиції та пов'язані місця для ${locationLabel}.`
        : locale === 'de'
          ? `Vergleichen Sie lokale Salons, verfügbare Angebote und verwandte Orte für ${locationLabel}.`
          : `Compare local salons, featured offers and related places for ${locationLabel}.`;

  return {
    locale,
    location,
    offer,
    canonicalPath: `/${locale}/l/${location.slug}/${offer.slug}`,
    heroTitle,
    heroSummary,
    salons,
    featuredOffers,
    relatedLocations,
    seoContent: buildSeoContent(locale, location, offer)
  };
}