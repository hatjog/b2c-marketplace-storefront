// @vitest-environment jsdom
//
// Story 4.6 T4 — render-level coverage for the cluster/raw branch switch.
// The cluster branch mounts `<ClusteredSellerMarkers>` (which returns null
// from React's perspective and creates DOM imperatively inside a useEffect),
// while the raw branch maps `validSellers` to `<Marker>` elements. We mock
// `react-leaflet` + `leaflet` + `leaflet.markercluster` to keep this test
// hermetic and assert the branch selection by counting raw-marker test-ids
// emitted in the DOM (cluster branch yields zero, raw branch one per seller).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import type { SellerListItem } from '@/lib/data/seller';

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key
}));

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) =>
    createElement('a', rest, children)
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));
vi.mock('leaflet.markercluster', () => ({}));

vi.mock('leaflet', () => {
  const proto: { _getIconUrl?: unknown } = { _getIconUrl: () => '' };
  const Icon = { Default: { prototype: proto, mergeOptions: vi.fn() } };
  const stubLayer = {
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    clearLayers: vi.fn(),
    on: vi.fn(),
    bindPopup: vi.fn()
  };
  return {
    default: {
      Icon,
      marker: vi.fn(() => stubLayer),
      markerClusterGroup: vi.fn(() => stubLayer),
      divIcon: vi.fn(() => ({})),
      point: vi.fn(() => ({})),
      latLng: vi.fn(() => ({ toBounds: () => ({ getNorthEast: () => [0, 0], getSouthWest: () => [0, 0] }) })),
      latLngBounds: vi.fn(() => ({}))
    }
  };
});

vi.mock('react-leaflet', () => {
  const passthrough = (testid: string) => {
    const MockLeafletComponent = ({
      children,
      ...rest
    }: { children?: React.ReactNode } & Record<string, unknown>) =>
      createElement('div', { 'data-testid': testid, ...rest }, children);
    MockLeafletComponent.displayName = `MockLeafletComponent(${testid})`;
    return MockLeafletComponent;
  };
  return {
    MapContainer: passthrough('seller-map-container'),
    TileLayer: passthrough('seller-map-tile'),
    Circle: passthrough('seller-map-circle'),
    Marker: ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) =>
      createElement('div', rest, children),
    Popup: ({ children }: { children?: React.ReactNode }) =>
      createElement('div', { 'data-testid': 'seller-map-popup' }, children),
    useMap: () => ({ addLayer: vi.fn(), removeLayer: vi.fn(), fitBounds: vi.fn() })
  };
});

vi.mock('@/lib/map/leafletAssets', () => ({
  leafletIconUrls: { iconUrl: '', iconRetinaUrl: '', shadowUrl: '' }
}));

import { SellerMap } from '../SellerMap';

function makeSellers(count: number): SellerListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    handle: `s${i}`,
    name: `Seller ${i}`,
    lat: 52 + i * 0.001,
    lng: 19 + i * 0.001,
    address: 'a',
    city: 'c'
  })) as unknown as SellerListItem[];
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('SellerMap cluster branch selection (T4)', () => {
  it('mode=list with 51 sellers → cluster branch, no raw marker test-ids', () => {
    act(() => {
      root.render(createElement(SellerMap, { sellers: makeSellers(51), locale: 'pl', mode: 'list' }));
    });
    const raw = container.querySelectorAll('[data-testid^="seller-map-raw-marker-"]');
    expect(raw.length).toBe(0);
  });

  it('mode=list with 49 sellers → raw branch, 49 marker test-ids', () => {
    act(() => {
      root.render(createElement(SellerMap, { sellers: makeSellers(49), locale: 'pl', mode: 'list' }));
    });
    const raw = container.querySelectorAll('[data-testid^="seller-map-raw-marker-"]');
    expect(raw.length).toBe(49);
  });

  it('mode=detail with 100 sellers → raw branch always (clustering forced off)', () => {
    act(() => {
      root.render(
        createElement(SellerMap, { sellers: makeSellers(100), locale: 'pl', mode: 'detail' })
      );
    });
    const raw = container.querySelectorAll('[data-testid^="seller-map-raw-marker-"]');
    expect(raw.length).toBe(100);
  });

  it('clusterMode=on overrides threshold even with 10 sellers (no raw test-ids)', () => {
    act(() => {
      root.render(
        createElement(SellerMap, {
          sellers: makeSellers(10),
          locale: 'pl',
          mode: 'list',
          clusterMode: 'on'
        })
      );
    });
    const raw = container.querySelectorAll('[data-testid^="seller-map-raw-marker-"]');
    expect(raw.length).toBe(0);
  });
});
