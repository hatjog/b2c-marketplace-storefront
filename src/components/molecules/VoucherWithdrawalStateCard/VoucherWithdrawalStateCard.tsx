/**
 * Story v170-2-9: VoucherWithdrawalStateCard
 *
 * Server Component that surfaces one of the five FR64 consumer-purchase
 * withdrawal lifecycle states with BonBeauty styling and an ARIA-accessible
 * layout.
 *
 * It ALSO renders the Epic 7 DOM signal landmark:
 *   <section
 *     data-testid="voucher-withdrawal-state-signal"
 *     data-state="<fr64-state>"
 *     data-market="<market_id>"
 *     data-freshness="<current|stale|missing>"
 *   >
 *
 * This component is a **read-side surface only** — it does not mutate state.
 * It accepts the FR64 state as a prop from the parent Server Component (which
 * calls `getWithdrawalState()` and passes the result down).
 *
 * IMPORTANT — lifecycle boundary:
 *   This component covers consumer-purchase withdrawal (FR64) ONLY.
 *   Recipient-PII consent (RODO Art. 7/17) is handled by
 *   `RecipientPausePathToggle` / `VoucherIdleClaimSection` / `VoucherAuditTrail`.
 *   Do NOT conflate the two lifecycles in copy or DOM signals.
 *
 * Token policy (review fix H1): all colors bind to existing storefront tokens
 *   declared in `src/styles/tokens/bb-surfaces.css`. No invented `--bb-*` names.
 *
 * @see FR64 (prd.md line 933); Story 2.9 AC1/AC3
 */

import { getTranslations } from 'next-intl/server';
import type { WithdrawalStateResult } from '@/types/voucher';

export interface VoucherWithdrawalStateCardProps {
  /** FR64 state result from `getWithdrawalState()`. */
  withdrawalResult: WithdrawalStateResult;
  /**
   * When true, a release-critical CTA is present on this surface and the
   * component visually communicates the blocked state.
   * Defaults to false (informational surface only).
   */
  ctaBlocked?: boolean;
}

/**
 * Maps an FR64 state token to BonBeauty token-bound visual hints.
 * Variants reuse storefront semantic colors (--color-error, --color-warning,
 * --color-trust, --accent, --text-secondary) and BonBeauty surfaces
 * (--bb-surface, --bb-surface-muted, --bb-icon-bg-*). No invented tokens.
 */
function getVariantStyles(state: WithdrawalStateResult['state']): {
  borderColor: string;
  background: string;
  iconColor: string;
  iconChar: string;
  badgeColor: string;
  badgeBackground: string;
} {
  switch (state) {
    case 'withdrawal-eligible-before-service-execution':
      return {
        borderColor: 'var(--bb-border-soft)',
        background: 'var(--bb-surface)',
        iconColor: 'var(--text-secondary)',
        iconChar: '○',
        badgeColor: 'var(--text-secondary)',
        badgeBackground: 'var(--bb-surface-muted)',
      };
    case 'consent-to-execute-captured':
      return {
        borderColor: 'var(--accent)',
        background: 'var(--bb-surface-strong)',
        iconColor: 'var(--accent)',
        iconChar: '◎',
        badgeColor: 'var(--text-secondary)',
        badgeBackground: 'var(--bb-skeleton-base)',
      };
    case 'withdrawal-blocked-after-execution':
      return {
        borderColor: 'var(--color-warning)',
        background: 'var(--bb-icon-bg-unavailable)',
        iconColor: 'var(--color-warning)',
        iconChar: '●',
        badgeColor: 'var(--color-warning)',
        badgeBackground: 'var(--bb-icon-bg-unavailable)',
      };
    case 'refunded':
      return {
        borderColor: 'var(--color-trust)',
        background: 'var(--bb-surface)',
        iconColor: 'var(--color-trust)',
        iconChar: '✓',
        badgeColor: 'var(--color-trust)',
        badgeBackground: 'var(--bb-surface)',
      };
    case 'support-review':
      return {
        borderColor: 'var(--color-error)',
        background: 'var(--bb-icon-bg-error)',
        iconColor: 'var(--color-error)',
        iconChar: '!',
        badgeColor: 'var(--color-error)',
        badgeBackground: 'var(--bb-icon-bg-error)',
      };
  }
}

export async function VoucherWithdrawalStateCard({
  withdrawalResult,
  ctaBlocked = false,
}: VoucherWithdrawalStateCardProps) {
  const t = await getTranslations('voucher_withdrawal');
  const { state, market_id, freshness, action_blocked } = withdrawalResult;

  // Map state token to snake_case i18n key prefix
  const stateKeyMap = {
    'withdrawal-eligible-before-service-execution': 'state_withdrawal_eligible_before_service_execution',
    'consent-to-execute-captured': 'state_consent_to_execute_captured',
    'withdrawal-blocked-after-execution': 'state_withdrawal_blocked_after_execution',
    'refunded': 'state_refunded',
    'support-review': 'state_support_review',
  } as const;

  const keyPrefix = stateKeyMap[state];
  const label = t(`${keyPrefix}.label`);
  const description = t(`${keyPrefix}.description`);
  const nextAction = t(`${keyPrefix}.next_action`);
  const blockedLabel = t('cta_blocked_label');
  const isBlocked = ctaBlocked || action_blocked;
  const variant = getVariantStyles(state);

  return (
    <section
      aria-label={label}
      data-testid="voucher-withdrawal-state-signal"
      data-state={state}
      data-market={market_id}
      data-freshness={freshness}
    >
      <div
        className="bb-section-shell rounded-md border px-4 py-4"
        style={{
          borderColor: variant.borderColor,
          background: variant.background,
        }}
        // Second-pass review fix L3: when CTA is blocked, the inner role="alert"
        // owns the announcement (assertive). Drop the outer role="status"
        // (polite) so screen readers do not double-announce. When NOT blocked,
        // keep role="status" for informational state surfaces.
        {...(isBlocked
          ? {}
          : { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })}
      >
        {/* Badge row */}
        <div className="mb-2 flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: variant.badgeBackground, color: variant.iconColor }}
            aria-hidden="true"
          >
            {variant.iconChar}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold"
            style={{ background: variant.badgeBackground, color: variant.badgeColor }}
            data-testid={`withdrawal-state-badge-${state}`}
          >
            {label}
          </span>
        </div>

        {/* Description */}
        <p
          className="mb-2 text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}
        >
          {description}
        </p>

        {/* Next action (UX-DR18: exactly one recommended next action).
            Review fix M1: hidden when CTA is blocked so the alert below
            holds the SOLE next-action surface — no double-rendering. */}
        {!isBlocked && (
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
            data-testid="withdrawal-next-action"
          >
            {nextAction}
          </p>
        )}

        {/* Blocked CTA indicator for release-critical surfaces (AC3).
            Review fix L1: rely on role="alert" implicit aria-live="assertive";
            no explicit duplicate aria-live attribute. */}
        {isBlocked && (
          <div
            className="mt-3 rounded border px-3 py-2 text-xs"
            role="alert"
            data-testid="withdrawal-cta-blocked-indicator"
            style={{
              color: 'var(--color-error)',
              borderColor: 'var(--color-error)',
              background: 'var(--bb-icon-bg-error)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
              {blockedLabel}
            </strong>
            <span data-testid="withdrawal-next-action">{nextAction}</span>
          </div>
        )}
      </div>
    </section>
  );
}
