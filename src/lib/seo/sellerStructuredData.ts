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

function collectReviewAggregate(seller: SellerProps): {
  ratingValue?: number;
  reviewCount?: number;
} {
  const reviews = Array.isArray(seller.reviews)
    ? seller.reviews.filter((review): review is { rating?: number | null } => Boolean(review))
    : [];

  const numericRatings = reviews
    .map(review => normalizeNumber(review.rating))
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
  const regon = normalizeString(seller.regon);
  const krs = normalizeString(seller.krs);
  const openingHours = buildOpeningHours(seller.opening_hours);
  const { ratingValue, reviewCount } = collectReviewAggregate(seller);

  // v1.9.0 Wave F7 hardening (Epic-6-Review F-05):
  //   - `district` (Story 6.7 AC6 -> `addressRegion`) is now part of the
  //     required-fields set. Sellers without a district go `canIndex:false`
  //     and the LocalBusiness JSON-LD is suppressed instead of being
  //     emitted incomplete (which would fail Marek J4 trust journey).
  const districtCandidate =
    normalizeString(seller.district) ??
    normalizeString(
      seller.locations?.find(location => normalizeString(location?.district))?.district
    );

  const missingRequired = [
    !name ? 'name' : null,
    !streetAddress ? 'address.streetAddress' : null,
    !addressLocality ? 'address.addressLocality' : null,
    !postalCode ? 'address.postalCode' : null,
    !addressCountry ? 'address.addressCountry' : null,
    !districtCandidate ? 'address.addressRegion' : null,
    !telephone ? 'telephone' : null,
    latitude === null || longitude === null ? 'geo' : null,
    openingHours.length === 0 ? 'openingHours' : null,
    typeof ratingValue !== 'number' || typeof reviewCount !== 'number' ? 'aggregateRating' : null
  ].filter((item): item is string => item !== null);

  if (missingRequired.length > 0) {
    return {
      canIndex: false,
      missingRequired,
      jsonLd: null
    };
  }

  const district = districtCandidate;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality,
      postalCode,
      addressCountry,
      ...(district ? { addressRegion: district } : {})
    }
  };

  if (telephone) {
    jsonLd.telephone = telephone;
  }

  if (taxId) {
    jsonLd.taxID = taxId;
  }

  // Story 6.2 AC12 / FR7.1 — surface PL business identifiers (REGON, KRS)
  // as schema.org `identifier` PropertyValue array so Knowledge Graph and
  // EU business directories can cross-reference. NIP remains the canonical
  // `taxID`; REGON/KRS are supplementary trust signals for J4 Marek persona.
  const identifiers: Array<{ '@type': 'PropertyValue'; propertyID: string; value: string }> = [];
  if (regon) {
    identifiers.push({ '@type': 'PropertyValue', propertyID: 'REGON', value: regon });
  }
  if (krs) {
    identifiers.push({ '@type': 'PropertyValue', propertyID: 'KRS', value: krs });
  }
  if (identifiers.length > 0) {
    jsonLd.identifier = identifiers;
  }

  if (latitude !== null && longitude !== null) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude,
      longitude
    };
  }

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
