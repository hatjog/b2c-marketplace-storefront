'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import type { SellerListItem } from '@/lib/data/seller';

/**
 * Story v160-4-2 — interactive seller map (UX-DR15, FR21).
 *
 * Why react-leaflet + Leaflet 1.9 + CartoDB Voyager tiles:
 * - MIT / OSS / no API key / no usage limits (vs Mapbox commercial tiers)
 * - ~50KB gzip (vs Google Maps ~200KB) — fits NFR-PERF-4 LCP budget when
 *   lazy-loaded behind `next/dynamic({ ssr: false })` (see SellerMap.dynamic).
 * - Voyager tiles are OSM-upstream + Polish labels visible (PL/EN locale parity).
 *
 * SSR caveat: `react-leaflet` accesses `window` at module init — must be
 * imported via `next/dynamic` with `ssr: false`. Use `SellerMapDynamic` from
 * `./SellerMap.dynamic` (or the barrel `index.ts`) — never import this file
 * directly from a server component.
 */

// Default Leaflet icon Webpack/Turbopack fix — bundler can't resolve Leaflet's
// reflective `_getIconUrl`. Pin CDN URLs to avoid 404'd marker squares.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const PL_CENTER: [number, number] = [52.0, 19.0];
const PL_DEFAULT_ZOOM = 6;

export interface SellerMapProps {
  sellers: SellerListItem[];
  locale: string;
  onMarkerClick?: (seller: SellerListItem) => void;
  className?: string;
  /**
   * Story v160-4-3 — geolocation "Blisko mnie" radius overlay. When all
   * three are finite, the map renders a Leaflet `<Circle>` centered on the
   * user position with `radiusKm * 1000` metres + a marker pin for the
   * user. The map auto-fits bounds to include the circle. All three are
   * required together — partial inputs are treated as no-overlay.
   */
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasCoords(
  seller: SellerListItem
): seller is SellerListItem & { lat: number; lng: number } {
  return isFiniteNumber(seller.lat) && isFiniteNumber(seller.lng);
}

interface FitBoundsProps {
  sellers: ReadonlyArray<SellerListItem & { lat: number; lng: number }>;
  /**
   * Story v160-4-3 — when "Blisko mnie" is active, fit bounds includes the
   * circle so the user always sees their radius onscreen, even with 0-1
   * markers. Falls back to seller markers when overlay absent.
   */
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
}

function FitBoundsToMarkers({ sellers, userLat, userLng, radiusKm }: FitBoundsProps) {
  const map = useMap();
  useEffect(() => {
    const points: Array<[number, number]> = sellers.map(s => [s.lat, s.lng]);
    const overlayActive =
      typeof userLat === 'number' &&
      typeof userLng === 'number' &&
      typeof radiusKm === 'number' &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng) &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0;

    if (overlayActive) {
      // Build a synthetic bounding box that encloses the circle by adding
      // four cardinal points at radius distance — this avoids depending on
      // Leaflet's internal `Circle.getBounds()` (only available post-add).
      const center = L.latLng(userLat as number, userLng as number);
      const radiusMeters = (radiusKm as number) * 1000;
      const bounds = center.toBounds(radiusMeters * 2);
      const all = L.latLngBounds([
        bounds.getNorthEast(),
        bounds.getSouthWest(),
        ...points
      ]);
      map.fitBounds(all, { padding: [40, 40], maxZoom: 13 });
      return;
    }

    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, sellers, userLat, userLng, radiusKm]);
  return null;
}

export function SellerMap({
  sellers,
  locale,
  onMarkerClick,
  className,
  userLat,
  userLng,
  radiusKm
}: SellerMapProps) {
  const t = useTranslations('seller.list.map');
  const skipped = useRef(0);

  const validSellers: Array<SellerListItem & { lat: number; lng: number }> = [];
  for (const seller of sellers) {
    if (hasCoords(seller)) {
      validSellers.push(seller);
    } else {
      skipped.current += 1;
    }
  }

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && skipped.current > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SellerMap] skipped ${skipped.current} seller(s) without finite lat/lng`
      );
    }
  }, []);

  return (
    <div
      role="region"
      aria-label={t('aria_map')}
      className={className ?? 'h-96 w-full'}
      data-testid="seller-map"
    >
      <MapContainer
        center={PL_CENTER}
        zoom={PL_DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-sm"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBoundsToMarkers
          sellers={validSellers}
          userLat={userLat}
          userLng={userLng}
          radiusKm={radiusKm}
        />
        {typeof userLat === 'number' &&
          typeof userLng === 'number' &&
          typeof radiusKm === 'number' &&
          Number.isFinite(userLat) &&
          Number.isFinite(userLng) &&
          Number.isFinite(radiusKm) &&
          radiusKm > 0 && (
            <>
              <Circle
                center={[userLat, userLng]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#7C3AED',
                  fillColor: '#7C3AED',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
              <Marker position={[userLat, userLng]} alt="user location" />
            </>
          )}
        {validSellers.map(seller => (
          <Marker
            key={seller.handle}
            position={[seller.lat, seller.lng]}
            eventHandlers={{
              click: () => onMarkerClick?.(seller)
            }}
            alt={t('aria_marker', { name: seller.name })}
          >
            <Popup>
              <div data-testid={`seller-map-popup-${seller.handle}`}>
                <h3 className="text-base font-semibold">{seller.name}</h3>
                <code className="text-xs text-gray-500">@{seller.handle}</code>
                <p className="mt-1 text-sm">
                  {seller.address ?? seller.city ?? t('popup_address')}
                </p>
                <Link
                  href={`/${locale}/sellers/${seller.handle}`}
                  className="mt-2 inline-block text-sm font-medium text-primary underline"
                  aria-label={t('aria_marker', { name: seller.name })}
                >
                  {t('popup_view_details')}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default SellerMap;
