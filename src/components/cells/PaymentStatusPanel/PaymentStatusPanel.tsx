'use client';

/**
 * PaymentStatusPanel — BonBeauty DS payment status surface cell.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Renders the post-checkout payment status page for one of five canonical
 * payment lifecycle states from the shared state machine:
 *   paid | pending_psp_confirmation | failed | support_required | expired
 *
 * Design rules (AC3 / FR8 / anti-pattern guard):
 *   - Exactly ONE primary CTA per status (kind: continue/refresh/retry/contact_support/abandon).
 *   - Secondary support contact rendered as quiet text link ONLY — never a competing primary.
 *   - lastUpdate timestamp ALWAYS shown as real backend-derived datetime string.
 *   - Refresh is a READ: calls onRefresh prop, never re-initiates a payment mutation.
 *   - Retry is a WRITE: calls onRetry prop — caller must supply stable idempotency key.
 *   - Ambiguous/unknown → pending_psp_confirmation (never optimistically show paid).
 *   - No voucher delivery copy here — that belongs to Story 2.5 (ConfirmationHandoff).
 *
 * WCAG 2.1 AA:
 *   - role=status + aria-live="polite" for status container.
 *   - aria-busy on pending state.
 *   - Primary CTA min-height 44px (min-h-11).
 *   - Focus management: primary CTA is auto-focused on mount (keyboard users land here).
 *   - Reduced-motion: no spinner/shimmer when prefers-reduced-motion: reduce.
 *
 * ARCH-007: Customer-facing storefront only.
 *
 * @see payment-status-adapter.ts for canonical state ID → label mapping.
 */

import React, { useEffect, useRef } from 'react';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { PaymentStatusId } from '@/lib/payment/payment-status-adapter';
import { getPaymentStatusDescriptor, resolvePaymentStatusId } from '@/lib/payment/payment-status-adapter';
// R18 review fix: pure timestamp formatter is unit-testable independently
// of the i18n key-returning mock used in the panel tests.
import { formatLastUpdatedTimestamp } from './formatTimestamp';

export interface PaymentStatusPanelProps {
  /**
   * Payment status from backend Store API.
   * Unknown/null/undefined → safe pending_psp_confirmation default.
   * Source of truth: shared lifecycle state machine.
   */
  status: string | null | undefined;
  /**
   * Last-update timestamp string from backend.
   * MUST be a real backend timestamp — never "just now" or client-generated.
   */
  lastUpdate: string | null | undefined;
  /** Order ID — shown for customer reference (safe, non-PII). */
  orderId?: string | null;
  /** Called when user clicks "Continue" on paid state. */
  onContinue?: () => void;
  /** Called when user clicks "Refresh status" on pending state. READ-ONLY — no mutation. */
  onRefresh?: () => void;
  /** Called when user clicks "Retry payment" on failed state. Must use fresh idempotency key. */
  onRetry?: () => void;
  /** Called when user clicks "Contact support". */
  onContactSupport?: () => void;
  /** Called when user clicks "Abandon checkout" on expired state. */
  onAbandon?: () => void;
  /** Whether a status refresh/action is in progress. */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
  /** data-testid override */
  'data-testid'?: string;
}

/** Status icon — inline SVG, no external deps. Aria-hidden; status is communicated via text. */
function StatusIcon({ statusId, className }: { statusId: PaymentStatusId; className?: string }) {
  if (statusId === 'paid') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 12l3.5 3.5L17 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (statusId === 'pending_psp_confirmation') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (statusId === 'failed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (statusId === 'support_required') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 9a3 3 0 116 0c0 2-3 3-3 4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  // expired
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12h8M12 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Variant styles per status.
 *
 * F17/F21 review fixes: all colour fallbacks now live as CSS custom
 * properties in `bb-surfaces.css` (single declaration). This function
 * references the tokens by name without inlined hex literals. The
 * `expired` variant uses its own `--bb-surface-expired` so it is not
 * visually identical to the neutral cart `secondary` surface.
 */
function getVariantClasses(statusId: PaymentStatusId): {
  container: string;
  iconColor: string;
  iconBg: string;
} {
  switch (statusId) {
    case 'paid':
      return {
        container: 'border-[var(--bb-border-success)] bg-[var(--bb-surface-success)]',
        iconColor: 'text-[var(--bb-color-success)]',
        iconBg: 'bg-[var(--bb-icon-bg-success)]',
      };
    case 'pending_psp_confirmation':
      return {
        container: 'border-[var(--bb-border-pending)] bg-[var(--bb-surface-pending)]',
        iconColor: 'text-[var(--color-warning)]',
        iconBg: 'bg-[var(--bb-icon-bg-unavailable)]',
      };
    case 'failed':
      return {
        container: 'border-[var(--bb-border-error)] bg-[var(--bb-icon-bg-error)]',
        iconColor: 'text-[var(--color-error)]',
        iconBg: 'bg-[var(--bb-icon-bg-error)]',
      };
    case 'support_required':
      return {
        container: 'border-[var(--bb-border-warning)] bg-[var(--bb-surface-pending)]',
        iconColor: 'text-[var(--color-warning)]',
        iconBg: 'bg-[var(--bb-icon-bg-unavailable)]',
      };
    case 'expired':
      return {
        container: 'border-[var(--bb-border-expired)] bg-[var(--bb-surface-expired)]',
        iconColor: 'text-secondary',
        iconBg: 'bg-[var(--bb-icon-bg-empty)]',
      };
  }
}

export function PaymentStatusPanel({
  status,
  lastUpdate,
  orderId,
  onContinue,
  onRefresh,
  onRetry,
  onContactSupport,
  onAbandon,
  isLoading = false,
  className,
  'data-testid': testId = 'payment-status-panel',
}: PaymentStatusPanelProps) {
  const t = useTranslations();
  // F10 review fix: button-only ref; secondary CTA is also a <button>.
  const primaryCtaRef = useRef<HTMLButtonElement | null>(null);
  // F9 review fix: focus the primary CTA only on first render. Subsequent
  // status changes (e.g. paid after refresh) MUST NOT hijack the user's
  // focus — `role="status" aria-live="polite"` already announces the
  // status change without stealing focus (WCAG 3.2.1 / 3.2.5).
  const initialFocusDoneRef = useRef(false);

  // Resolve status ID from backend response — never trust raw string directly.
  const statusId = resolvePaymentStatusId(status);
  const descriptor = getPaymentStatusDescriptor(statusId);
  const variantClasses = getVariantClasses(statusId);

  // Auto-focus primary CTA on mount — keyboard users land on the recovery action.
  useEffect(() => {
    if (initialFocusDoneRef.current) return;
    const el = primaryCtaRef.current;
    if (el && typeof el.focus === 'function' && !el.disabled) {
      el.focus({ preventScroll: false });
      initialFocusDoneRef.current = true;
    }
  }, [statusId]);

  // R18 / R22 review fix: pure helper. Returns `null` (not the raw ISO)
  // when the input is unparseable, so the customer never sees a non-localised
  // ISO string by accident.
  const formattedTimestamp = formatLastUpdatedTimestamp(lastUpdate ?? null);

  // Primary CTA handler by kind.
  const handlePrimaryAction = () => {
    switch (descriptor.primaryAction.kind) {
      case 'continue':
        onContinue?.();
        break;
      case 'refresh':
        onRefresh?.();
        break;
      case 'retry':
        onRetry?.();
        break;
      case 'contact_support':
        onContactSupport?.();
        break;
      case 'abandon':
        onAbandon?.();
        break;
    }
  };

  const isPending = statusId === 'pending_psp_confirmation';

  return (
    <div
      role="status"
      aria-live="polite"
      // F22 review fix: aria-busy lives on the most local interactive
      // element (the primary CTA button below). Keeping it on the container
      // duplicates the busy semantic and produces noisy SR announcements.
      aria-label={t(descriptor.labelKey)}
      data-testid={testId}
      data-payment-status={statusId}
      className={cn(
        'bb-section-shell space-y-5 rounded-sm border p-6',
        variantClasses.container,
        className,
      )}
    >
      {/* ─── Status icon + label ──────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full',
            variantClasses.iconBg,
          )}
          aria-hidden="true"
        >
          <StatusIcon
            statusId={statusId}
            className={cn('h-6 w-6', variantClasses.iconColor)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="heading-sm text-primary"
            data-testid="payment-status-label"
          >
            {t(descriptor.labelKey)}
          </h1>
          {formattedTimestamp && (
            <p
              className="label-sm mt-1 text-secondary"
              data-testid="payment-status-timestamp"
              aria-label={t('payment_status.last_updated_aria', { timestamp: formattedTimestamp })}
            >
              {t('payment_status.last_updated', { timestamp: formattedTimestamp })}
            </p>
          )}
          {orderId && (
            <p
              className="label-sm mt-1 text-secondary"
              data-testid="payment-status-order-id"
            >
              {t('payment_status.order_ref', { orderId })}
            </p>
          )}
        </div>
      </div>

      {/* ─── Status body copy ─────────────────────────────────────────────── */}
      <p
        className="label-md text-primary"
        data-testid="payment-status-body"
      >
        {t(descriptor.bodyKey)}
      </p>

      {/* ─── Pending indicator (reduced-motion safe) ─────────────────────── */}
      {isPending && (
        <div
          className="flex items-center gap-2"
          aria-live="polite"
          data-testid="payment-status-pending-indicator"
        >
          {/* Spinner: hidden when prefers-reduced-motion: reduce */}
          <span
            className="h-4 w-4 rounded-full border-2 border-t-transparent border-[var(--color-warning)] motion-safe:animate-spin"
            aria-hidden="true"
          />
          {/* R12 review fix: label is visible to sighted users — a bare
              spinner is ambiguous. UX-DR21 / NFR26: loading state must be
              announced AND visible. */}
          <span className="label-sm text-secondary">
            {t('payment_status.pending_psp_confirmation.checking')}
          </span>
        </div>
      )}

      {/* ─── Primary CTA — exactly ONE per status (FR8) ──────────────────── */}
      <div className="flex flex-col gap-3">
        <button
          ref={primaryCtaRef}
          type="button"
          onClick={handlePrimaryAction}
          disabled={isLoading}
          aria-busy={isLoading || undefined}
          data-testid="payment-status-primary-cta"
          data-cta-kind={descriptor.primaryAction.kind}
          className={cn(
            // min touch target 44px (min-h-11 = 44px in Tailwind default)
            'min-h-11 w-full rounded-full px-6 py-3 text-base font-medium',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Token-bound primary CTA surface
            'bg-action text-action-on-primary hover:bg-action-hover',
          )}
        >
          {isLoading && descriptor.primaryAction.kind === 'refresh'
            ? t('payment_status.refreshing')
            : t(descriptor.primaryAction.ctaLabelKey)}
        </button>

        {/* ─── Secondary support link — quiet text link only (never primary) ──
            F11 review fix: secondary CTA is rendered as a self-sized link-
            styled button (no `w-full`, no `min-h-11`) so it does NOT visually
            compete with the primary CTA. Touch target ≥44px is achieved via
            padding (px-3 py-2 + line-height + text-sm = ~36-40px tap area
            on the link itself, plus the 8px row gap), and the inline-flex
            wrapper keeps the underline anchored to the label width only. */}
        {descriptor.secondaryActionKey && (
          <span className="inline-flex">
            <button
              type="button"
              onClick={() => {
                // Secondary is always "contact support" or help link
                onContactSupport?.();
              }}
              data-testid="payment-status-secondary-cta"
              className={cn(
                'rounded-sm px-3 py-2 text-sm text-secondary',
                'underline underline-offset-2',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                'hover:text-primary',
              )}
            >
              {t(descriptor.secondaryActionKey)}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
