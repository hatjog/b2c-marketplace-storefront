/**
 * v1.16.0 Story 6.9 (AD-51, K1, D-2): the single state projection for the
 * recipient page `/[locale]/voucher/[code]`.
 *
 * Both `page.tsx` (`data-state`) and `VoucherRecipientView` read the state
 * from `projectVoucherRecipientPage`; there are no local fallbacks such as
 * `?? 'expired'`. The projection is a pure function of the lookup result and
 * the requested link, so replaying the same response yields the same state and
 * the same canonical link.
 *
 * Known limitation signed by the PO (D-2, decisions-2026-11-14.md): a gift
 * bought through the captured-path shows an active, redeemable state before
 * delivery; parity of both webhook routes → v1.17.0 (DW-15-271). The page
 * reads the CURRENT entitlement layer (K1); ADR-219 §2 mapping is out of scope.
 */
import type { VoucherRecipientResult, VoucherRecipientView } from './voucher';

export const VOUCHER_RECIPIENT_PAGE_STATES = [
  'loading',
  'active',
  'pending',
  'redeemed',
  'expired',
  'voided',
  'forbidden',
  'not_found',
  'technical_error',
] as const;

export type VoucherRecipientPageState = (typeof VOUCHER_RECIPIENT_PAGE_STATES)[number];

export type VoucherRecipientNextAction =
  | 'use_code'
  | 'check_again'
  | 'explore_salons'
  | 'contact_support'
  | 'check_link'
  | 'retry'
  | 'wait';

/**
 * Entitlement screens with established copy render from their own namespace
 * (`active.*`, `redeemed.*`, `expired.*`); the rest from `states.<state>.*`.
 */
type EstablishedScreenState = 'active' | 'redeemed' | 'expired';

export type VoucherRecipientMessageKey =
  | EstablishedScreenState
  | `states.${Exclude<VoucherRecipientPageState, EstablishedScreenState>}`;

export interface VoucherRecipientPageProjection {
  state: VoucherRecipientPageState;
  /**
   * i18n namespace under `voucher.recipient` whose `heading` the screen
   * actually renders — unique per state (fix R-5: no dead `states.*` keys).
   */
  messageKey: VoucherRecipientMessageKey;
  nextAction: VoucherRecipientNextAction;
  /** Target of the next action; `null` only for `loading`. */
  nextActionHref: string | null;
  /** Canonical link of this voucher page (stable across replays). */
  canonicalHref: string;
  /** HTTP status of the lookup, preserved for diagnostics (no body, no PII). */
  transportStatus: number | null;
  /** Allowlisted view; present only for entitlement states. */
  view: VoucherRecipientView | null;
}

const NEXT_ACTION: Record<VoucherRecipientPageState, VoucherRecipientNextAction> = {
  loading: 'wait',
  active: 'use_code',
  pending: 'check_again',
  redeemed: 'explore_salons',
  expired: 'contact_support',
  voided: 'contact_support',
  // Fix R-6: the route is public (`AUTHENTICATE = false`); 401/403 can only
  // come from infrastructure / the publishable-key layer, so signing in would
  // not change the result. Point to support instead.
  forbidden: 'contact_support',
  not_found: 'check_link',
  technical_error: 'retry',
};

export function buildVoucherRecipientCanonicalHref(locale: string, code: string): string {
  return `/${encodeURIComponent(locale)}/voucher/${encodeURIComponent(code.trim())}`;
}

function nextActionHref(
  action: VoucherRecipientNextAction,
  locale: string,
  canonicalHref: string
): string | null {
  switch (action) {
    case 'wait':
      return null;
    case 'use_code':
      return `${canonicalHref}#voucher-code`;
    case 'check_again':
    case 'retry':
      return canonicalHref;
    case 'explore_salons':
      return `/${locale}/sellers`;
    case 'contact_support':
    case 'check_link':
      return `/${locale}/pomoc`;
  }
}

function messageKeyFor(state: VoucherRecipientPageState): VoucherRecipientMessageKey {
  switch (state) {
    case 'active':
    case 'redeemed':
    case 'expired':
      return state;
    default:
      return `states.${state}`;
  }
}

function stateFor(result: VoucherRecipientResult | null): VoucherRecipientPageState {
  if (result === null) return 'loading';
  switch (result.kind) {
    case 'ok':
      return result.view.state === 'already_redeemed' ? 'redeemed' : result.view.state;
    case 'forbidden':
    case 'not_found':
    case 'technical_error':
      return result.kind;
  }
}

/**
 * Project a lookup result (or `null` while loading) into the page state.
 */
export function projectVoucherRecipientPage(
  result: VoucherRecipientResult | null,
  link: { locale: string; code: string }
): VoucherRecipientPageProjection {
  const state = stateFor(result);
  const canonicalHref = buildVoucherRecipientCanonicalHref(link.locale, link.code);
  const nextAction = NEXT_ACTION[state];

  return {
    state,
    messageKey: messageKeyFor(state),
    nextAction,
    nextActionHref: nextActionHref(nextAction, link.locale, canonicalHref),
    canonicalHref,
    transportStatus: result?.status ?? null,
    view: result?.kind === 'ok' ? result.view : null,
  };
}
