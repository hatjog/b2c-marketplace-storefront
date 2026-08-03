// Story 7.5 / AC3 / ra-6 — debounce re-measure util + percentyl p95 (deterministyczny, C8/NFR7).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEBOUNCE_CANDIDATES_MS,
  MAP_RESIZE_DEBOUNCE_MS,
  debounce,
  p95,
  percentile
} from '../debounce';

describe('debounce util (re-measure mapy)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('odpala fn raz, trailing-edge, po waitMs od ostatniego wywołania', () => {
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel() czyści oczekujący timer (cleanup effectu)', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('przekazuje ostatnie argumenty', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(2);
  });
});

describe('percentile / p95 (pomiar re-measure, ra-6)', () => {
  it('nearest-rank deterministyczny — nie mutuje wejścia', () => {
    const samples = [50, 10, 30, 20, 40];
    const copy = [...samples];
    expect(percentile(samples, 50)).toBe(30);
    expect(samples).toEqual(copy); // brak mutacji (C8 audytowalność)
  });

  it('p95 zwraca top-tail latencji (nearest-rank)', () => {
    // 20 próbek 1..20 ⇒ rank = ceil(0.95*20)=19 ⇒ wartość 19.
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(p95(samples)).toBe(19);
  });

  it('p95 single-sample = ta sama wartość', () => {
    expect(p95([123])).toBe(123);
  });

  it('pusta próbka rzuca (skip != green — brak pomiaru, NIE 0)', () => {
    expect(() => percentile([], 95)).toThrow(/pusta próbka/);
    expect(() => p95([])).toThrow();
  });

  it('p poza zakresem rzuca', () => {
    expect(() => percentile([1, 2, 3], 150)).toThrow(/zakresem/);
    expect(() => percentile([1, 2, 3], -1)).toThrow();
  });
});

describe('stałe debounce re-measure (ra-6)', () => {
  it('wariant produkcyjny to jeden z kandydatów 200/300', () => {
    expect(DEBOUNCE_CANDIDATES_MS).toEqual([200, 300]);
    expect(DEBOUNCE_CANDIDATES_MS).toContain(MAP_RESIZE_DEBOUNCE_MS);
  });
});
