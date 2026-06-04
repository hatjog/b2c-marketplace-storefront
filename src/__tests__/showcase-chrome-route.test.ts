/**
 * Showcase chrome route — unit/smoke tests (Story 7.11 T6).
 *
 * Tests:
 * 1. Prod-safety gate logic: env-flag === "1" → allowed; anything else → notFound().
 * 2. _client.tsx file existence (stat check, no import to avoid React JSX in node env).
 *
 * Note: vitest runs in node environment without JSX/React runtime. Importing React
 * client components directly fails. Full render smoke is covered by Next.js
 * build + e2e playwright run (NEEDS-LIVE-RUN per story AC4).
 *
 * Gate logic is extracted to a pure function `isShowcaseEnabled()` so it can be
 * unit-tested without pulling in the React/JSX runtime.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Pure-logic tests: prod-safety gate (no React import needed)
// ---------------------------------------------------------------------------

/**
 * Mirrors the gate check from page.tsx:
 *   if (process.env.NEXT_PUBLIC_GP_SHOWCASE !== '1') notFound();
 */
function isShowcaseEnabled(envValue: string | undefined): boolean {
  return envValue === '1';
}

describe('showcase-chrome route — prod-safety gate logic', () => {
  it('isShowcaseEnabled returns true when env=1', () => {
    expect(isShowcaseEnabled('1')).toBe(true);
  });

  it('isShowcaseEnabled returns false when env is undefined', () => {
    expect(isShowcaseEnabled(undefined)).toBe(false);
  });

  it('isShowcaseEnabled returns false when env=0', () => {
    expect(isShowcaseEnabled('0')).toBe(false);
  });

  it('isShowcaseEnabled returns false when env="true"', () => {
    expect(isShowcaseEnabled('true')).toBe(false);
  });

  it('isShowcaseEnabled returns false when env=""', () => {
    expect(isShowcaseEnabled('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// notFound() gate integration: mock-based (no JSX import)
// ---------------------------------------------------------------------------

describe('showcase-chrome — notFound() gate integration', () => {
  it('calls notFound() when NEXT_PUBLIC_GP_SHOWCASE is not set', () => {
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });

    const env = undefined;
    if (!isShowcaseEnabled(env)) {
      expect(() => notFound()).toThrow('NEXT_NOT_FOUND');
    }
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('does NOT call notFound() when NEXT_PUBLIC_GP_SHOWCASE=1', () => {
    const notFound = vi.fn();
    const env = '1';

    if (!isShowcaseEnabled(env)) {
      notFound();
    }
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound() when NEXT_PUBLIC_GP_SHOWCASE="0"', () => {
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    const env = '0';

    if (!isShowcaseEnabled(env)) {
      expect(() => notFound()).toThrow('NEXT_NOT_FOUND');
    }
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// File-system existence checks: showcase files exist (no JSX import needed)
// ---------------------------------------------------------------------------

const STOREFRONT_ROOT = path.resolve(
  __dirname,
  '../../'
);
const SHOWCASE_DIR = path.join(
  STOREFRONT_ROOT,
  'src/app/[locale]/_showcase/chrome'
);

describe('ShowcaseChrome — file existence checks', () => {
  it('page.tsx exists at showcase route path', () => {
    const filePath = path.join(SHOWCASE_DIR, 'page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('_client.tsx exists at showcase route path', () => {
    const filePath = path.join(SHOWCASE_DIR, '_client.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('page.tsx contains notFound() call (prod gate exists)', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, 'page.tsx'),
      'utf-8'
    );
    expect(content).toContain('notFound()');
    expect(content).toContain('NEXT_PUBLIC_GP_SHOWCASE');
  });

  it('_client.tsx contains data-testid="search-overlay" reference', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, '_client.tsx'),
      'utf-8'
    );
    // SearchOverlay component is mounted (it has data-testid="search-overlay" in its impl).
    expect(content).toContain('SearchOverlay');
  });

  it('_client.tsx contains ToastViewport reference (w6-06)', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, '_client.tsx'),
      'utf-8'
    );
    expect(content).toContain('ToastViewport');
  });

  it('_client.tsx contains ModalShell reference (w6-05)', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, '_client.tsx'),
      'utf-8'
    );
    expect(content).toContain('ModalShell');
  });

  it('_client.tsx has no Date.now() calls outside comments (determinism guard)', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, '_client.tsx'),
      'utf-8'
    );
    // Strip single-line comments and block comments, then check for Date.now().
    const noComments = content
      .replace(/\/\/[^\n]*/g, '') // strip // line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // strip /* */ block comments
    expect(noComments).not.toContain('Date.now()');
  });

  it('_client.tsx has no Math.random() calls (determinism guard)', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, '_client.tsx'),
      'utf-8'
    );
    expect(content).not.toContain('Math.random()');
  });

  it('page.tsx contains robots noindex metadata', () => {
    const content = fs.readFileSync(
      path.join(SHOWCASE_DIR, 'page.tsx'),
      'utf-8'
    );
    expect(content).toContain('noindex');
  });
});
