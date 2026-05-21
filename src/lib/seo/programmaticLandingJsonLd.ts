import type { ProgrammaticLandingData } from '@/lib/programmatic-landing';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function stripUndefined(value: unknown): JsonValue {
  if (value === undefined) {
    return null;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => stripUndefined(item)).filter(item => item !== null) as JsonValue[];
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, stripUndefined(item)])
        .filter(([, item]) => item !== null)
    ) as JsonValue;
  }

  return null;
}

function collectIds(value: JsonValue, ids = new Set<string>()) {
  if (!value || typeof value !== 'object') {
    return ids;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectIds(item, ids));
    return ids;
  }

  const id = value['@id'];
  if (typeof id === 'string') {
    if (ids.has(id)) {
      throw new Error(`Duplicate JSON-LD @id: ${id}`);
    }
    ids.add(id);
  }

  Object.values(value).forEach(item => collectIds(item, ids));
  return ids;
}

function assertRequiredFields(data: ProgrammaticLandingData, canonicalUrl: string) {
  if (!canonicalUrl) throw new Error('JSON-LD canonical URL is required');
  if (!data.location.geo.latitude || !data.location.geo.longitude) {
    throw new Error('Programmatic landing Place requires geo coordinates');
  }
  if (!data.location.addressLocality) {
    throw new Error('Programmatic landing Place requires address locality');
  }
  if (!data.offer.labels[data.locale]) {
    throw new Error('Programmatic landing Offer requires localized name');
  }
}

export function buildProgrammaticLandingJsonLd(
  data: ProgrammaticLandingData,
  canonicalUrl: string
) {
  assertRequiredFields(data, canonicalUrl);

  const placeId = `${canonicalUrl}#place`;
  const offerCatalogId = `${canonicalUrl}#offer-catalog`;

  const jsonLd = stripUndefined({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        '@id': placeId,
        name: data.location.labels[data.locale],
        url: canonicalUrl,
        address: {
          '@type': 'PostalAddress',
          addressLocality: data.location.addressLocality,
          addressRegion: data.location.district ?? data.location.city,
          addressCountry: 'PL'
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: data.location.geo.latitude,
          longitude: data.location.geo.longitude
        }
      },
      {
        '@type': 'OfferCatalog',
        '@id': offerCatalogId,
        name: data.offer.labels[data.locale],
        url: canonicalUrl,
        itemListElement: data.featuredOffers.map((offer, index) => ({
          '@type': 'Offer',
          '@id': `${canonicalUrl}#offer-${index + 1}`,
          name: offer.title,
          url: new URL(offer.href, canonicalUrl).toString(),
          seller: {
            '@type': 'Organization',
            name: offer.sellerName
          },
          priceCurrency: offer.priceDisplay ? 'PLN' : undefined
        }))
      }
    ]
  });

  collectIds(jsonLd);
  return jsonLd;
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(stripUndefined(value))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}