'use client';

/**
 * PaymentStatusPageContent — client section component.
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Fetches live payment/order status from the backend via browser-level proxy
 * route so that:
 *   - Playwright E2E tests can intercept with page.route().
 *   - Status is always fresh (no ISR cache — parent route is force-dynamic).
 *   - Refresh CTA triggers a re-fetch, not a re-render.
 *
 * Idempotency contract (NFR8 / NFR9):
 *   - Load and Refresh call the STATUS-READ endpoint (/api/v1/orders/[id]).
 *   - Retry CTA calls the RETRY-PAYMENT mutation with a fresh attempt key.
 *   - NO mutation on page load / back-button / second tab.
 *   - No duplicate "Order confirmed" toast on refresh.
 *
 * Anti-pattern guards (Story 2.4 spec):
 *   - Unknown backend status → pending_psp_confirmation (never optimistic paid).
 *   - No voucher delivery copy here (Story 2.5 owns ConfirmationHandoff content).
 *   - `empty` state is NEVER shown; missing order → access_denied or unavailable.
 *
 * ARCH-007: Customer-facing storefront only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { PaymentStatusPanel } from '@/components/cells/PaymentStatusPanel/PaymentStatusPanel';
import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { resolvePaymentStatusId } from '@/lib/payment/payment-status-adapter';

type OrderStatusData = {
  id: string;
  display_id?: string;
  payment_status?: string | null;
  updated_at?: string | null;
};

type Props = {
  orderId: string;
};

/**
 * Generates a stable idempotency key per retry attempt.
 * Uses a counter stored in component state — resets on page reload (NFR8 compliance).
 */
function generateAttemptKey(orderId: string, attemptNumber: number): string {
  return `retry-${orderId}-attempt-${attemptNumber}-${Date.now()}`;
}

export function PaymentStatusPageContent({ orderId }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [order, setOrder] = useState<OrderStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Track last fetch to prevent duplicate toasts on refresh
  const lastFetchedStatusRef = useRef<string | null>(null);

  const fetchOrderStatus = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(false);

      try {
        // STATUS-READ endpoint — never a mutation endpoint.
        const res = await fetch(`/api/v1/orders/${orderId}`, {
          cache: 'no-store',
          headers: { 'x-request-type': 'status-read' },
        });

        if (!res.ok) {
          setFetchError(true);
          return;
        }

        const data = (await res.json()) as OrderStatusData;

        // Store resolved status to detect duplicate "paid" on re-render
        lastFetchedStatusRef.current = resolvePaymentStatusId(data.payment_status);

        setOrder(data);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void fetchOrderStatus(false);
    // Only run on mount — orderId is stable for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    void fetchOrderStatus(true);
  }, [fetchOrderStatus]);

  const handleContinue = useCallback(() => {
    // paid → handoff to confirmation surface (Story 2.5 owns the destination).
    // No duplicate "Order confirmed" toast — just navigate.
    router.push(`/${locale}/order/${orderId}/confirmed`);
  }, [locale, orderId, router]);

  const handleRetry = useCallback(() => {
    // Retry payment — explicit user-initiated mutation with FRESH idempotency key.
    // The key changes per attempt (retryAttempt counter) so server can dedup.
    const newAttemptNumber = retryAttempt + 1;
    setRetryAttempt(newAttemptNumber);
    const idempotencyKey = generateAttemptKey(orderId, newAttemptNumber);

    // Navigate to checkout with retry signal and idempotency key.
    // Backend verifies the key to prevent duplicate charges.
    const params = new URLSearchParams({
      retry: '1',
      order_id: orderId,
      attempt_key: idempotencyKey,
    });
    router.push(`/${locale}/checkout?${params.toString()}`);
  }, [locale, orderId, retryAttempt, router]);

  const handleContactSupport = useCallback(() => {
    // Safe support handoff — no internal IDs or PII in URL.
    router.push(`/${locale}/pomoc`);
  }, [locale, router]);

  const handleAbandon = useCallback(() => {
    // expired → abandon checkout / start over.
    router.push(`/${locale}/cart`);
  }, [locale, router]);

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={t('payment_status.loading')}
        className="flex items-center justify-center py-16"
        data-testid="payment-status-loading"
      >
        <span
          className="h-8 w-8 rounded-full border-4 border-t-transparent border-[var(--color-warning,#a86d00)] motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">{t('payment_status.loading')}</span>
      </div>
    );
  }

  // ─── Error / not found state ──────────────────────────────────────────────

  if (fetchError || !order) {
    return (
      <StateCard
        variant="unavailable"
        title={t('payment_status.unavailable_title')}
        description={t('payment_status.unavailable_body')}
        data-testid="payment-status-unavailable"
        action={
          <button
            type="button"
            onClick={handleContactSupport}
            className="min-h-11 rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary"
          >
            {t('payment_status.support_required.cta')}
          </button>
        }
      />
    );
  }

  // ─── Payment status panel ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg" data-testid="payment-status-content">
      <PaymentStatusPanel
        status={order.payment_status}
        lastUpdate={order.updated_at}
        orderId={order.display_id ?? order.id}
        onContinue={handleContinue}
        onRefresh={handleRefresh}
        onRetry={handleRetry}
        onContactSupport={handleContactSupport}
        onAbandon={handleAbandon}
        isLoading={refreshing}
      />
    </div>
  );
}
