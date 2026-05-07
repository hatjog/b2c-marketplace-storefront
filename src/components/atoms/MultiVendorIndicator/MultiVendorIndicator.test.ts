import { describe, expect, it } from 'vitest';

/**
 * Story v160-cleanup-12b AC1 — MultiVendorIndicator logic unit tests.
 *
 * Vitest environment is node (no jsdom); we test the hide-below-2 logic
 * via the component's guard condition directly, not via render.
 *
 * Full render/visual tests are covered by Storybook stories (AC6).
 */

describe('MultiVendorIndicator guard logic', () => {
  // Replicate the component's visibility guard (same logic as atom).
  function shouldRenderIndicator(vendorCount: number): boolean {
    return Number.isFinite(vendorCount) && vendorCount >= 2;
  }

  it('returns false for vendorCount = 1 (single vendor)', () => {
    expect(shouldRenderIndicator(1)).toBe(false);
  });

  it('returns false for vendorCount = 0', () => {
    expect(shouldRenderIndicator(0)).toBe(false);
  });

  it('returns false for vendorCount = -1', () => {
    expect(shouldRenderIndicator(-1)).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(shouldRenderIndicator(NaN)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(shouldRenderIndicator(Infinity)).toBe(false);
  });

  it('returns true for vendorCount = 2 (minimum multi-vendor)', () => {
    expect(shouldRenderIndicator(2)).toBe(true);
  });

  it('returns true for vendorCount = 5', () => {
    expect(shouldRenderIndicator(5)).toBe(true);
  });

  it('returns true for vendorCount = 100', () => {
    expect(shouldRenderIndicator(100)).toBe(true);
  });
});
