/**
 * StateCard — BonBeauty DS shared state surface molecule.
 *
 * v1.7.0 Story 2.1: Covers empty, error, and unavailable states with
 * visually and semantically distinct treatments per UX-PAT-4 + Story 0.9
 * UX state contract (no empty-as-failure masking).
 *
 * Rules per Story 0.9 / UX spec §State Surfaces:
 *   - empty:       content genuinely absent; next action = browse/discover
 *   - error:       provider/system failure; next action = retry/contact
 *   - unavailable: item exists but not accessible right now; next action = notify/back
 *
 * WCAG 2.1 AA:
 *   - Each variant has distinct color channel (not just gold)
 *   - Each variant reserves space for one clear next action (CTA slot)
 *   - Role and aria-label provided for screen readers
 *
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 * All token references via CSS vars from bb-surfaces.css + bonbeauty.css theme.
 */
import type { AriaAttributes, CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type StateCardVariant = 'empty' | 'error' | 'unavailable';

type HeadingLevel = 'h2' | 'h3' | 'h4';

interface StateCardProps {
  variant: StateCardVariant;
  /** Primary message — should be specific, not generic */
  title: string;
  /** Heading level for the title — defaults to h2 so SR landmark navigation works.
   *  v1.7.0 Story 2.1 review fix (LOW): role="region" without a real heading is
   *  not surfaced by some SRs; promote title to a heading element. */
  titleAs?: HeadingLevel;
  /** Optional supporting explanation */
  description?: string;
  /** Icon node — recommended for visual distinction beyond color */
  icon?: ReactNode;
  /** CTA slot — one clear next action per variant (required per UX-PAT-4) */
  action?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/** Visual + semantic config per variant.
 *  Color channels: empty=neutral, error=red, unavailable=amber.
 *  Gold is NOT the primary channel for any variant (UX spec §Accessibility).
 *  v1.7.0 Story 2.1 review fix (MEDIUM): icon backgrounds now sourced from
 *  --bb-icon-bg-* tokens declared in bb-surfaces.css (no hardcoded RGBA). */
const variantConfig: Record<
  StateCardVariant,
  { containerClass: string; iconBgStyle: CSSProperties; role: string; ariaLive?: AriaAttributes['aria-live'] }
> = {
  empty: {
    containerClass: 'bg-secondary border border-primary',
    iconBgStyle: { backgroundColor: 'var(--bb-icon-bg-empty, rgba(239,229,210,0.52))' },
    role: 'region',
  },
  error: {
    containerClass: 'bg-negative-secondary border border-negative',
    iconBgStyle: { backgroundColor: 'var(--bb-icon-bg-error, rgba(254,228,226,0.7))' },
    role: 'alert',
    ariaLive: 'assertive',
  },
  unavailable: {
    containerClass: 'bg-warning-secondary border border-warning',
    iconBgStyle: { backgroundColor: 'var(--bb-icon-bg-unavailable, rgba(255,247,212,0.7))' },
    role: 'status',
    ariaLive: 'polite',
  },
};

/** Default icons per variant (simple SVG — no external import dependency).
 *  Consumers can override via `icon` prop. */
function DefaultIcon({ variant }: { variant: StateCardVariant }) {
  if (variant === 'empty') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <path d="M9 9h.01M15 9h.01M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'error') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  // unavailable
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function StateCard({
  variant,
  title,
  titleAs = 'h2',
  description,
  icon,
  action,
  className,
  'data-testid': dataTestId,
}: StateCardProps) {
  const config = variantConfig[variant];
  // v1.7.0 Story 2.1 review fix (LOW): title rendered as a real heading so
  // landmark/region navigation surfaces it; aria-label retained as fallback.
  const TitleTag = titleAs;

  return (
    <div
      role={config.role}
      aria-live={config.ariaLive}
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-md p-6 text-center',
        config.containerClass,
        className
      )}
      data-testid={dataTestId ?? `state-card-${variant}`}
    >
      {/* Icon area — visually reinforces semantic channel beyond color */}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={config.iconBgStyle}
      >
        {icon ?? <DefaultIcon variant={variant} />}
      </div>

      {/* Text area */}
      <div className="flex flex-col gap-1">
        <TitleTag className="heading-sm text-primary m-0">{title}</TitleTag>
        {description && <p className="text-sm text-secondary">{description}</p>}
      </div>

      {/* CTA slot — one clear next action per UX-PAT-4 requirement */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
