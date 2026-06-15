'use client';

import { useTranslations } from 'next-intl';

import type { SellerLocation } from '@/types/seller';

function buildMapsUrl(loc: SellerLocation): string | null {
  if (!loc.city || !loc.address_line) return null;
  const parts = [loc.address_line, loc.postal_code, loc.city].filter(Boolean);
  return `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`;
}

interface Props {
  locations: SellerLocation[] | null | undefined;
}

export function SellerLocations({ locations }: Props) {
  const t = useTranslations('seller.locations');

  if (!locations || locations.length === 0) return null;

  return (
    <section aria-label={t('aria_label')} data-testid="seller-locations">
      <h2 className="text-xl font-semibold mb-4">{t('heading')}</h2>
      <ul className="space-y-3">
        {locations.map((loc, i) => {
          const addressParts = [
            loc.address_line,
            loc.postal_code && loc.city
              ? `${loc.postal_code} ${loc.city}`
              : loc.city,
          ].filter(Boolean);
          const addressText = addressParts.join(', ');

          if (!addressText) return null;

          const mapsUrl = buildMapsUrl(loc);

          return (
            <li key={addressText || i} className="flex flex-col gap-1">
              {addressText && <p className="text-gray-700">{addressText}</p>}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                  aria-label={t('open_maps_aria', { address: addressText })}
                >
                  {t('open_maps')}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
