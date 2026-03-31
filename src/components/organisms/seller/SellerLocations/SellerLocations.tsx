import type { SellerLocation } from '@/types/seller';

function buildMapsUrl(loc: SellerLocation): string | null {
  if (!loc.city || !loc.address_line) return null;
  const q = `${encodeURIComponent(loc.address_line)},${encodeURIComponent(loc.postal_code ?? '')}+${encodeURIComponent(loc.city)}`;
  return `https://maps.google.com/?q=${q}`;
}

interface Props {
  locations: SellerLocation[] | null | undefined;
}

export function SellerLocations({ locations }: Props) {
  if (!locations || locations.length === 0) return null;

  return (
    <section aria-label="Lokalizacje salonu" data-testid="seller-locations">
      <h2 className="text-xl font-semibold mb-4">Lokalizacje</h2>
      <ul className="space-y-3">
        {locations.map((loc, i) => {
          const mapsUrl = buildMapsUrl(loc);
          const addressParts = [
            loc.address_line,
            loc.postal_code && loc.city
              ? `${loc.postal_code} ${loc.city}`
              : loc.city,
          ].filter(Boolean);
          const addressText = addressParts.join(', ');

          return (
            <li key={i} className="flex flex-col gap-1">
              {addressText && <p className="text-gray-700">{addressText}</p>}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                  aria-label={`Otwórz ${addressText} w Google Maps`}
                >
                  Zobacz na mapie ↗
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
