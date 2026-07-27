/**
 * Story 1.4 v1.14.0 AC3 — flaga FAZY 2 w runtime config.
 *
 * Reguła nadrzędna testów: default MUSI być FAZĄ 1. Każdy stan, w którym
 * storefront „nie wie", jest stanem, w którym pokazuje pełny katalog —
 * degradacja w stronę pustego katalogu na /de /ua jest dokładnie tym, przed
 * czym broni AD-4 (ryzyko E-3).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn()
}));

const readRuntimeMarketConfig = vi.fn();

vi.mock('@/lib/runtime-market-config', () => ({
  readRuntimeMarketConfig: (...args: unknown[]) => readRuntimeMarketConfig(...args)
}));

import * as Sentry from '@sentry/nextjs';

import {
  CONTENT_GATE_SCHEMA_KEYS,
  PHASE_1_GATE_SLUG,
  contentBarGateSlug,
  narrowPhase2Locales,
  resetContentGateCacheForTests,
  resolveContentBarGateSlug
} from '@/lib/content-gate';

beforeEach(() => {
  resetContentGateCacheForTests();
  readRuntimeMarketConfig.mockReset();
  vi.mocked(Sentry.captureMessage).mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('narrowPhase2Locales — graceful, zawsze w stronę FAZY 1', () => {
  it('brak bloku ⇒ pusty zbiór (FAZA 1 dla każdego locale)', () => {
    expect(narrowPhase2Locales(undefined).size).toBe(0);
    expect(narrowPhase2Locales(null).size).toBe(0);
  });

  it('pusta lista ⇒ pusty zbiór (brak bloku i pusta lista znaczą to samo)', () => {
    expect(narrowPhase2Locales({ phase_2_locales: [] }).size).toBe(0);
  });

  it('lista locale ⇒ dokładnie te locale', () => {
    const phase2 = narrowPhase2Locales({ phase_2_locales: ['ua', 'de'] });

    expect([...phase2].sort()).toEqual(['de', 'ua']);
  });

  it.each([
    ['nie-obiekt', 'ua'],
    ['tablica', ['ua']],
    ['nieznany klucz (additionalProperties: false)', { phase_two: ['ua'] }],
    ['phase_2_locales nie-tablica', { phase_2_locales: 'ua' }],
    ['locale spoza nadzbioru platformowego', { phase_2_locales: ['fr'] }],
    ['wpis nie-string', { phase_2_locales: [42] }]
  ])('%s ⇒ degradacja do FAZY 1 + sygnał, bez rzutu', (_label, raw) => {
    expect(narrowPhase2Locales(raw).size).toBe(0);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('[content-gate]'),
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('poprawny blok NIE emituje sygnału', () => {
    narrowPhase2Locales({ phase_2_locales: ['ua'] });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('allowed-keys pokrywają dokładnie klucze schematu', () => {
    expect([...CONTENT_GATE_SCHEMA_KEYS]).toEqual(['phase_2_locales']);
  });
});

describe('contentBarGateSlug — oba tory wyboru sluga', () => {
  it('FAZA 1: locale spoza listy ⇒ pl', () => {
    const phase2 = new Set<'ua'>(['ua'] as const);

    expect(contentBarGateSlug('de', phase2 as ReadonlySet<'ua'>)).toBe('pl');
    expect(PHASE_1_GATE_SLUG).toBe('pl');
  });

  it('FAZA 2: locale z listy ⇒ ten locale', () => {
    expect(contentBarGateSlug('ua', new Set(['ua'] as const))).toBe('ua');
  });

  it('locale nieznane / puste ⇒ FAZA 1 (nigdy wyjątek na ścieżce listingu)', () => {
    const phase2 = new Set(['ua'] as const);

    expect(contentBarGateSlug('fr', phase2)).toBe('pl');
    expect(contentBarGateSlug(undefined, phase2)).toBe('pl');
    expect(contentBarGateSlug(null, phase2)).toBe('pl');
  });
});

describe('resolveContentBarGateSlug — odczyt z runtime config', () => {
  it('config bez bloku content_gate ⇒ FAZA 1 dla /ua', async () => {
    readRuntimeMarketConfig.mockResolvedValue({ market_id: 'bonbeauty' });

    await expect(resolveContentBarGateSlug('ua')).resolves.toBe('pl');
  });

  it('config z ua w phase_2_locales ⇒ FAZA 2 dla /ua, FAZA 1 dla /de', async () => {
    readRuntimeMarketConfig.mockResolvedValue({
      market_id: 'bonbeauty',
      content_gate: { phase_2_locales: ['ua'] }
    });

    await expect(resolveContentBarGateSlug('ua')).resolves.toBe('ua');
    await expect(resolveContentBarGateSlug('de')).resolves.toBe('pl');
  });

  it('brak configu ⇒ FAZA 1', async () => {
    readRuntimeMarketConfig.mockResolvedValue(null);

    await expect(resolveContentBarGateSlug('de')).resolves.toBe('pl');
  });

  it('awaria odczytu ⇒ FAZA 1 + sygnał, i NIE jest cache-owana (kolejny call ponawia)', async () => {
    readRuntimeMarketConfig.mockRejectedValueOnce(new Error('EMFILE'));

    await expect(resolveContentBarGateSlug('ua')).resolves.toBe('pl');
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('[content-gate]'),
      expect.objectContaining({ level: 'warning' })
    );

    readRuntimeMarketConfig.mockResolvedValue({ content_gate: { phase_2_locales: ['ua'] } });
    await expect(resolveContentBarGateSlug('ua')).resolves.toBe('ua');
  });

  it('cache modułowy: jeden odczyt configu na proces', async () => {
    readRuntimeMarketConfig.mockResolvedValue({ content_gate: { phase_2_locales: ['ua'] } });

    await resolveContentBarGateSlug('ua');
    await resolveContentBarGateSlug('de');
    await resolveContentBarGateSlug('en');

    expect(readRuntimeMarketConfig).toHaveBeenCalledTimes(1);
  });
});
