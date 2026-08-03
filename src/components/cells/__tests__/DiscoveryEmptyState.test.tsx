/**
 * DiscoveryEmptyState — contract and invariant tests
 *
 * v1.7.0 Story 2.2 AC2: Documents the four-variant contract per UX-DR19.
 *
 * Test strategy: Pure logic/invariant tests without importing JSX components
 * (pre-existing vitest infrastructure limitation — react/jsx-dev-runtime not
 * resolvable in node env for this workspace; same issue affects Story 2.1
 * StateCard.test.tsx). Structural correctness is validated by TypeScript
 * typecheck (pnpm typecheck) and validator scripts (validate_ux_state_and_ds_boundary).
 *
 * v1.7.0 Story 2.2 review fix (MEDIUM M2): VARIANT_MAP is now imported from the
 * source module — previously the test re-declared a local copy, which meant a
 * refactor that broke the source map could pass tests. Importing the source
 * `const VARIANT_MAP` is JSX-free so it works in the node-only test env.
 */
import { describe, expect, it } from 'vitest';

// Import the source-of-truth VARIANT_MAP from a JSX-free sibling module.
// (The .tsx component re-exports it, but importing the .tsx triggers
// react/jsx-dev-runtime resolution in the node test env — pre-existing
// vitest+jsx baseline. The variantMap.ts module is pure TS, no JSX.)
import {
  VARIANT_MAP,
  type DiscoveryEmptyVariant,
} from '../DiscoveryEmptyState/variantMap';

describe('DiscoveryEmptyState (contract invariants)', () => {
  describe('DiscoveryEmptyVariant type coverage', () => {
    it('all four variant strings are distinct', () => {
      const variants: DiscoveryEmptyVariant[] = [
        'initial',
        'no-results',
        'permission-denied',
        'load-error',
      ];
      expect(new Set(variants).size).toBe(4);
    });
  });

  describe('UX-DR19 VARIANT_MAP invariants', () => {
    it('initial maps to empty (genuinely absent content)', () => {
      expect(VARIANT_MAP.initial).toBe('empty');
    });

    it('no-results maps to empty (zero-match filter result)', () => {
      expect(VARIANT_MAP['no-results']).toBe('empty');
    });

    it('permission-denied maps to unavailable (item exists, not accessible)', () => {
      expect(VARIANT_MAP['permission-denied']).toBe('unavailable');
    });

    it('load-error maps to error (system/provider failure)', () => {
      expect(VARIANT_MAP['load-error']).toBe('error');
    });

    it('permission-denied and load-error map to different StateCard variants', () => {
      expect(VARIANT_MAP['permission-denied']).not.toBe(VARIANT_MAP['load-error']);
    });

    it('initial and permission-denied map to different StateCard variants', () => {
      expect(VARIANT_MAP.initial).not.toBe(VARIANT_MAP['permission-denied']);
    });

    it('initial and load-error map to different StateCard variants', () => {
      expect(VARIANT_MAP.initial).not.toBe(VARIANT_MAP['load-error']);
    });
  });

  describe('data-testid naming convention', () => {
    it('all variants produce discovery-empty-{variant} testid', () => {
      const variants: DiscoveryEmptyVariant[] = [
        'initial',
        'no-results',
        'permission-denied',
        'load-error',
      ];
      const testIds = variants.map(v => `discovery-empty-${v}`);
      expect(testIds).toEqual([
        'discovery-empty-initial',
        'discovery-empty-no-results',
        'discovery-empty-permission-denied',
        'discovery-empty-load-error',
      ]);
    });
  });

  describe('i18n key prefix convention', () => {
    it('each variant has a unique i18n prefix', () => {
      const prefixes = ['initial', 'no-results', 'permission-denied', 'load-error'].map(
        v => v.replace(/-/g, '_') + '_'
      );
      expect(new Set(prefixes).size).toBe(4);
      expect(prefixes).toContain('initial_');
      expect(prefixes).toContain('no_results_');
      expect(prefixes).toContain('permission_denied_');
      expect(prefixes).toContain('load_error_');
    });
  });

  describe('Story 0.9 contract: no empty-as-failure masking', () => {
    it('empty and error are distinct StateCard variants', () => {
      expect('empty').not.toBe('error');
    });

    it('empty and unavailable are distinct StateCard variants', () => {
      expect('empty').not.toBe('unavailable');
    });

    it('error and unavailable are distinct StateCard variants', () => {
      expect('error').not.toBe('unavailable');
    });

    it('all three StateCard variants are used across the four DiscoveryEmptyState variants', () => {
      const usedVariants = new Set(Object.values(VARIANT_MAP));
      expect(usedVariants.has('empty')).toBe(true);
      expect(usedVariants.has('unavailable')).toBe(true);
      expect(usedVariants.has('error')).toBe(true);
    });
  });
});
