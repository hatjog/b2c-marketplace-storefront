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
 * Maps an FR64 state token to the BonBeauty token-based visual variant.
 * Variants: "eligible" (neutral), "consent" (info), "blocked" (warning),
 * "refunded" (success), "support" (error — requires attention).
 */
function getVariantClasses(state: WithdrawalStateResult['state']): {
  shell: string;
  icon: string;
  badge: string;
} {
  switch (state) {
    case 'withdrawal-eligible-before-service-execution':
      return {
        shell: 'border-[color:var(--bb-border,#D9D7D3)] bg-[color:var(--bb-surface-subtle,rgba(255,252,247,0.8))]',
        icon: '○',
        badge: 'bg-[color:var(--bb-info-subtle,#E8F4FD)] text-[color:var(--bb-info,#1A6FA3)]',
      };
    case 'consent-to-execute-captured':
      return {
        shell: 'border-[color:var(--bb-accent,#B8A99A)] bg-[color:var(--bb-surface-warm,rgba(248,244,238,0.9))]',
        icon: '◎',
        badge: 'bg-[color:var(--bb-accent-subtle,#F5EFE8)] text-[color:var(--bb-text-secondary,#7A7672)]',
      };
    case 'withdrawal-blocked-after-execution':
      return {
        shell: 'border-[color:var(--bb-warn,#C4933F)] bg-[color:var(--bb-warn-subtle,#FDF6E8)]',
        icon: '●',
        badge: 'bg-[color:var(--bb-warn-subtle,#FDF6E8)] text-[color:var(--bb-warn,#C4933F)]',
      };
    case 'refunded':
      return {
        shell: 'border-[color:var(--bb-success,#3F8B5A)] bg-[color:var(--bb-success-subtle,#EDF7F1)]',
        icon: '✓',
        badge: 'bg-[color:var(--bb-success-subtle,#EDF7F1)] text-[color:var(--bb-success,#3F8B5A)]',
      };
    case 'support-review':
      return {
        shell: 'border-[color:var(--bb-error,#C4453F)] bg-[color:var(--bb-error-subtle,#FEF0EF)]',
        icon: '!',
        badge: 'bg-[color:var(--bb-error-subtle,#FEF0EF)] text-[color:var(--bb-error,#C4453F)]',
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
  const isBlocked = ctaBlocked || action_blocked;
  const variant = getVariantClasses(state);

  return (
    <section
      aria-label={label}
      data-testid="voucher-withdrawal-state-signal"
      data-state={state}
      data-market={market_id}
      data-freshness={freshness}
    >
      <div
        className={`bb-section-shell rounded-md border px-4 py-4 ${variant.shell}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Badge row */}
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${variant.badge}`}
            aria-hidden="true"
          >
            {variant.icon}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${variant.badge}`}
            data-testid={`withdrawal-state-badge-${state}`}
          >
            {label}
          </span>
        </div>

        {/* Description */}
        <p
          className="mb-2 text-sm leading-relaxed"
          style={{ color: 'var(--bb-text-secondary, #7A7672)', fontFamily: 'Inter, sans-serif' }}
        >
          {description}
        </p>

        {/* Next action (UX-DR18: one recommended next action) */}
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--bb-text-primary, #1A1A1A)', fontFamily: 'Inter, sans-serif' }}
          data-testid="withdrawal-next-action"
        >
          {nextAction}
        </p>

        {/* Blocked CTA indicator for release-critical surfaces (AC3) */}
        {isBlocked && (
          <div
            className="mt-3 rounded border border-current px-3 py-2 text-xs"
            role="alert"
            aria-live="assertive"
            data-testid="withdrawal-cta-blocked-indicator"
            style={{ color: 'var(--bb-error, #C4453F)', borderColor: 'var(--bb-error, #C4453F)', background: 'var(--bb-error-subtle, #FEF0EF)' }}
          >
            {nextAction}
          </div>
        )}
      </div>
    </section>
  );
}
