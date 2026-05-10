/**
 * DiscoveryEmptyState VARIANT_MAP — source of truth for the 4-class → 3-variant
 * mapping from BonBeauty discovery empty/error states onto StateCard variants.
 *
 * v1.7.0 Story 2.2 review fix (MEDIUM M2): extracted to a JSX-free module so
 * contract tests can import the live `VARIANT_MAP` (vitest cannot import the
 * .tsx source in this workspace's node env — see test file header for rationale).
 *
 * UX-DR19 mapping:
 *   - initial            → empty       (genuinely no data yet)
 *   - no-results         → empty       (filters applied, zero match — empty result state)
 *   - permission-denied  → unavailable (item exists, not accessible)
 *   - load-error         → error       (provider/system failure)
 */
export type DiscoveryEmptyVariant =
  | 'initial'
  | 'no-results'
  | 'permission-denied'
  | 'load-error';

export type StateCardChannel = 'empty' | 'unavailable' | 'error';

export const VARIANT_MAP: Record<DiscoveryEmptyVariant, StateCardChannel> = {
  initial: 'empty',
  'no-results': 'empty',
  'permission-denied': 'unavailable',
  'load-error': 'error',
};
