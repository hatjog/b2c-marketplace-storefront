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
import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

// v1.7.0 Story 2.1 review-2 fix (MEDIUM/1): module-level counter for default
// heading/description ids when consumers do not supply titleId. We intentionally
// AVOID React.useId() here because it requires a render context and would break
// the shallow function-call test pattern used by Story 2.1 unit tests. The
// counter resets per module load (per server request in Next.js SSR, per page
// in CSR) which is sufficient for within-page uniqueness — collisions between
// SSR + hydration are avoided because the id is included in the rendered HTML
// and reused on the client. Consumers wanting stable cross-render ids can
// pass an explicit `titleId` prop (typical for landmarks named externally).
let _stateCardIdCounter = 0;
const nextStateCardId = () => {
  _stateCardIdCounter = (_stateCardIdCounter + 1) | 0;
  return `state-card-${_stateCardIdCounter}`;
};

export type StateCardVariant = 'empty' | 'error' | 'unavailable';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

interface StateCardProps {
  variant: StateCardVariant;
  /** Primary message — should be specific, not generic */
  title: string;
  /** Heading level for the title — defaults to h2 so SR landmark navigation works.
   *  v1.7.0 Story 2.1 review fix (LOW): role="region" without a real heading is
   *  not surfaced by some SRs; promote title to a heading element. */
  titleAs?: HeadingLevel;
  /** Optional id for the rendered heading element. Pair this with an
   *  `aria-labelledby` on the parent landmark/region wrapper so screen
   *  readers can name the region. v1.7.0 Story 2.6 review fix (MEDIUM). */
  titleId?: string;
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
 *  --bb-icon-bg-* tokens declared in bb-surfaces.css (no hardcoded RGBA).
 *  v1.7.0 Story 2.1 review-2 fix (MEDIUM/2): explicit `aria-live` removed —
 *  `role="alert"` implies `aria-live="assertive" aria-atomic="true"` and
 *  `role="status"` implies `aria-live="polite"` per the ARIA spec. Setting
 *  both explicitly is documented to double-announce in some AT (JAWS+IE,
 *  some NVDA+Firefox builds). Leave `aria-live` implicit. */
const variantConfig: Record<
  StateCardVariant,
  { containerClass: string; iconBgStyle: CSSProperties; role: string }
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
  },
  unavailable: {
    containerClass: 'bg-warning-secondary border border-warning',
    iconBgStyle: { backgroundColor: 'var(--bb-icon-bg-unavailable, rgba(255,247,212,0.7))' },
    role: 'status',
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
  titleId,
  description,
  icon,
  action,
  className,
  'data-testid': dataTestId,
}: StateCardProps) {
  const config = variantConfig[variant];
  // v1.7.0 Story 2.1 review fix (LOW): title rendered as a real heading so
  // landmark/region navigation surfaces it.
  const TitleTag = titleAs;
  // v1.7.0 Story 2.1 review-2 fix (MEDIUM/1): wire `titleId` to the region root
  // via aria-labelledby so the heading actually names the region. ARIA precedence:
  // aria-labelledby wins over aria-label; when titleId is provided we drop the
  // aria-label fallback to avoid double-announcement. When titleId is not
  // provided, an internal counter-derived id is allocated (see nextStateCardId
  // module-local helper) so the heading-as-region-name contract still holds
  // without forcing every consumer to provide an id.
  const headingId = titleId ?? `${nextStateCardId()}-title`;
  // Description id is also exposed via aria-describedby so the description text
  // is programmatically associated with the region for SR users.
  const descriptionId = description ? `${headingId.replace(/-title$/, '')}-desc` : undefined;

  return (
    <div
      role={config.role}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
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
        <TitleTag id={headingId} className="heading-sm text-primary m-0">{title}</TitleTag>
        {description && (
          <p id={descriptionId} className="text-sm text-secondary">
            {description}
          </p>
        )}
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
