'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import L from 'leaflet';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Circle as CircleBase,
  MapContainer as MapContainerBase,
  Marker as MarkerBase,
  Popup,
  TileLayer as TileLayerBase,
  useMap
} from 'react-leaflet';

import type { SellerListItem } from '@/lib/data/seller';
import { leafletIconUrls } from '@/lib/map/leafletAssets';
import { MapResizeInvalidator } from '@/components/SellerMap/MapResizeInvalidator';
import { resolveTileSource } from '@/components/SellerMap/tileSource';

import {
  DEFAULT_CLUSTER_OPTIONS,
  resolveClusterEnabled,
  type SellerMapClusterMode,
  type SellerMapMode
} from './clustering';

// Cast to any to workaround react-leaflet 4.x / React 19 types mismatch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapContainer = MapContainerBase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TileLayer = TileLayerBase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Circle = CircleBase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Marker = MarkerBase as any;

/**
 * Story v160-4-2 — interactive seller map (UX-DR15, FR21).
 *
 * Tile source (Story 7.5 / FR7 / ra-2): mode-aware swap CartoDB→MapTiler przez
 * współdzielony `@/components/SellerMap/tileSource` — klucz MapTiler ⇒ kafle
 * MapTiler (attribution MapTiler+OpenStreetMap); brak klucza w dev/test ⇒
 * CartoDB no-key voyager fallback. Zamiast zahardkodowanego, divergentnego
 * CartoDB (R1-HIGH consolidation — jeden resolver dla obu map).
 *
 * Why react-leaflet + Leaflet 1.9:
 * - MIT / OSS / no usage limits (vs Mapbox commercial tiers)
 * - ~50KB gzip (vs Google Maps ~200KB) — fits NFR-PERF-4 LCP budget when
 *   lazy-loaded behind `next/dynamic({ ssr: false })` (see SellerMap.dynamic).
 * - OSM-upstream + Polish labels visible (PL/EN locale parity).
 *
 * SSR caveat: `react-leaflet` accesses `window` at module init — must be
 * imported via `next/dynamic` with `ssr: false`. Use `SellerMapDynamic` from
 * `./SellerMap.dynamic` (or the barrel `index.ts`) — never import this file
 * directly from a server component.
 */

// Bundler-reflection workaround: Webpack/Turbopack can't resolve Leaflet's
// `_getIconUrl` so we delete it and merge explicit URLs. Asset URLs are
// bundled locally (BSD-2-Clause; LICENSE under `public/leaflet-assets/`) —
// no third-party CDN, eliminating supply-chain risk and third-party IP
// exposure on every map render (TF-65, 2026-05-07). Path constants live
// in `@/lib/map/leafletAssets` so tests can runtime-assert them.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions(leafletIconUrls);

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
  /**
   * Story 4.6 — optional marker clustering. `auto` clusters list/landing maps
   * only above the 50-seller threshold; detail/mini force clustering off.
   */
  clusterMode?: SellerMapClusterMode;
  mode?: SellerMapMode;
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
      const all = L.latLngBounds([bounds.getNorthEast(), bounds.getSouthWest(), ...points]);
      map.fitBounds(all, { padding: [40, 40], maxZoom: 13 });
      return;
    }

    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, sellers, userLat, userLng, radiusKm]);
  return null;
}

// Defense-in-depth: translations are repo-controlled and `count` is numeric,
// so XSS surface here is zero today. We still escape in case a future i18n
// edit introduces `<` / `&` / quote characters into the cluster label.
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

interface PopupContentArgs {
  seller: SellerListItem & { lat: number; lng: number };
  locale: string;
  fallbackAddress: string;
  viewDetailsLabel: string;
  markerAriaLabel: string;
}

// Shared popup builder for the cluster branch (imperative DOM) — the raw
// branch uses the JSX equivalent inline below. Keep both in sync.
function buildSellerPopupElement({
  seller,
  locale,
  fallbackAddress,
  viewDetailsLabel,
  markerAriaLabel
}: PopupContentArgs): HTMLElement {
  const popup = document.createElement('div');
  popup.dataset.testid = `seller-map-popup-${seller.handle}`;

  const title = document.createElement('h3');
  title.className = 'text-base font-semibold';
  title.textContent = seller.name;
  popup.appendChild(title);

  const handle = document.createElement('code');
  handle.className = 'text-xs text-gray-500';
  handle.textContent = `@${seller.handle}`;
  popup.appendChild(handle);

  const address = document.createElement('p');
  address.className = 'mt-1 text-sm';
  address.textContent = seller.address ?? seller.city ?? fallbackAddress;
  popup.appendChild(address);

  const link = document.createElement('a');
  link.href = `/${locale}/sellers/${seller.handle}`;
  link.className = 'mt-2 inline-block text-sm font-medium text-primary underline';
  link.setAttribute('aria-label', markerAriaLabel);
  link.textContent = viewDetailsLabel;
  popup.appendChild(link);

  return popup;
}

interface ClusteredSellerMarkersProps {
  sellers: ReadonlyArray<SellerListItem & { lat: number; lng: number }>;
  locale: string;
  onMarkerClick?: (seller: SellerListItem) => void;
  markerAriaLabel: (seller: SellerListItem) => string;
  clusterAriaLabel: (count: number) => string;
  fallbackAddress: string;
  viewDetailsLabel: string;
}

function ClusteredSellerMarkers({
  sellers,
  locale,
  onMarkerClick,
  markerAriaLabel,
  clusterAriaLabel,
  fallbackAddress,
  viewDetailsLabel
}: ClusteredSellerMarkersProps) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  // Mount the cluster group once per map; the iconCreateFunction reads the
  // current `clusterAriaLabel` through a ref so layer cleanup is not coupled
  // to callback identity (story 4.6 review H1).
  const clusterAriaLabelRef = useRef(clusterAriaLabel);
  useEffect(() => {
    clusterAriaLabelRef.current = clusterAriaLabel;
  }, [clusterAriaLabel]);

  useEffect(() => {
    const group = L.markerClusterGroup({
      ...DEFAULT_CLUSTER_OPTIONS,
      iconCreateFunction: cluster => {
        const count = cluster.getChildCount();
        const bucket = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
        const label = escapeHtml(clusterAriaLabelRef.current(count));

        // a11y: aria-label belongs on the focusable role="button" element.
        // Leaflet.markercluster provides built-in keyboard activation on the
        // outer `.leaflet-marker-icon` via `marker.options.keyboard` (default
        // true), so we expose a single accessible name here without adding a
        // duplicate inner tab stop (story 4.6 review L1).
        return L.divIcon({
          html: `<div role="button" aria-label="${label}"><span aria-hidden="true">${count}</span></div>`,
          className: `marker-cluster marker-cluster-${bucket}`,
          iconSize: L.point(40, 40)
        });
      }
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      group.clearLayers();
      groupRef.current = null;
    };
  }, [map]);

  // Markers are (re)bound whenever the actual seller set or i18n strings
  // change — parent re-renders that only mutate callback identity no longer
  // tear the cluster group down and rebuild >50 markers (story 4.6 review
  // H1). Click handler is read through a ref so callback identity changes do
  // not invalidate this effect either.
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.clearLayers();
    for (const seller of sellers) {
      const ariaLabel = markerAriaLabel(seller);
      const marker = L.marker([seller.lat, seller.lng], {
        alt: ariaLabel,
        title: seller.name
      });
      marker.on('click', () => onMarkerClickRef.current?.(seller));
      marker.bindPopup(
        buildSellerPopupElement({
          seller,
          locale,
          fallbackAddress,
          viewDetailsLabel,
          markerAriaLabel: ariaLabel
        })
      );
      group.addLayer(marker);
    }
  }, [sellers, locale, markerAriaLabel, fallbackAddress, viewDetailsLabel]);

  return null;
}

export function SellerMap({
  sellers,
  locale,
  onMarkerClick,
  className,
  userLat,
  userLng,
  radiusKm,
  clusterMode = 'auto',
  mode = 'list'
}: SellerMapProps) {
  const t = useTranslations('seller.list.map');

  // Compute validSellers + skipped count together so neither pass mutates a
  // ref during render (review M2) and both are stable across renders when
  // `sellers` identity is stable.
  const { validSellers, skippedCount } = useMemo(() => {
    const valid: Array<SellerListItem & { lat: number; lng: number }> = [];
    let skipped = 0;
    for (const seller of sellers) {
      if (hasCoords(seller)) {
        valid.push(seller);
      } else {
        skipped += 1;
      }
    }
    return { validSellers: valid, skippedCount: skipped };
  }, [sellers]);

  const clusterEnabled = resolveClusterEnabled({
    mode,
    clusterMode,
    sellersCount: validSellers.length
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && skippedCount > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[SellerMap] skipped ${skippedCount} seller(s) without finite lat/lng`);
    }
  }, [skippedCount]);

  // Story 4.6 review H1 — stable callback identities so the cluster group
  // mount effect (deps: [map]) and the markers effect (deps include the i18n
  // callbacks) only re-run when their actual inputs change. Without these
  // wrappers, every parent render produced fresh arrow functions and tore
  // the cluster group down on every zoom/pan.
  const markerAriaLabel = useCallback(
    (seller: SellerListItem) => t('aria_marker', { name: seller.name }),
    [t]
  );
  const clusterAriaLabel = useCallback(
    (count: number) => t('clusterAriaLabel', { count }),
    [t]
  );
  const fallbackAddress = useMemo(() => t('popup_address'), [t]);
  const viewDetailsLabel = useMemo(() => t('popup_view_details'), [t]);

  // Story 7.5 (FR7/ra-2): mode-aware swap CartoDB→MapTiler — współdzielony
  // resolver (klucz ⇒ MapTiler, brak klucza dev/test ⇒ CartoDB no-key fallback),
  // zamiast zahardkodowanego, divergentnego URL-a CartoDB.
  const tileSource = useMemo(() => resolveTileSource(), []);

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
          attribution={tileSource.attribution}
          url={tileSource.url}
        />
        <MapResizeInvalidator />
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
              <Marker
                position={[userLat, userLng]}
                alt="user location"
              />
            </>
          )}
        {clusterEnabled ? (
          <ClusteredSellerMarkers
            sellers={validSellers}
            locale={locale}
            onMarkerClick={onMarkerClick}
            markerAriaLabel={markerAriaLabel}
            clusterAriaLabel={clusterAriaLabel}
            fallbackAddress={fallbackAddress}
            viewDetailsLabel={viewDetailsLabel}
          />
        ) : (
          validSellers.map(seller => (
            <Marker
              key={seller.handle}
              position={[seller.lat, seller.lng]}
              eventHandlers={{
                click: () => onMarkerClick?.(seller)
              }}
              alt={markerAriaLabel(seller)}
              data-testid={`seller-map-raw-marker-${seller.handle}`}
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
          ))
        )}
      </MapContainer>
    </div>
  );
}

export default SellerMap;
