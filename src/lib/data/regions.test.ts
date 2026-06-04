/**
 * Story 7.9 — Regression assert: PDP locale↔region resolver fallback
 *
 * Root cause: getRegion(countryCode) fallback was `regionMap.get('us')`.
 * On gp-dev (single region: Poland → ['pl']), 'us' does not exist in
 * regionMap → undefined → fetchProductForDetailPage gets no region_id →
 * product fetch returns empty → PDP 404 for en/ua/de.
 *
 * Fix (Opcja A / C): fallback to first available region from regionMap
 * (de facto Poland on single-region backend), not hardcoded 'us'.
 *
 * Coverage:
 *   AC1: getRegion(getCountryCode(locale)) returns a region with a
 *        non-empty region_id for all 4 canonical locales (pl/en/ua/de)
 *   AC2: fallback does NOT return undefined and does NOT reference a
 *        non-existent 'us' region as the only fallback path
 *   Deterministic (C8/NFR7): pure function on regionMap, N=4 locales,
 *   non-vacuous (every locale is asserted).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// --------------------------------------------------------------------------
// Mocks — must be declared before the module under test is imported.
// --------------------------------------------------------------------------

// Stub `server-only` guard (already aliased in vitest.config.ts but some
// transitive imports may re-trigger the guard)
vi.mock('server-only', () => ({}));

// Stub next/headers cookies (server-only, not available in test env)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
}));

// Stub getCacheOptions (reads cookies, irrelevant for unit test)
vi.mock('@/lib/data/cookies', () => ({
  getCacheOptions: vi.fn().mockResolvedValue({}),
}));

// Stub medusaError helper
vi.mock('@/lib/helpers/medusa-error', () => ({
  default: vi.fn((err: unknown) => { throw err; }),
}));

// --------------------------------------------------------------------------
// The module under test — imported after mocks are set up.
// --------------------------------------------------------------------------

// We need to control `listRegions` so we can simulate a single-region backend
// (Poland → ['pl']), as on gp-dev BonBeauty.
//
// Strategy: mock the sdk.client.fetch used inside regions.ts, then import the
// module. Because getRegion uses a module-level regionMap cache we need to
// reset between test groups using vi.resetModules().

const POLAND_REGION = {
  id: 'reg_poland',
  name: 'Poland',
  currency_code: 'pln',
  countries: [{ iso_2: 'pl', display_name: 'Poland' }],
};

// We mock the entire sdk config module to control network calls.
vi.mock('@/lib/config', () => ({
  sdk: {
    client: {
      fetch: vi.fn(),
    },
  },
}));

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function setupSingleRegionBackend() {
  // Reset module registry so regionMap cache is cleared between test groups
  vi.resetModules();

  // Re-apply the sdk mock with the single-region response
  const { sdk } = await import('@/lib/config');
  vi.mocked(sdk.client.fetch).mockResolvedValue({ regions: [POLAND_REGION] } as any);

  // Re-import getRegion after module reset so it uses the fresh mock
  const { getRegion } = await import('@/lib/data/regions');
  return { getRegion };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('getRegion — single-region backend (Poland → pl)', () => {
  /**
   * AC1 + AC2 — Regression assert: all 4 canonical locales resolve to a
   * region with a non-empty region_id.
   *
   * getCountryCode maps:
   *   pl → 'pl'  (happy path — already in regionMap)
   *   en → 'gb'  (no region on gp-dev — fallback must NOT return undefined/'us')
   *   ua → 'ua'  (no region on gp-dev — fallback must NOT return undefined/'us')
   *   de → 'de'  (no region on gp-dev — fallback must NOT return undefined/'us')
   *
   * We call getRegion directly with the country code that getCountryCode
   * would produce for each locale.
   */
  it('returns a region with non-empty id for pl country code (happy path)', async () => {
    const { getRegion } = await setupSingleRegionBackend();
    const region = await getRegion('pl');
    expect(region).toBeDefined();
    expect(region?.id).toBe('reg_poland');
  });

  it('returns a region with non-empty id for gb (locale en) — fallback must not be undefined', async () => {
    const { getRegion } = await setupSingleRegionBackend();
    const region = await getRegion('gb');
    expect(region).toBeDefined();
    expect(region?.id).toBeTruthy();
    // Must resolve to the Poland region (only existing region)
    expect(region?.id).toBe('reg_poland');
  });

  it('returns a region with non-empty id for ua (locale ua) — fallback must not be undefined', async () => {
    const { getRegion } = await setupSingleRegionBackend();
    const region = await getRegion('ua');
    expect(region).toBeDefined();
    expect(region?.id).toBeTruthy();
    expect(region?.id).toBe('reg_poland');
  });

  it('returns a region with non-empty id for de (locale de) — fallback must not be undefined', async () => {
    const { getRegion } = await setupSingleRegionBackend();
    const region = await getRegion('de');
    expect(region).toBeDefined();
    expect(region?.id).toBeTruthy();
    expect(region?.id).toBe('reg_poland');
  });

  it('fallback does not resolve to a non-existent us region (AC2 — regression guard)', async () => {
    // If 'us' were in regionMap it would mean we seeded a US region on the backend,
    // which contradicts the ADR-121 PL-only invariant. This assertion verifies
    // the fallback path returns the FIRST AVAILABLE region, not hardcoded 'us'.
    // Even if somehow 'us' were in regionMap it would be wrong for PL-only backend.
    const { getRegion } = await setupSingleRegionBackend();

    // Call with a code that has no mapped region (simulates en/ua/de)
    const region = await getRegion('xx'); // 'xx' is definitely not in any backend
    expect(region).toBeDefined();
    // The fallback region must be the actual Poland region
    expect(region?.id).toBe('reg_poland');
    // Guard: the returned region must have at least one country with iso_2 'pl'
    expect(region?.countries?.some(c => c.iso_2 === 'pl')).toBe(true);
  });
});

describe('getRegion — N=4 locales coverage (deterministic, non-vacuous)', () => {
  /**
   * Single comprehensive test asserting all 4 locale→country→region paths.
   * This is the primary AC1 regression: state before fix = 200/404/404/404
   * (pl/en/ua/de); state after fix = 200/200/200/200.
   *
   * Country codes per getCountryCode (country-code.ts LOCALE_TO_COUNTRY):
   *   pl → 'pl', en → 'gb', ua → 'ua', de → 'de'
   */
  const LOCALE_TO_COUNTRY: Record<string, string> = {
    pl: 'pl',
    en: 'gb',
    ua: 'ua',
    de: 'de',
  };

  it('all 4 canonical locales (pl/en/ua/de) resolve to a non-null region with non-empty id', async () => {
    const { getRegion } = await setupSingleRegionBackend();

    const results = await Promise.all(
      Object.entries(LOCALE_TO_COUNTRY).map(async ([locale, countryCode]) => {
        const region = await getRegion(countryCode);
        return { locale, countryCode, region };
      })
    );

    for (const { locale, countryCode, region } of results) {
      expect(region, `locale=${locale} (countryCode=${countryCode}) must resolve to a region`).toBeDefined();
      expect(
        region?.id,
        `locale=${locale} (countryCode=${countryCode}) must have a non-empty region_id`
      ).toBeTruthy();
    }

    // Verify all 4 were actually tested (non-vacuous guard)
    expect(results).toHaveLength(4);
    const testedLocales = results.map(r => r.locale).sort();
    expect(testedLocales).toEqual(['de', 'en', 'pl', 'ua']);
  });
});
