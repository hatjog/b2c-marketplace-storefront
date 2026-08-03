/**
 * Współdzielony resolver źródła kafli mapy (Story 7.5 / FR7 / ra-2).
 *
 * SSOT dla mode-aware swapu CartoDB→MapTiler (Epic-4 4-1/4-2/4-4). Story 7.5
 * NIE reimplementuje swapu — konsoliduje go w jednym module, żeby zarówno
 * `SellerMap.client.tsx` (mapa per-seller) jak i `cells/SellerMap.tsx` (mapa
 * listy z klastrowaniem) używały TEJ SAMEJ logiki zamiast divergentnego,
 * zahardkodowanego CartoDB (R1-HIGH consolidation; zob. DirectionsBlock reuse).
 *
 * Kontrakt mode-aware:
 *   - klucz MapTiler obecny  ⇒ kafle MapTiler (keyed=true), attribution
 *     MapTiler + OpenStreetMap;
 *   - brak klucza (dev/test) ⇒ CartoDB no-key voyager fallback (keyed=false),
 *     attribution OpenStreetMap + CARTO;
 *   - brak klucza w produkcji ⇒ konsument renderuje FallbackPanel
 *     (`isProdMissingMapTilerKey`), bez surowego błędu kafla.
 */

export interface TileSource {
  url: string;
  attribution: string;
  /** true ⇒ kafle MapTiler (keyed); false ⇒ CartoDB no-key fallback. */
  keyed: boolean;
}

export const MAPTILER_ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const CARTODB_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// CartoDB no-key voyager — używane WYŁĄCZNIE jako fallback bez klucza w dev/test.
// `{r}` (retina) — Leaflet podstawia `@2x` gdy `detectRetina=true`, pusty string
// gdy retina nieobsługiwane; zachowujemy `{s}` subdomenę zgodnie z istniejącym
// kontraktem SellerMap. Przywrócone w story 7.5 fix (L1 — mapa listy cells).
const CARTODB_NOKEY_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export function getMapTilerStyleId(): string {
  return process.env.NEXT_PUBLIC_MAPTILER_BONBEAUTY_STYLE_ID || 'streets-v2';
}

export function getMapTilerApiKey(): string {
  return process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';
}

/**
 * Rozwiąż źródło kafli na podstawie obecności klucza MapTiler.
 *
 * F-02/F-03 deferral note: klucz MapTiler trafia do bundle klienta (Story 4.4/4.5
 * wprowadza server-proxy + GCP SM rotation). Dla braku klucza w dev/test używamy
 * CartoDB no-key kafli, w produkcji konsument renderuje FallbackPanel.
 */
export function resolveTileSource(
  apiKey: string = getMapTilerApiKey(),
  styleId: string = getMapTilerStyleId()
): TileSource {
  if (apiKey) {
    return {
      url: `https://api.maptiler.com/maps/${styleId}/{z}/{x}/{y}.png?key=${apiKey}`,
      attribution: MAPTILER_ATTRIBUTION,
      keyed: true
    };
  }

  return {
    url: CARTODB_NOKEY_URL,
    attribution: CARTODB_ATTRIBUTION,
    keyed: false
  };
}

/**
 * true ⇒ produkcja bez klucza MapTiler. Konsument musi wtedy renderować
 * FallbackPanel (graceful), zamiast ładować kafle bez klucza (FR-D.2 AC3 —
 * brak surowego błędu na żywym tile loadingu).
 */
export function isProdMissingMapTilerKey(tile: TileSource): boolean {
  return !tile.keyed && process.env.NODE_ENV === 'production';
}
