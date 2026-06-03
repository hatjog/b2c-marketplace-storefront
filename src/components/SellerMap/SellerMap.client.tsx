'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer as MapContainerBase,
  Marker as MarkerBase,
  Popup,
  TileLayer as TileLayerBase,
  useMap,
} from 'react-leaflet';

import { leafletIconUrls } from '@/lib/map/leafletAssets';

import { buildMapDeepLink } from './deepLink';
import { MapResizeInvalidator } from './MapResizeInvalidator';
import styles from './SellerMap.module.css';
import { getSellerMapModeConfig, type SellerMapMode } from './modes';
import {
  getMapTilerApiKey,
  getMapTilerStyleId,
  isProdMissingMapTilerKey,
  resolveTileSource
} from './tileSource';

// React 19 i react-leaflet 4 mają rozjazd typów, runtime pozostaje zgodny.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapContainer = MapContainerBase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TileLayer = TileLayerBase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Marker = MarkerBase as any;

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions(leafletIconUrls);

export interface SellerMapSeller {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  addressLine?: string;
}

export interface SellerMapProps {
  mode: SellerMapMode;
  sellers: SellerMapSeller[];
  center?: { lat: number; lng: number };
  zoom?: number;
  ariaLabel?: string;
  className?: string;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidSeller(seller: SellerMapSeller): boolean {
  return isFiniteCoordinate(seller.lat) && isFiniteCoordinate(seller.lng);
}

function getUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

const sellerIcon = L.divIcon({
  className: styles.marker,
  html: '',
  iconAnchor: [22, 22],
  iconSize: [44, 44],
  popupAnchor: [0, -22]
});

interface MapBehaviorProps {
  sellers: SellerMapSeller[];
  center?: { lat: number; lng: number };
  maxZoom: number;
}

function MapBehavior({ sellers, center, maxZoom }: MapBehaviorProps) {
  const map = useMap();
  // F-08: stabilna identyfikacja zestawu pinów — fitBounds NIE retriggeruje przy każdym re-render parenta
  // (typowy case: <SellerMap sellers={data.map(...)} /> tworzy nowy array reference per render).
  const sellersKey = useMemo(
    () => sellers.map(s => `${s.id}:${s.lat},${s.lng}`).join('|'),
    [sellers]
  );

  useEffect(() => {
    const zoomButtons = map.getContainer().querySelectorAll<HTMLAnchorElement>('.leaflet-control-zoom a');
    zoomButtons[0]?.setAttribute('aria-label', 'Powiększ mapę');
    zoomButtons[1]?.setAttribute('aria-label', 'Pomniejsz mapę');
  }, [map]);

  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], Math.min(map.getZoom(), maxZoom));
      return;
    }

    if (sellers.length === 1) {
      map.setView([sellers[0].lat, sellers[0].lng], maxZoom);
      return;
    }

    if (sellers.length > 1) {
      const bounds = L.latLngBounds(sellers.map(seller => [seller.lat, seller.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom });
    }
    // sellersKey vs sellers reference — depend tylko na rzeczywistej zmianie identyfikatorów pinów.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, map, maxZoom, sellersKey]);

  return null;
}

function useReducedMotion(): boolean {
  // F-04: lazy initializer — sczyt media query synchronicznie przy mount (komponent jest ssr:false, window dostępne).
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reducedMotion;
}

function useLandingVisibility(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled || visible) return;
    // F-11: brak IO → graceful fallback. Brak node → poczekaj na kolejny effect (nie defetuj lazy mount).
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, visible]);

  return { ref, visible };
}

interface FallbackPanelProps {
  seller?: SellerMapSeller;
  label: string;
  title: string;
  body: string;
  linkLabel: string;
  userAgent: string;
}

function FallbackPanel({ seller, label, title, body, linkLabel, userAgent }: FallbackPanelProps) {
  const link = seller
    ? buildMapDeepLink({ lat: seller.lat, lng: seller.lng, name: seller.name, userAgent })
    : null;

  return (
    <div className={`${styles.shell} ${styles.fallback}`} data-testid="seller-map-fallback">
      <div className={styles.fallbackInner}>
        <p className={styles.eyebrow}>{label}</p>
        <p className={styles.fallbackTitle}>{title}</p>
        <p className={styles.fallbackText}>
          {seller?.neighborhood || seller?.addressLine || body}
        </p>
        {link && (
          <a
            className={styles.deepLink}
            href={link.primary}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={linkLabel}
          >
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  );
}

export function SellerMap({
  mode,
  sellers,
  center,
  zoom,
  ariaLabel,
  className
}: SellerMapProps) {
  const t = useTranslations('seller.map');
  const config = getSellerMapModeConfig(mode);
  const reducedMotion = useReducedMotion();
  const [tileFailed, setTileFailed] = useState(false);
  const apiKey = getMapTilerApiKey();
  const styleId = getMapTilerStyleId();
  // F-09: UA stałe per page lifetime — jeden odczyt zamiast N×navigator.userAgent w pętli markerów.
  const userAgent = useMemo(getUserAgent, []);
  const tileSource = useMemo(() => resolveTileSource(apiKey, styleId), [apiKey, styleId]);
  const validSellers = useMemo(() => sellers.filter(isValidSeller), [sellers]);
  const primarySeller = validSellers[0];
  const initialCenter = center
    ? [center.lat, center.lng]
    : primarySeller
      ? [primarySeller.lat, primarySeller.lng]
      : [52.0, 19.0];
  const initialZoom = zoom ?? config.defaultZoom;
  const { ref, visible } = useLandingVisibility(config.lazyMount);

  // F-03: w produkcji bez klucza MapTiler renderujemy FallbackPanel; w dev/test wpada CartoDB no-key fallback.
  const isProdMissingKey = isProdMissingMapTilerKey(tileSource);

  if (isProdMissingKey || tileFailed || validSellers.length === 0) {
    return (
      <div ref={ref} className={className}>
        <FallbackPanel
          seller={primarySeller}
          label={t('fallbackEyebrow')}
          title={t('fallbackTitle')}
          body={t('fallbackBody')}
          linkLabel={t('openMaps')}
          userAgent={userAgent}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel ?? t('ariaLabel')}
      className={`${styles.shell} ${styles[`mode-${mode}`]} ${className ?? ''}`}
      data-map-mode={mode}
      data-map-max-zoom={config.maxAutoZoom}
      data-map-tile-source={tileSource.keyed ? 'maptiler' : 'cartodb'}
      data-testid="seller-map"
      tabIndex={0}
    >
      {visible ? (
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          maxZoom={config.maxAutoZoom}
          keyboard
          keyboardPanDelta={80}
          scrollWheelZoom={config.scrollWheelZoom}
          dragging={config.dragging}
          zoomControl={config.zoomControl}
          zoomAnimation={!reducedMotion}
          fadeAnimation={!reducedMotion}
          className={styles.map}
        >
          <TileLayer
            attribution={tileSource.attribution}
            url={tileSource.url}
            eventHandlers={{
              tileerror: () => setTileFailed(true)
            }}
          />
          <MapResizeInvalidator />
          <MapBehavior sellers={validSellers} center={center} maxZoom={config.maxAutoZoom} />
          {validSellers.map(seller => {
            const link = buildMapDeepLink({
              lat: seller.lat,
              lng: seller.lng,
              name: seller.name,
              userAgent
            });
            const showAddress = mode === 'detail' && seller.addressLine;

            return (
              <Marker
                key={seller.id}
                position={[seller.lat, seller.lng]}
                icon={sellerIcon}
                keyboard
                alt={t('markerAlt', { name: seller.name })}
              >
                <Popup>
                  <div className={styles.popup} data-testid={`seller-map-popup-${seller.id}`}>
                    <p className={styles.popupTitle}>{seller.name}</p>
                    {seller.neighborhood && (
                      <p className={styles.popupMeta}>{seller.neighborhood}</p>
                    )}
                    {showAddress && <p className={styles.popupMeta}>{seller.addressLine}</p>}
                    {config.showDeepLink && (
                      <a
                        className={styles.deepLink}
                        href={link.primary}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t(link.labelKey)}
                      >
                        {/* F-06: provider-aware label (Apple vs Google) per UX-DR26. */}
                        {t(link.labelKey)}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      ) : (
        <span className={styles.skeleton}>{t('loading')}</span>
      )}
    </div>
  );
}

export default SellerMap;
