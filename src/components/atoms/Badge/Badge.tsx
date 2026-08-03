/**
 * Badge — BonBeauty DS foundational atom.
 *
 * v1.7.0 Story 2.1: Token-bound semantic variants via BonBeauty CSS var chain.
 * All state treatments resolve through token vars from bb-surfaces.css.
 *
 * UX-PAT-4 full-state coverage: default (action), success, error, warning, unavailable.
 * Gold accents MUST NOT be the only information channel — semantic channels enforced.
 * WCAG 2.1 AA: contrast verified per bb-surfaces.css token comments.
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 */
import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'brand' | 'muted' | 'unavailable';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  'data-testid'?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  /** default — action dark (brand-900 / #1A1A1A bg, brand-25 text) */
  default: 'bg-action text-action-on-primary',
  /** success — green channel; AA 6.5:1 (--color-trust on green-50 bg) */
  success: 'bg-positive-secondary text-positive',
  /** error — red channel; AA 5.7:1 (--color-error on red-50 bg) */
  error: 'bg-negative-secondary text-negative',
  /** warning — amber channel (yellow-700 on yellow-50) */
  warning: 'bg-warning-secondary text-warning',
  /** info — blue channel (blue-700 on blue-50) */
  info: 'bg-blue-50 text-blue-800',
  /** brand — warm gold accent surface (brand-100 bg, brand-800 text)
   *  Custom style applied via variantStyles below (--gold-light token) */
  brand: '',
  /** muted — neutral surface (neutral-50 bg, neutral-700 text) */
  muted: 'bg-secondary text-primary',
  /** unavailable — visually + semantically distinct from disabled per Story 0.9
   *  contract. v1.7.0 Story 2.1 review-2 fix (HIGH/2): previously reused the
   *  `bg-disabled text-disabled opacity-60` surface — i.e. the same antipattern
   *  the prior review HIGH/3 fixed on Button. Now uses the warning channel
   *  (matching Button.unavailable + StateCard.unavailable for cross-component
   *  coherence) and a dashed border as a non-color signal so the state is
   *  perceivable beyond hue. */
  unavailable: 'bg-warning-secondary text-warning border border-dashed border-warning',
};

// Custom bg for brand variant (uses --bb-* token not in Tailwind class directly).
// v1.7.0 Story 2.1 review fix (MEDIUM): text color now sourced from --brand-800 RGB tuple
// (declared in /public/themes/bonbeauty.css) so retunes propagate. Fallback retained.
const variantStyles: Partial<Record<BadgeVariant, CSSProperties>> = {
  brand: {
    backgroundColor: 'var(--gold-light, rgba(239, 229, 210, 1))',
    color: 'rgba(var(--brand-800, 83, 65, 29), 1)',
  },
};

export function Badge({
  children,
  variant = 'default',
  className,
  'data-testid': dataTestId
}: BadgeProps) {
  return (
    <span
      className={cn(
        'label-sm inline-flex items-center justify-center rounded-xs px-2 py-1 leading-none',
        variantClasses[variant],
        className
      )}
      style={variantStyles[variant]}
      data-testid={dataTestId ?? `badge-${variant}`}
    >
      {children}
    </span>
  );
}
