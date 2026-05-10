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

interface MarketplaceVerificationMarkProps {
  /** Text label — required for a11y; shown in both variants */
  label: string;
  variant?: VerificationMarkVariant;
  className?: string;
}

/** Checkmark shield icon — simple inline SVG, no external dependencies. */
function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
  className,
}: MarketplaceVerificationMarkProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur',
        variant === 'compact' ? 'text-[10px]' : 'text-[11px]',
        'font-medium uppercase tracking-[0.2em] text-white/88',
        className
      )}
      data-testid="marketplace-verification-mark"
    >
      <ShieldCheckIcon className="h-3.5 w-3.5 flex-shrink-0 text-white/88" />
      {/* Text label always rendered — never icon-only per UX-CMP-1 */}
      <span>{label}</span>
    </span>
  );
}
