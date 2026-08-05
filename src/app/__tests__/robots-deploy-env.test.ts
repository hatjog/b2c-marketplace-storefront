/**
 * Story 7.4 v1.15.0 AC4 — środowiskowa bramka publikacji (FR-15, AD-24, AD-19, ADR-181 §2.5).
 *
 * Przed tą story `robots.ts` miał dwie gałęzie różniące się WYŁĄCZNIE obecnością
 * `sitemap:`, obie z `allow: '/'`, i nie czytał środowiska w ogóle.
 *
 * Cztery przypadki wymagane przez AC4:
 *   prod            → allow
 *   nieprod         → disallow
 *   brak zmiennej   → disallow (fail-closed, NIE „zapewne prod")
 *   spoza dziedziny → disallow (fail-closed, NIE wartość domyślna)
 *
 * Piąty, osobny: `sitemap:` nadal zależy WYŁĄCZNIE od `NEXT_PUBLIC_BASE_URL`
 * (kontrakt Story 2.2 nietknięty) i jest ortogonalny wobec polityki indeksowania.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import robots, { isIndexingAllowed } from '../robots';

const ENV_KEYS = ['GP_DEPLOY_ENV', 'NEXT_PUBLIC_BASE_URL'] as const;

describe('robots.ts — polityka indeksowania zależy od środowiska wdrożenia', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('prod → allow', () => {
    process.env.GP_DEPLOY_ENV = 'prod';
    expect(robots().rules).toEqual([{ userAgent: '*', allow: '/' }]);
  });

  it.each(['dev', 'test', 'stage'])('nieprod (%s) → disallow', (env) => {
    process.env.GP_DEPLOY_ENV = env;
    expect(robots().rules).toEqual([{ userAgent: '*', disallow: '/' }]);
  });

  it('brak zmiennej → disallow (fail-closed, AD-19)', () => {
    expect(process.env.GP_DEPLOY_ENV).toBeUndefined();
    expect(robots().rules).toEqual([{ userAgent: '*', disallow: '/' }]);
  });

  it('wartość spoza dziedziny → disallow, nie wartość domyślna (AD-19)', () => {
    process.env.GP_DEPLOY_ENV = 'produkcja';
    expect(robots().rules).toEqual([{ userAgent: '*', disallow: '/' }]);
  });

  it('pusta zmienna → disallow', () => {
    process.env.GP_DEPLOY_ENV = '   ';
    expect(robots().rules).toEqual([{ userAgent: '*', disallow: '/' }]);
  });

  it('NODE_ENV NIE jest wyznacznikiem — sam `production` nie odblokowuje indeksowania', () => {
    // `next build` ustawia NODE_ENV=production takze dla buildow dev/test.
    expect(isIndexingAllowed(undefined)).toBe(false);
    expect(isIndexingAllowed('production')).toBe(false);
  });

  it('sitemap zalezy WYLACZNIE od NEXT_PUBLIC_BASE_URL i jest ortogonalny wobec polityki', () => {
    process.env.GP_DEPLOY_ENV = 'dev';
    expect(robots().sitemap).toBeUndefined();

    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.test/';
    const withBase = robots();
    expect(withBase.sitemap).toBe('https://example.test/sitemap.xml');
    expect(withBase.rules).toEqual([{ userAgent: '*', disallow: '/' }]);

    process.env.GP_DEPLOY_ENV = 'prod';
    const prod = robots();
    expect(prod.sitemap).toBe('https://example.test/sitemap.xml');
    expect(prod.rules).toEqual([{ userAgent: '*', allow: '/' }]);
  });
});
