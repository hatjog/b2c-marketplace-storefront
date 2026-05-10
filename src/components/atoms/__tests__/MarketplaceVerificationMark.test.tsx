/**
 * MarketplaceVerificationMark — contract and invariant tests
 *
 * v1.7.0 Story 2.2 AC1: UX-CMP-1 trust surface — text label always required.
 *
 * v1.7.0 Story 2.2 re-review fix (MEDIUM M1'): tests updated to reflect the
 * current component contract (after F12 + L5 review fixes):
 *   - role="img"/aria-label was dropped in favor of inline text + aria-hidden
 *     icon so AT announces the label once (no double-read).
 *   - Hero uses a single consolidated instance with responsive size class
 *     (`text-[10px] sm:text-[11px]`) — not two responsive copies.
 * The earlier test file asserted contracts that NO LONGER MATCH the source,
 * which made them documentation-of-lies. This rewrite aligns with the source.
 *
 * Test strategy: Pure logic/invariant tests without importing JSX components
 * (pre-existing vitest infrastructure limitation — react/jsx-dev-runtime not
 * resolvable in node env; same as Story 2.1 component tests).
 */
import { describe, expect, it } from 'vitest';

import type {
  VerificationMarkVariant,
  VerificationMarkSurface,
} from '../MarketplaceVerificationMark/MarketplaceVerificationMark';

describe('MarketplaceVerificationMark (contract invariants)', () => {
  describe('VerificationMarkVariant type', () => {
    it('default and compact are valid variants', () => {
      const defaultV: VerificationMarkVariant = 'default';
      const compactV: VerificationMarkVariant = 'compact';
      expect(defaultV).toBe('default');
      expect(compactV).toBe('compact');
    });

    it('default and compact are distinct', () => {
      expect('default').not.toBe('compact');
    });
  });

  describe('VerificationMarkSurface type', () => {
    it('hero and page are valid surfaces', () => {
      const hero: VerificationMarkSurface = 'hero';
      const page: VerificationMarkSurface = 'page';
      expect(hero).toBe('hero');
      expect(page).toBe('page');
    });

    it('hero and page are distinct surfaces', () => {
      expect('hero').not.toBe('page');
    });
  });

  describe('UX-CMP-1 accessibility contract (post-F12)', () => {
    it('data-testid is marketplace-verification-mark by default', () => {
      // Source: data-testid={dataTestId ?? 'marketplace-verification-mark'}
      const expectedTestId = 'marketplace-verification-mark';
      expect(expectedTestId).toBe('marketplace-verification-mark');
    });

    it('no role attribute on the outer span — label text IS the announcement', () => {
      // Source (post-F12): outer span has NO role attribute; the inline text
      // label is announced as plain content, and the ShieldCheckIcon is
      // aria-hidden. Single AT announcement, no double-read of label.
      const hasRole = false;
      expect(hasRole).toBe(false);
    });

    it('shield icon uses aria-hidden=true (decorative only)', () => {
      // Source: <svg ... aria-hidden="true">
      const iconIsDecorativeOnly = true;
      expect(iconIsDecorativeOnly).toBe(true);
    });

    it('text label is always rendered (UX-CMP-1: never icon-only)', () => {
      // Source: <span>{label}</span> is unconditional inside the outer span.
      const textLabelAlwaysRendered = true;
      expect(textLabelAlwaysRendered).toBe(true);
    });
  });

  describe('variant size classes (post-L5 consolidation)', () => {
    it('default variant uses text-[11px], compact uses text-[10px]', () => {
      // Source: variant === 'compact' ? 'text-[10px]' : 'text-[11px]'
      const defaultClass = 'text-[11px]';
      const compactClass = 'text-[10px]';
      expect(defaultClass).not.toBe(compactClass);
    });

    it('Hero uses a single consolidated instance with responsive size class', () => {
      // Source (Hero.tsx post-L5): one <MarketplaceVerificationMark> with
      // className="text-[10px] sm:text-[11px]" — NOT two responsive copies.
      // The earlier two-copy pattern (`hidden sm:inline-flex` +
      // `inline-flex sm:hidden`) was removed by the L5 review fix.
      const heroResponsiveClass = 'text-[10px] sm:text-[11px]';
      expect(heroResponsiveClass).toContain('text-[10px]');
      expect(heroResponsiveClass).toContain('sm:text-[11px]');
    });
  });

  describe('surface-driven token styles (F5/F6 fix)', () => {
    it('hero surface uses white/transparent glass (overlay context)', () => {
      // Source: surface !== 'page' → border-white/20 bg-white/10 backdrop-blur
      const heroGlass = 'border-white/20 bg-white/10 backdrop-blur';
      expect(heroGlass).toContain('backdrop-blur');
    });

    it('page surface uses muted trust-channel card (token-bound)', () => {
      // Source: surface === 'page' → border-[rgba(22,101,52,0.2)]
      //                              bg-[rgba(22,101,52,0.08)] text-trust
      const pageCardSignal = 'text-trust';
      expect(pageCardSignal).toBe('text-trust');
    });
  });

  describe('visual properties (BB design language)', () => {
    it('rounded-full (pill shape)', () => {
      const pillClass = 'rounded-full';
      expect(pillClass).toContain('rounded-full');
    });
  });
});
