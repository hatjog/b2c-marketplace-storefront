import type { SellerOpeningHours, SellerProps } from '@/types/seller';

type SellerStructuredDataAssessment = {
  canIndex: boolean;
  missingRequired: string[];
  jsonLd: Record<string, unknown> | null;
};

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildOpeningHours(openingHours: SellerOpeningHours | null | undefined): string[] {
  if (!openingHours) return [];

  return Object.entries(openingHours).flatMap(([day, range]) => {
    if (!range?.open || !range?.close) return [];
    return [`${day} ${range.open}-${range.close}`];
  });
}

function collectReviewAggregate(seller: SellerProps): { ratingValue?: number; reviewCount?: number } {
  const reviews = Array.isArray(seller.reviews)
    ? seller.reviews.filter((review): review is { rating?: number | null } => Boolean(review))
    : [];

  const numericRatings = reviews
    .map((review) => normalizeNumber(review.rating))
    .filter((rating): rating is number => rating !== null);

  if (numericRatings.length === 0) {
    return {};
  }

  const total = numericRatings.reduce((sum, rating) => sum + rating, 0);
  return {
    ratingValue: Number((total / numericRatings.length).toFixed(1)),
    reviewCount: numericRatings.length
  };
}

export function assessSellerStructuredData(seller: SellerProps): SellerStructuredDataAssessment {
  const name = normalizeString(seller.name);
  const streetAddress = normalizeString(seller.address_line);
  const addressLocality = normalizeString(seller.city);
  const postalCode = normalizeString(seller.postal_code);
  const addressCountry = normalizeString(seller.country_code)?.toUpperCase() ?? null;
  const telephone = normalizeString(seller.phone);
  const latitude = normalizeNumber(seller.lat);
  const longitude = normalizeNumber(seller.lng);
  const taxId = normalizeString(seller.tax_id);

  const missingRequired = [
    !name ? 'name' : null,
    !streetAddress ? 'address.streetAddress' : null,
    !addressLocality ? 'address.addressLocality' : null,
    !postalCode ? 'address.postalCode' : null,
    !addressCountry ? 'address.addressCountry' : null,
    !telephone ? 'telephone' : null,
    latitude === null ? 'geo.latitude' : null,
    longitude === null ? 'geo.longitude' : null,
    !taxId ? 'legal.tax_id' : null
  ].filter((item): item is string => item !== null);

  if (missingRequired.length > 0) {
    return {
      canIndex: false,
      missingRequired,
      jsonLd: null
    };
  }

  const openingHours = buildOpeningHours(seller.opening_hours);
  const { ratingValue, reviewCount } = collectReviewAggregate(seller);
  const district =
    normalizeString(seller.district) ??
    normalizeString(seller.locations?.find(location => normalizeString(location?.district))?.district);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality,
      postalCode,
      addressCountry,
      ...(district ? { addressRegion: district } : {})
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude,
      longitude
    }
  };

  if (openingHours.length > 0) {
    jsonLd.openingHours = openingHours;
  }

  if (typeof ratingValue === 'number' && typeof reviewCount === 'number') {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount
    };
  }

  return {
    canIndex: true,
    missingRequired: [],
    jsonLd
  };
}
