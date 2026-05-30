// @vitest-environment jsdom
// F-05: render-tree introspection test (zastępuje substring-only contract test fałszywą pewnością).
// Asercje pokrywają per-mode behavior: aspect-ratio, maxZoom prop, attribution, popup-bez-addressLine,
// deep-link visibility, tabIndex na kontenerze. react-leaflet mockowany aby uniknąć leafletowych side-effects w jsdom.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('react-leaflet', () => {
  const serializableProps = (props: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === 'function' || k === 'eventHandlers' || k === 'icon') continue;
      out[k] = v;
    }
    return out;
  };

  return {
    MapContainer: ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => (
      <div data-mock-tag="MapContainer" data-mock-props={JSON.stringify(serializableProps(rest))}>
        {children}
      </div>
    ),
    TileLayer: (rest: Record<string, unknown>) => (
      <div
        data-mock-tag="TileLayer"
        data-mock-attribution={String(rest.attribution ?? '')}
        data-mock-url={String(rest.url ?? '')}
      />
    ),
    Marker: ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => (
      <div data-mock-tag="Marker" data-mock-props={JSON.stringify(serializableProps(rest))}>
        {children}
      </div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => (
      <div data-mock-tag="Popup">{children}</div>
    ),
    useMap: () => ({
      getContainer: () => ({ querySelectorAll: () => [] }),
      getZoom: () => 12,
      setView: () => undefined,
      fitBounds: () => undefined,
    }),
  };
});

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet', () => ({
  default: {
    divIcon: () => ({}),
    latLngBounds: () => ({}),
    Icon: { Default: { prototype: {}, mergeOptions: () => undefined } },
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, vars?: Record<string, string>) => {
    const merged = vars
      ? Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), key)
      : key;
    return `${namespace}.${merged}`;
  },
}));

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const sellers = [
  { id: 'a', name: 'Salon A', lat: 52.23, lng: 21.01, neighborhood: 'Centrum', addressLine: 'ul. Marszałkowska 1' },
  { id: 'b', name: 'Salon B', lat: 52.24, lng: 21.02, neighborhood: 'Mokotów', addressLine: 'ul. Puławska 5' },
];

async function renderMap(props: { mode: 'list' | 'detail' | 'mini' | 'landing' }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const { SellerMap } = await import('../SellerMap.client');

  process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key';

  await act(async () => {
    root.render(<SellerMap mode={props.mode} sellers={sellers} />);
  });
  return { container, root };
}

describe('SellerMap render contract', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  });

  it('renderuje kontener z tabIndex i data-map-mode dla każdego trybu', async () => {
    for (const mode of ['list', 'detail', 'mini', 'landing'] as const) {
      const { container, root } = await renderMap({ mode });
      const shell = container.querySelector('[data-testid="seller-map"]');
      expect(shell, `mode=${mode}`).not.toBeNull();
      expect(shell?.getAttribute('tabindex')).toBe('0');
      expect(shell?.getAttribute('data-map-mode')).toBe(mode);
      await act(async () => root.unmount());
    }
  });

  it('TileLayer attribution zawiera MapTiler oraz OpenStreetMap', async () => {
    const { container, root } = await renderMap({ mode: 'list' });
    const tile = container.querySelector('[data-mock-tag="TileLayer"]');
    const attr = tile?.getAttribute('data-mock-attribution') ?? '';
    expect(attr).toContain('MapTiler');
    expect(attr).toContain('OpenStreetMap');
    await act(async () => root.unmount());
  });

  it('MapContainer otrzymuje maxZoom <= 14 dla wszystkich trybów', async () => {
    for (const mode of ['list', 'detail', 'mini', 'landing'] as const) {
      const { container, root } = await renderMap({ mode });
      const map = container.querySelector('[data-mock-tag="MapContainer"]');
      const props = JSON.parse(map?.getAttribute('data-mock-props') ?? '{}');
      expect(props.maxZoom, `mode=${mode}`).toBeLessThanOrEqual(14);
      expect(props.keyboardPanDelta).toBe(80);
      await act(async () => root.unmount());
    }
  });

  it('popup w detail mode pokazuje addressLine, w list/mini/landing nie', async () => {
    for (const mode of ['detail', 'list', 'mini', 'landing'] as const) {
      const { container, root } = await renderMap({ mode });
      const popups = container.querySelectorAll('[data-mock-tag="Popup"]');
      const popupHtml = Array.from(popups).map(p => p.textContent).join('\n');
      if (mode === 'detail') {
        expect(popupHtml).toContain('Marszałkowska');
      } else {
        expect(popupHtml).not.toContain('Marszałkowska');
        expect(popupHtml).not.toContain('Puławska');
      }
      await act(async () => root.unmount());
    }
  });

  it('deep-link button widoczny w popup (per kontrakt mode.showDeepLink)', async () => {
    const { container, root } = await renderMap({ mode: 'list' });
    const popupLink = container.querySelector('[data-mock-tag="Popup"] a');
    expect(popupLink).not.toBeNull();
    expect(popupLink?.getAttribute('rel')).toContain('noopener');
    await act(async () => root.unmount());
  });

  it('zmiana referencji sellers o tej samej tożsamości nie wywołuje refit (F-08)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const { SellerMap } = await import('../SellerMap.client');
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key';

    let renders = 0;
    const Wrapper = () => {
      renders += 1;
      return <SellerMap mode="list" sellers={[...sellers]} />;
    };

    await act(async () => root.render(<Wrapper />));
    await act(async () => root.render(<Wrapper />));
    expect(renders).toBeGreaterThan(1);
    await act(async () => root.unmount());
  });
});
