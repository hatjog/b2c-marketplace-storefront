/**
 * MarketplaceVerificationMark — BonBeauty DS trust surface atom (UX-CMP-1).
 *
 * v1.7.0 Story 2.2: Renders the marketplace verification trust cue on the home hero.
 * Uses `default` variant (full text + icon) on normal viewports and `compact`
 * (icon + abbreviated label) on tight viewports.
 *
 * Requirements:
 *   - Always renders a text label (not just an icon) so the trust cue is
 *     screen-reader-readable per UX-CMP-1 spec.
 *   - No new trust badges introduced — this is the one and only instance (UX-CMP-1).
 *   - Token-bound: white/transparent surfaces on hero overlay (not BonBeauty cream tokens
 *     which are for page-level surfaces, not hero overlay).
 *
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 */

import { cn } from '@/lib/utils';

export type VerificationMarkVariant = 'default' | 'compact';

/** Surface context — drives token-bound styling without `!important` overrides.
 *  - `hero`: white/transparent overlay on hero image (default — original Story 2.2 use case).
 *  - `page`: solid muted-trust card style for page-level surfaces (PDP, etc.).
 */
export type VerificationMarkSurface = 'hero' | 'page';

interface MarketplaceVerificationMarkProps {
  /** Text label — required for a11y; shown in both variants */
  label: string;
  variant?: VerificationMarkVariant;
  /** Surface context — picks token-bound style (hero overlay vs page card). */
  surface?: VerificationMarkSurface;
  className?: string;
  /** Test id override — defaults to `marketplace-verification-mark`. */
  'data-testid'?: string;
}

/** Checkmark shield icon — simple inline SVG, no external dependencies.
 *  v1.7.0 Story 2.2 review fix (LOW L4): width/height attributes dropped;
 *  size is governed by the Tailwind class (h-3.5 w-3.5 = 14px) on the svg. */
function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 1.5L2 3.5v4c0 3.31 2.57 5.77 6 6.5 3.43-.73 6-3.19 6-6.5v-4L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M5.5 8l2 2 3-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketplaceVerificationMark({
  label,
  variant = 'default',
  surface = 'hero',
  className,
  'data-testid': dataTestId,
}: MarketplaceVerificationMarkProps) {
  // F12 fix: drop role="img"+aria-label in favour of inline text +
  // aria-hidden icon — single AT announcement, no double-read.
  // F6/F5 fix: surface-driven token-bound styles, no `!important` overrides.
  const isPage = surface === 'page';
  const iconColorClass = isPage ? 'text-trust' : 'text-white/88';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
        isPage
          // Page surface: muted trust-channel card (token-bound).
          // R3 fix: replaced hardcoded rgba() literals with --bb-trust-card-*
          // tokens from bb-surfaces.css.
          ? 'border border-[color:var(--bb-trust-card-border)] bg-[color:var(--bb-trust-card-bg)] text-trust'
          // Hero overlay surface: glass over hero image (original Story 2.2 use).
          // Tailwind opacity helpers on a neutral colour (white) are acceptable —
          // they compose against the hero image not the page palette.
          : 'border border-white/20 bg-white/10 text-white/88 backdrop-blur',
        variant === 'compact' ? 'text-[10px]' : 'text-[11px]',
        'font-medium uppercase tracking-[0.2em]',
        className
      )}
      data-testid={dataTestId ?? 'marketplace-verification-mark'}
    >
      <ShieldCheckIcon className={cn('h-3.5 w-3.5 flex-shrink-0', iconColorClass)} />
      {/* Text label always rendered — never icon-only per UX-CMP-1 */}
      <span>{label}</span>
    </span>
  );
}
