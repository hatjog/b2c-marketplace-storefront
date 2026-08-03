/**
 * Debounce re-measure mapy + helper p95 (Story 7.5 / AC3 / ra-6).
 *
 * Mapa Leaflet nie rewaliduje wymiarów automatycznie po zmianie rozmiaru
 * kontenera — bez `invalidateSize()` kafle są ucięte / przesunięte po resize.
 * `MapResizeInvalidator` (zob. SellerMap) podpina debounce'owany re-measure na
 * `resize`. Wartość debounce jest re-mierzona: kandydaci 200 vs 300 ms (ra-6).
 *
 * `percentile()` to czysta, deterministyczna funkcja (C8/NFR7) wykorzystywana
 * przez harness pomiaru p95 — NIE self-compare, audytowalna.
 */

/** Wariant produkcyjny debounce re-measure. ra-6: re-mierzony 200 vs 300. */
export const MAP_RESIZE_DEBOUNCE_MS = 200;

/** Kandydaci debounce re-measure poddani pomiarowi p95 (ra-6). */
export const DEBOUNCE_CANDIDATES_MS = [200, 300] as const;

export type DebounceCandidateMs = (typeof DEBOUNCE_CANDIDATES_MS)[number];

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel: () => void;
}

/**
 * Debounce trailing-edge. Każde wywołanie resetuje licznik; `fn` odpala się raz,
 * `waitMs` po ostatnim wywołaniu. `cancel()` czyści oczekujący timer (cleanup
 * effectu Reacta). Korzysta z globalnego `setTimeout` (działa w DOM i jsdom).
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: A) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as Debounced<A>;

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

/**
 * Percentyl `p` (0..100) metodą nearest-rank na próbce latencji (ms).
 * Deterministyczny: sortuje kopię, nie mutuje wejścia, identyczny wynik dla
 * identycznej próbki (C8). Rzuca dla pustej próbki — pusta p95 = brak pomiaru,
 * NIE 0 (`skip != green`; walidator non-vacuous odrzuca pustą wartość).
 */
export function percentile(samplesMs: readonly number[], p: number): number {
  if (samplesMs.length === 0) {
    throw new Error('percentile: pusta próbka — brak pomiaru (skip != green)');
  }
  if (p < 0 || p > 100) {
    throw new Error(`percentile: p poza zakresem 0..100 (${p})`);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  // nearest-rank: rank = ceil(p/100 * N), index 1-based ⇒ 0-based rank-1.
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[index];
}

/** Skrót p95 dla próbki latencji re-measure (ra-6). */
export function p95(samplesMs: readonly number[]): number {
  return percentile(samplesMs, 95);
}
