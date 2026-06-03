// @vitest-environment jsdom
// Story 7.5 / AC1 / FR7 / FR-D.2 AC3 — zero-console-error guard (część statyczna).
//
// Asercja: ścieżka renderu SellerMap (mode-aware MapTiler / CartoDB no-key
// fallback / prod-missing-key FallbackPanel) ORAZ error-path tile loadingu
// (tileerror ⇒ graceful FallbackPanel) NIE emitują nieobsłużonego
// console.error / console.warn. Brak surowego błędu przy niedostępnym tile.
//
// `NEEDS-LIVE-RUN`: faktyczny live render bez console-error (real MapTiler tile
// loading w przeglądarce na żywym stacku) domyka ra-1 live-capture (FR6, 7.6) —
// NIE fabrykować evidence „captured". Ten test pokrywa część statyczną.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// Przechwyć eventHandlers i attribution TileLayer dla assertów error-path i attribution.
declare global {
  // eslint-disable-next-line no-var
  var __lastTileEventHandlers: Record<string, (...a: unknown[]) => void> | undefined;
  // eslint-disable-next-line no-var
  var __lastTileAttribution: string | undefined;
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

vi.mock('react-leaflet', () => {
  return {
    MapContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-mock-tag="MapContainer">{children}</div>
    ),
    TileLayer: (rest: Record<string, unknown>) => {
      globalThis.__lastTileEventHandlers = rest.eventHandlers as
        | Record<string, (...a: unknown[]) => void>
        | undefined;
      globalThis.__lastTileAttribution = rest.attribution as string | undefined;
      return <div data-mock-tag="TileLayer" data-attribution={rest.attribution as string} />;
    },
    Marker: ({ children }: { children?: React.ReactNode }) => (
      <div data-mock-tag="Marker">{children}</div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => (
      <div data-mock-tag="Popup">{children}</div>
    ),
    // useMap MUSI udostępniać invalidateSize — MapResizeInvalidator nie może
    // rzucić ani logować przy braku metody (defensywny re-measure).
    useMap: () => ({
      getContainer: () => ({ querySelectorAll: () => [] }),
      getZoom: () => 12,
      setView: () => undefined,
      fitBounds: () => undefined,
      invalidateSize: () => undefined,
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

const sellers = [
  { id: 'a', name: 'Salon A', lat: 52.23, lng: 21.01, neighborhood: 'Centrum', addressLine: 'ul. Marszałkowska 1' },
  { id: 'b', name: 'Salon B', lat: 52.24, lng: 21.02, neighborhood: 'Mokotów', addressLine: 'ul. Puławska 5' },
];

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

async function mount(render: (Comp: typeof import('../SellerMap.client').SellerMap) => React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const { SellerMap } = await import('../SellerMap.client');
  await act(async () => {
    root.render(render(SellerMap));
  });
  return { container, root };
}

describe('SellerMap zero-console-error guard (AC1, FR-D.2 AC3)', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.__lastTileEventHandlers = undefined;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    globalThis.__lastTileAttribution = undefined;
    // Przywróć NODE_ENV/env po wariancie prod (NODE_ENV bywa non-configurable).
    vi.unstubAllEnvs();
  });

  it('render path MapTiler (keyed) nie emituje console.error/warn — wszystkie tryby', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key';
    for (const mode of ['list', 'detail', 'mini', 'landing'] as const) {
      const { root } = await mount(Comp => <Comp mode={mode} sellers={sellers} />);
      await act(async () => root.unmount());
    }
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('render path CartoDB no-key fallback (dev/test bez klucza) nie emituje console.error/warn', async () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const { container, root } = await mount(Comp => <Comp mode="list" sellers={sellers} />);
    // Bez klucza w test ⇒ render mapy (CartoDB), NIE FallbackPanel.
    expect(container.querySelector('[data-testid="seller-map"]')).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('error-path tile loadingu (tileerror) ⇒ graceful FallbackPanel, bez surowego błędu/console', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key';
    const { container, root } = await mount(Comp => <Comp mode="list" sellers={sellers} />);
    expect(globalThis.__lastTileEventHandlers?.tileerror).toBeTypeOf('function');
    // Symuluj niedostępny kafel — handler ustawia tileFailed ⇒ FallbackPanel.
    await act(async () => {
      globalThis.__lastTileEventHandlers?.tileerror?.();
    });
    expect(container.querySelector('[data-testid="seller-map-fallback"]')).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('prod bez klucza ⇒ FallbackPanel (graceful), bez console.error/warn', async () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    vi.stubEnv('NODE_ENV', 'production');
    const { container, root } = await mount(Comp => <Comp mode="detail" sellers={sellers} />);
    expect(container.querySelector('[data-testid="seller-map-fallback"]')).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('attribution MapTiler + OpenStreetMap obecne na ścieżce keyed (FR-D.2 AC3)', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key';
    const { container, root } = await mount(Comp => <Comp mode="list" sellers={sellers} />);
    // Guard data-attr (wskaźnik keyed tile source na SellerMap.client).
    const shell = container.querySelector('[data-testid="seller-map"]');
    expect(shell?.getAttribute('data-map-tile-source')).toBe('maptiler');
    // (L2 fix) Sprawdź faktyczną wartość attribution przekazaną do TileLayer —
    // gwarantuje, że tekst "MapTiler" i "OpenStreetMap" jest w props, nie tylko
    // że data-attr jest ustawiony.
    expect(globalThis.__lastTileAttribution).toBeDefined();
    expect(globalThis.__lastTileAttribution).toContain('MapTiler');
    expect(globalThis.__lastTileAttribution).toContain('OpenStreetMap');
    await act(async () => root.unmount());
  });
});
