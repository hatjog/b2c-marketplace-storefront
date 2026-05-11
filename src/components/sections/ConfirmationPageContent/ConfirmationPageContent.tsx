'use client';

/**
 * ConfirmationPageContent — UX-CMP-4 ConfirmationHandoff (Story 2.5)
 *
 * Fetches order and entitlement data via browser-level API proxy routes
 * so Playwright E2E tests can intercept with page.route().
 *
 * Renders one of five UX-CMP-4 states (getConfirmationHandoffState):
 *   paid_delivered        — GiftConfirmedView / SelfPurchaseConfirmedView
 *   paid_delivery_pending — PaidDeliveryPendingView (calm, voucher-first, timestamp)
 *   payment_pending       — PurchasePendingView (existing, PSP confirmation in flight)
 *   payment_failed_retry  — PaymentFailedRetryView (renamed from PaymentErrorView)
 *   support_required      — SupportRequiredView (recovery path, no raw errors)
 *
 * PII / URL safety (AC1, AC3, NFR22):
 *   - Only order.display_id (or fallback to route id) in customer copy.
 *   - No voucher codes, claim tokens, email, PII in URLs or mailto: hrefs.
 *   - Sentry captures component stack ONLY — no order/entitlement payloads.
 *   - console logs excluded for order/entitlement data.
 *
 * HONESTY (AC2):
 *   - paid_delivery_pending ≠ failure.
 *   - support_required requires positive evidence (delivery_state or proxy).
 *   - No "success" claimed without backend entitlement evidence.
 *
 * Accessibility (NFR28 + UX-DR19):
 *   - Loading state: role="status" aria-live="polite"
 *   - Pending states: aria-live="polite" aria-busy
 *   - Each state has exactly one primary next action.
 *   - Focus rings via BonBeauty DS (focus-ring fix from Story 2.1).
 *   - Touch targets >= 44px via bb-primary-cta and padding.
 */

import React, { useEffect, useState } from 'react';

import * as Sentry from '@sentry/nextjs';
import { useLocale, useTranslations } from 'next-intl';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { VoucherQrCode } from '@/components/molecules/VoucherQrCode/VoucherQrCode';
import {
  type ConfirmationHandoffState,
  getConfirmationHandoffState,
  isSafeClaimUrl,
} from '@/lib/helpers/confirmation-state';

// ─── Sentry QR Error Boundary — component stack only, no PII ─────────────────

class QrErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // RULE: component stack only — never attach order/entitlement/voucher data
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}

// ─── Data shapes (proxy contract) ────────────────────────────────────────────

type OrderData = {
  id: string;
  display_id?: string | number | null;
  payment_status?: string;
  /** ISO timestamp from the proxy (Story 2.4 F2 fix — updated_at included). */
  updated_at?: string | null;
  /**
   * metadata is NOT included in current proxy contract (Story 2.4 F4 fix).
   * Accepted here as an optional shape so the state machine is ready when
   * an explicit evidence endpoint (Epic 7/8) exposes delivery_state.
   */
  metadata?: { delivery_state?: string; requires_support?: boolean; buyer_is_recipient?: boolean };
};

type EntitlementData = {
  status: string;
  voucher_code: string | null;
  product_name: string | null;
  salon_name: string | null;
  face_value_minor: number;
  // G9 review-2 fix: proxy passes through upstream verbatim; field may be
  // absent (undefined), not just explicitly null. Mark optional so adversarial
  // readers don't rely on `claim_url === null` as a tight discriminator.
  claim_url?: string | null;
};

type Props = {
  orderId: string;
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatVoucherCode(code: string): string {
  return code.replace(/([A-Z0-9]{4})(?=[A-Z0-9])/g, '$1 ').trim();
}

/**
 * Map next-intl locale slug → BCP-47 tag for `Intl` formatters (F3 review fix).
 * Without this, UA/DE silently fell back to `pl-PL` formatting.
 * Currency stays PLN until multi-currency lands in a separate story.
 */
function localeTag(locale: string): string {
  switch (locale) {
    case 'en':
      return 'en-GB';
    case 'ua':
      return 'uk-UA';
    case 'de':
      return 'de-DE';
    default:
      return 'pl-PL';
  }
}

function formatAmount(minor: number, locale: string): string {
  return (minor / 100).toLocaleString(localeTag(locale), {
    style: 'currency',
    currency: 'PLN',
  });
}

/** Format ISO timestamp as locale-aware short datetime, or null if invalid. */
function formatTimestamp(isoString: string | null | undefined, locale: string): string | null {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    // F7 review fix: `new Date('garbage')` does NOT throw — it returns an
    // Invalid Date whose toLocaleString() emits literal "Invalid Date".
    // Validate explicitly so malformed upstream timestamps never leak to UI.
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(localeTag(locale), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

// ─── UX-CMP-4 view components ─────────────────────────────────────────────────

/**
 * GiftConfirmedView — paid_delivered, gift path (ISSUED entitlement).
 * Shows voucher value and claim_url CTA (backend-issued, never client-derived).
 */
function GiftConfirmedView({ entitlement }: { entitlement: EntitlementData }) {
  const t = useTranslations('confirmation');
  const locale = useLocale();
  // claim_url is a backend-issued single-use link; render as CTA href only.
  // G1 review-2 fix: validate protocol allow-list (http/https) before binding
  // to `href` so a compromised upstream cannot inject a `javascript:` /
  // `data:` URI and pivot to XSS in the customer session origin.
  const claimUrl = isSafeClaimUrl(entitlement.claim_url);

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
      data-testid="gift-confirmed"
      // F5 review fix: announce delivered/accepted state once on transition
      // from paid_delivery_pending so screen readers get a clear handoff
      // (NFR28 + UX-DR9). No aria-busy here — delivery is complete.
      role="status"
      aria-live="polite"
    >
      <span className="bb-pill">BonBeauty</span>
      <h1 className="heading-xl">{t('gift_title')}</h1>
      <div className="bb-section-shell bb-section-shell-strong w-full" data-testid="voucher-card">
        {entitlement.product_name && (
          <p className="heading-sm" data-testid="product-name">
            {entitlement.product_name}
          </p>
        )}
        {entitlement.salon_name && (
          <p className="label-lg mt-2 text-secondary" data-testid="salon-name">
            {entitlement.salon_name}
          </p>
        )}
        <p
          className="mt-4 text-[32px] font-medium text-primary"
          data-testid="face-value"
        >
          {formatAmount(entitlement.face_value_minor, locale)}
        </p>
      </div>
      {claimUrl ? (
        <a
          href={claimUrl}
          className="bb-primary-cta rounded-full px-6 py-3"
          data-testid="transfer-cta"
        >
          {t('gift_cta')}
        </a>
      ) : (
        <LocalizedClientLink
          href="/categories"
          className="bb-primary-cta rounded-full px-6 py-3"
          data-testid="transfer-cta"
        >
          {t('continue_shopping')}
        </LocalizedClientLink>
      )}
    </div>
  );
}

/**
 * SelfPurchaseConfirmedView — paid_delivered, self-purchase path (ACTIVE entitlement).
 * Shows in-page voucher code + QR. Voucher code NEVER put in URL.
 */
function SelfPurchaseConfirmedView({ entitlement }: { entitlement: EntitlementData }) {
  const t = useTranslations('confirmation');
  const locale = useLocale();

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
      data-testid="self-purchase-confirmed"
      // F5 review fix: announce delivered/accepted state once on transition
      // from paid_delivery_pending (NFR28 + UX-DR9). No aria-busy.
      role="status"
      aria-live="polite"
    >
      <span className="bb-pill">BonBeauty</span>
      <h1 className="heading-xl">{t('active_title')}</h1>
      <div className="bb-section-shell bb-section-shell-strong w-full" data-testid="voucher-card">
        {entitlement.product_name && (
          <p className="heading-sm" data-testid="product-name">
            {entitlement.product_name}
          </p>
        )}
        {entitlement.salon_name && (
          <p className="label-lg mt-2 text-secondary" data-testid="salon-name">
            {entitlement.salon_name}
          </p>
        )}
        <p
          className="mt-4 text-[32px] font-medium text-primary"
          data-testid="face-value"
        >
          {formatAmount(entitlement.face_value_minor, locale)}
        </p>
      </div>
      {entitlement.voucher_code && (
        <p
          data-testid="voucher-code"
          className="rounded-full border border-[rgba(144,112,50,0.18)] px-4 py-2 font-mono text-sm"
          // F10 review fix: explicit aria-label so screen readers announce
          // "voucher code: ABCD-1234" with context, not raw character runs.
          aria-label={`${t('voucher_code_label')}: ${formatVoucherCode(entitlement.voucher_code)}`}
        >
          {formatVoucherCode(entitlement.voucher_code)}
        </p>
      )}
      {entitlement.voucher_code && (
        <QrErrorBoundary
          fallback={
            <div className="bb-card-muted text-center" data-testid="qr-code-fallback">
              <span className="text-xs text-ui-fg-subtle">{t('voucher_code_label')}</span>
              <p className="mt-2 font-mono">{formatVoucherCode(entitlement.voucher_code)}</p>
            </div>
          }
        >
          <VoucherQrCode code={entitlement.voucher_code} />
        </QrErrorBoundary>
      )}
      <LocalizedClientLink href="/categories" className="bb-primary-cta rounded-full px-6 py-3">
        {t('continue_shopping')}
      </LocalizedClientLink>
    </div>
  );
}

/**
 * PaidDeliveryPendingView — paid, entitlement evidence absent.
 * HONESTY: distinct from failure; delivery is in progress.
 * Shows timestamp + one CTA. aria-live="polite" aria-busy for screen readers.
 */
function PaidDeliveryPendingView({
  orderRef,
  lastUpdatedAt,
  lastCheckedAt,
}: {
  orderRef: string;
  lastUpdatedAt: string | null | undefined;
  /** Stable ISO timestamp captured at fetch time — never `new Date()` during
   * render (G4 review-2 fix). The label asserts "last checked at X"; render
   * cycles unrelated to a refetch must not drift the displayed time. */
  lastCheckedAt: string;
}) {
  const t = useTranslations('confirmation');
  const locale = useLocale();
  const formattedTs = formatTimestamp(lastUpdatedAt, locale);
  // F3 review fix: route through localeTag so UA/DE don't silently use pl-PL.
  // G4 review-2 fix: format the *stable* lastCheckedAt captured at fetch time,
  // so re-renders don't bump the displayed "last checked" value.
  const clientTs = formatTimestamp(lastCheckedAt, locale) ?? '';
  // Use backend timestamp if available; otherwise show client-side "last checked" label
  const timestampLabel = formattedTs
    ? t('last_updated_label', { timestamp: formattedTs })
    : t('last_checked_label', { timestamp: clientTs });

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
      data-testid="paid-delivery-pending"
      // G5 review-2 fix: keep aria-live="polite" so a state transition is
      // announced once, but drop aria-busy — no polling/refresh loop is
      // actually running, so promising an update would mute AT verbosity
      // without delivering on the promise (NFR28).
      role="status"
      aria-live="polite"
    >
      <div className="bb-section-shell bb-section-shell-strong w-full">
        <span className="bb-pill mb-4 inline-block">BonBeauty</span>
        <h1 className="heading-xl">{t('pending_delivery_title')}</h1>
        <p className="mt-3 text-secondary">{t('pending_delivery_description')}</p>
        <p className="mt-4 label-sm text-secondary" data-testid="last-updated-label">
          {timestampLabel}
        </p>
        <p className="mt-3 label-md" data-testid="order-ref">
          {t('order_ref', { orderId: orderRef })}
        </p>
      </div>
      <LocalizedClientLink
        href="/user/orders"
        className="bb-primary-cta rounded-full px-6 py-3"
        data-testid="go-to-orders-cta"
      >
        {t('go_to_orders')}
      </LocalizedClientLink>
    </div>
  );
}

/**
 * PurchasePendingView — payment_pending (PSP confirmation in flight).
 * Distinct from paid_delivery_pending: payment is not yet confirmed.
 * aria-live="polite" + elapsed-timer for screen reader friendliness.
 */
function PurchasePendingView({ orderId }: { orderId: string }) {
  const t = useTranslations('confirmation');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((e) => {
        if (e >= 60) {
          clearInterval(timer);
          return e;
        }
        return e + 3;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
      data-testid="pending-state"
      // G5 review-2 fix: drop aria-busy — the elapsed-timer toggles copy but
      // does not refetch data; aria-busy="true" without a real update cycle
      // can suppress AT announcements. role=status + aria-live=polite is the
      // correct contract for a state announcement on entry (NFR28).
      role="status"
      aria-live="polite"
    >
      <div className="bb-section-shell bb-section-shell-strong w-full">
        <h1 className="heading-xl">{t('payment_pending_title')}</h1>
        {elapsed >= 60 ? (
          <p className="mt-3 text-secondary">{t('pending_ready_soon')}</p>
        ) : (
          <p className="mt-3 text-secondary">{t('pending_safe_close')}</p>
        )}
        <p className="mt-4 label-md" data-testid="order-ref">
          {t('order_ref', { orderId })}
        </p>
      </div>
    </div>
  );
}

/**
 * PaymentFailedRetryView — payment_failed_retry (explicit payment failure/expiry).
 * Distinct from support_required: user can retry payment here.
 * No "delivery failed" copy; this is about payment, not voucher delivery.
 */
function PaymentFailedRetryView() {
  const t = useTranslations('confirmation');

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
      // F9 review fix: legacy testid kept for E2E stability — covers
      // payment_failed_retry ONLY. support_required has its own dedicated
      // testid (`support-required`); never conflate the two.
      data-testid="error-state"
      // G6 review-2 fix: announce the failure headline on state transition
      // (loading → error). Without role/aria-live the heading is only
      // available via navigation, not on entry (NFR28 + UX-DR9 parity with
      // pending/delivered).
      role="status"
      aria-live="polite"
    >
      <div className="bb-section-shell w-full">
        <h1 className="heading-xl">{t('payment_failed_title')}</h1>
        <p className="mt-3 text-secondary">{t('payment_failed_description')}</p>
      </div>
      <LocalizedClientLink
        href="/checkout"
        className="bb-primary-cta rounded-full px-6 py-3"
        data-testid="retry-cta"
      >
        {t('retry')}
      </LocalizedClientLink>
      <LocalizedClientLink
        href="/cart"
        className="label-md text-secondary underline underline-offset-4"
        data-testid="change-method-cta"
      >
        {t('change_method')}
      </LocalizedClientLink>
    </div>
  );
}

/**
 * SupportRequiredView — support_required (positive evidence of delivery issue).
 * DISTINCT from payment_failed_retry: no retry-payment CTA.
 * Primary action: recovery/account. Secondary: contact support (no PII in mailto).
 * Customer-safe copy only; no provider names, raw error codes, internal IDs.
 */
function SupportRequiredView({ orderRef }: { orderRef: string }) {
  const t = useTranslations('confirmation');

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
      data-testid="support-required"
      // G7 review-2 fix: parity with the other states — without a live region
      // the support-required heading is only available via heading-level
      // navigation. AC3 requires this state to be semantically distinct from
      // payment_failed_retry and not-found, not just visually.
      role="status"
      aria-live="polite"
    >
      <div className="bb-section-shell w-full">
        <span className="bb-pill mb-4 inline-block">BonBeauty</span>
        <h1 className="heading-xl">{t('support_required_title')}</h1>
        <p className="mt-3 text-secondary">{t('support_required_description')}</p>
        <p className="mt-3 label-md" data-testid="order-ref">
          {t('order_ref', { orderId: orderRef })}
        </p>
      </div>
      {/* Primary: account/orders recovery path (Story 2.6 magic-link baseline) */}
      <LocalizedClientLink
        href="/account/orders"
        className="bb-primary-cta rounded-full px-6 py-3"
        data-testid="recovery-cta"
      >
        {t('recovery_cta')}
      </LocalizedClientLink>
      {/* Secondary: support contact — no PII in href (AC3 + NFR22).
          G8 review-2 fix: localized navigation so the next-intl locale
          prefix is preserved and the help page renders in the customer's
          chosen language, not the default locale fallback. */}
      <LocalizedClientLink
        href="/help"
        className="label-md text-secondary underline underline-offset-4"
        data-testid="support-cta"
      >
        {t('support_required_cta')}
      </LocalizedClientLink>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ConfirmationPageContent({ orderId }: Props) {
  const t = useTranslations('confirmation');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  // G4 review-2 fix: stable client-side timestamp captured at fetch time so
  // the "last checked" label does not drift across unrelated re-renders.
  const [lastCheckedAt, setLastCheckedAt] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [orderRes, entRes] = await Promise.all([
          fetch(`/api/v1/orders/${orderId}`),
          fetch(`/api/v1/entitlements?order_id=${orderId}`),
        ]);

        if (!orderRes.ok) {
          if (!cancelled) {
            // G2 review-2 fix: clear loading alongside the error flag so the
            // state-machine invariant `loading XOR rest` holds at rest.
            setFetchError(true);
            setLoading(false);
          }
          return;
        }

        const orderData = (await orderRes.json()) as OrderData;
        const entData = entRes.ok ? ((await entRes.json()) as EntitlementData[]) : [];

        if (!cancelled) {
          setOrder(orderData);
          setEntitlements(Array.isArray(entData) ? entData : []);
          setLastCheckedAt(new Date().toISOString());
          setLoading(false);
        }
      } catch {
        // F6 review fix: emit a payload-free Sentry breadcrumb so SRE can see
        // confirmation-page reachability spikes without violating NFR22.
        // Message string only — never order id, entitlement, voucher, or any
        // PII / token data.
        try {
          Sentry.captureMessage('confirmation_fetch_failed', 'warning');
        } catch {
          // Sentry unavailable in test/SSR — never block the UI on telemetry.
        }
        if (!cancelled) {
          setFetchError(true);
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Loading state — accessible status semantics (NFR28)
  // F8 review fix: align max-width with other states to prevent full-bleed
  // text on desktop and visual jank on first paint.
  if (loading && !fetchError) {
    return (
      <div
        className="bb-section-shell mx-auto max-w-2xl text-center"
        data-testid="loading"
        role="status"
        aria-live="polite"
      >
        {t('loading')}
      </div>
    );
  }

  // Not found / fetch error
  if (fetchError || !order) {
    return (
      <div
        className="bb-section-shell mx-auto max-w-2xl text-center"
        data-testid="not-found"
      >
        <h1 className="heading-xl">{t('not_found')}</h1>
      </div>
    );
  }

  // Derive UX-CMP-4 five-state from order + entitlements (single deterministic source)
  const handoffState: ConfirmationHandoffState = getConfirmationHandoffState({
    paymentStatus: order.payment_status,
    entitlements,
    metadata: order.metadata,
  });

  const orderRef = String(order.display_id ?? orderId);

  // --- payment_failed_retry ---
  if (handoffState === 'payment_failed_retry') {
    return <PaymentFailedRetryView />;
  }

  // --- payment_pending (PSP confirmation in flight) ---
  if (handoffState === 'payment_pending') {
    return <PurchasePendingView orderId={orderRef} />;
  }

  // --- support_required (positive delivery-failure evidence) ---
  if (handoffState === 'support_required') {
    return <SupportRequiredView orderRef={orderRef} />;
  }

  // --- paid_delivery_pending (paid, entitlement evidence absent — not failure) ---
  if (handoffState === 'paid_delivery_pending') {
    return (
      <PaidDeliveryPendingView
        orderRef={orderRef}
        lastUpdatedAt={order.updated_at}
        lastCheckedAt={lastCheckedAt}
      />
    );
  }

  // --- paid_delivered — determine gift vs self-purchase from first entitlement ---
  const entitlement = entitlements[0];
  // F4 review fix: `order.metadata.buyer_is_recipient` is currently a
  // dead-input — Story 2.4 F4 stripped `metadata` from the order proxy, so
  // this defaults to `true` for every paid_delivered order today. The actual
  // gift discriminator below is `entitlement.status === 'ISSUED'`. The
  // metadata read is preserved to keep the contract ready when an Epic 7/8
  // evidence endpoint surfaces buyer_is_recipient as a live signal.
  const buyerIsRecipient = order.metadata?.buyer_is_recipient ?? true;

  // Fallback: no usable entitlement despite paid_delivered state (should not happen,
  // but defensive — show generic success rather than blank page)
  if (!entitlement) {
    return (
      <div
        className="bb-section-shell bb-section-shell-strong mx-auto max-w-2xl text-center"
        data-testid="order-confirmed-generic"
      >
        <h1 className="heading-xl">{t('generic_title')}</h1>
        <LocalizedClientLink href="/categories" className="bb-primary-cta mt-6 rounded-full px-6 py-3">
          {t('continue_shopping')}
        </LocalizedClientLink>
      </div>
    );
  }

  // Gift path: ISSUED status or buyer_is_recipient=false
  if (!buyerIsRecipient || entitlement.status === 'ISSUED') {
    return <GiftConfirmedView entitlement={entitlement} />;
  }

  // Self-purchase path: ACTIVE status + buyer_is_recipient=true
  return <SelfPurchaseConfirmedView entitlement={entitlement} />;
}
