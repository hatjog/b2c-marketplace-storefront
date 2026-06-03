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

    const remeasure = debounce(() => {
      // Mapa może być już odmontowana albo mock bez invalidateSize (test/jsdom).
      if (map && typeof (map as { invalidateSize?: unknown }).invalidateSize === 'function') {
        (map as { invalidateSize: (animate?: boolean) => void }).invalidateSize(false);
      }
    }, debounceMs);

    window.addEventListener('resize', remeasure);
    return () => {
      remeasure.cancel();
      window.removeEventListener('resize', remeasure);
    };
  }, [map, debounceMs]);

  return null;
}

export default MapResizeInvalidator;
