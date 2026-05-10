/**
 * Story v170-6-2: StorefrontStateSignal — AC3 DOM landmark primitive.
 *
 * Server-friendly atom that renders exactly one structured DOM landmark per
 * route view, consumable by Story 6.6 / Epic 8 / Epic 9 validators without
 * further DOM mutation:
 *
 *   <section
 *     data-testid="storefront-state-signal"
 *     data-route="<route-id>"
 *     data-state="<one of 10 canonical tokens>"
 *     data-state-detail="<detail-token>"
 *     data-market="<market_id>"
 *     data-freshness="current|stale|missing"
 *   >
 *
 * When the state warrants a screen-reader live-region announcement (loading,
 * unavailable, failed, access_denied) a visually-hidden status text is
 * rendered with the appropriate aria-* attributes (AC2 / NFR28).
 *
 * This component is a pass-through landmark — it does NOT implement the
 * validator gate (Story 6.6 owns that) and does NOT replace any existing
 * content component. Place it as a sibling alongside existing page content.
 *
 * Token policy (ARCH-007): all colors bind to BonBeauty CSS tokens.
 * No raw hex values.
 *
 * @see Story 6.2 AC1/AC2/AC3; UX-DR18; UX-DR19; NFR28
 */

import type {
  StorefrontFreshness,
  StorefrontStateDetailToken,
  StorefrontStateToken
} from '@/lib/helpers/storefront-state';

export interface StorefrontStateSignalProps {
  /** Canonical route identifier matching the UX state contract path_scope entry. */
  route: string;
  /** One of the 10 canonical storefront state tokens (verbatim). */
  state: StorefrontStateToken;
  /** State detail token (UX-DR19 sub-mode; null when not applicable). */
  stateDetail: StorefrontStateDetailToken | null;
  /** Non-PII market identifier (e.g. "bonbeauty-pl") or "unknown". */
  market: string;
  /** Freshness classification from the calling context. */
  freshness: StorefrontFreshness;
  /** Localized screen-reader status text for live-region states. */
  statusLabel?: string;
}

/**
 * Returns the appropriate aria-* attribute set and visually-hidden copy key
 * for states that warrant live-region announcements (AC2 / NFR28).
 *
 * - routing-load: role="status" aria-label on the landmark (skeleton context)
 * - submit-load: aria-busy="true" on the parent form (the signal records the
 *   state only; the form component owns aria-busy on its submit button)
 * - unavailable/failed/access_denied: role="status" aria-live="polite"
 */
function getLiveRegionProps(state: StorefrontStateToken): {
  role?: string;
  ariaLive?: 'polite' | 'assertive' | 'off';
  ariaAtomic?: boolean;
} {
  switch (state) {
    case 'loading':
      return { role: 'status', ariaLive: 'polite', ariaAtomic: true };
    case 'unavailable':
    case 'failed':
    case 'access_denied':
    case 'pending':
      return { role: 'status', ariaLive: 'polite', ariaAtomic: true };
    default:
      return {};
  }
}

export function StorefrontStateSignal({
  route,
  state,
  stateDetail,
  market,
  freshness,
  statusLabel
}: StorefrontStateSignalProps) {
  const liveRegion = getLiveRegionProps(state);

  return (
    <section
      data-testid="storefront-state-signal"
      data-route={route}
      data-state={state}
      data-state-detail={stateDetail ?? ''}
      data-market={market}
      data-freshness={freshness}
      role={liveRegion.role}
      aria-live={liveRegion.ariaLive}
      aria-atomic={liveRegion.ariaAtomic}
      // Visually hidden — this is a machine-readable landmark, not a visible surface.
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap'
      }}
    >
      {statusLabel && <span>{statusLabel}</span>}
    </section>
  );
}
