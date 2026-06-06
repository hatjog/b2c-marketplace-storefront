'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import { debounce, MAP_RESIZE_DEBOUNCE_MS } from './debounce';

export interface MapResizeInvalidatorProps {
  /**
   * Debounce re-measure (ms). Domyślnie wariant produkcyjny
   * `MAP_RESIZE_DEBOUNCE_MS`; harness pomiaru p95 (ra-6) podstawia 200 vs 300.
   */
  debounceMs?: number;
}

/**
 * Story 7.5 / AC3 / ra-6 — debounce re-measure mapy.
 *
 * Leaflet nie rewaliduje wymiarów po zmianie rozmiaru kontenera; bez
 * `invalidateSize()` kafle są ucięte po resize/orientation change. Ten child
 * (montowany wewnątrz MapContainer) podpina debounce'owany re-measure na
 * `window.resize`. Wartość debounce jest re-mierzona (200 vs 300, ra-6).
 *
 * Defensywnie: brak `invalidateSize`/`window` ⇒ no-op (jsdom/test, SSR) — bez
 * surowego błędu ani console-error (FR-D.2 AC3, zero-console-error guard).
 */
export function MapResizeInvalidator({ debounceMs = MAP_RESIZE_DEBOUNCE_MS }: MapResizeInvalidatorProps) {
  const map = useMap();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    // ra-6 p95 capture instrumentation. INERT in normal operation: the harness
    // (validate_maptiler_live_evidence / measure-debounce-p95) opts in by setting
    // `window.__GP_MAP_DEBOUNCE_MS` (candidate 200|300) and an array
    // `window.__GP_MAP_REMEASURE_SAMPLES` before the map mounts. When neither is
    // present this code path is a no-op and behaviour is unchanged (prod uses the
    // `debounceMs` prop default = MAP_RESIZE_DEBOUNCE_MS).
    const harness = window as Window & {
      __GP_MAP_DEBOUNCE_MS?: number;
      __GP_MAP_REMEASURE_SAMPLES?: number[];
    };
    const effectiveDebounceMs =
      typeof harness.__GP_MAP_DEBOUNCE_MS === 'number' ? harness.__GP_MAP_DEBOUNCE_MS : debounceMs;

    let lastResizeAt = 0;
    const remeasure = debounce(() => {
      // Mapa może być już odmontowana albo mock bez invalidateSize (test/jsdom).
      if (map && typeof (map as { invalidateSize?: unknown }).invalidateSize === 'function') {
        (map as { invalidateSize: (animate?: boolean) => void }).invalidateSize(false);
      }
      // Record the re-measure latency (time from the last settling resize to the
      // debounced invalidateSize firing) only when the harness opted in.
      if (Array.isArray(harness.__GP_MAP_REMEASURE_SAMPLES) && lastResizeAt > 0) {
        harness.__GP_MAP_REMEASURE_SAMPLES.push(performance.now() - lastResizeAt);
      }
    }, effectiveDebounceMs);

    const onResize = () => {
      lastResizeAt = performance.now();
      remeasure();
    };

    window.addEventListener('resize', onResize);
    return () => {
      remeasure.cancel();
      window.removeEventListener('resize', onResize);
    };
  }, [map, debounceMs]);

  return null;
}

export default MapResizeInvalidator;
