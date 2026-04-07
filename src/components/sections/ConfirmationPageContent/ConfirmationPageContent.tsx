'use client';

/**
 * ConfirmationPageContent — client component
 *
 * Fetches order and entitlement data via browser-level API proxy routes
 * so Playwright E2E tests can intercept with page.route().
 * Renders one of: gift confirmation (ISSUED), self-purchase (ACTIVE),
 * pending state, or error state.
 */

import React, { useEffect, useState } from 'react';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { VoucherQrCode } from '@/components/molecules/VoucherQrCode/VoucherQrCode';
import { getConfirmationState } from '@/lib/helpers/confirmation-state';

class QrErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}

type OrderData = {
  id: string;
  display_id?: string;
  payment_status?: string;
  metadata?: { buyer_is_recipient?: boolean };
};

type EntitlementData = {
  status: string;
  voucher_code: string | null;
  product_name: string | null;
  salon_name: string | null;
  face_value_minor: number;
  claim_url: string | null;
};

type Props = {
  orderId: string;
};

function formatVoucherCode(code: string): string {
  // Format 12-16 char code as groups of 4 separated by spaces
  return code.replace(/([A-Z0-9]{4})(?=[A-Z0-9])/g, '$1 ').trim();
}

function formatAmount(minor: number, locale: string): string {
  return (minor / 100).toLocaleString(locale === 'en' ? 'en-US' : 'pl-PL', {
    style: 'currency',
    currency: 'PLN'
  });
}

function GiftConfirmedView({ entitlement }: { entitlement: EntitlementData }) {
  const t = useTranslations('confirmation');
  const locale = useLocale();
  const claimUrl = entitlement.claim_url?.trim() || null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center" data-testid="gift-confirmed">
      <span className="bb-pill">BonBeauty</span>
      <h1 className="heading-xl">{t('gift_title')}</h1>
      <div className="bb-section-shell bb-section-shell-strong w-full" data-testid="voucher-card">
        {entitlement.product_name && <p className="heading-sm" data-testid="product-name">{entitlement.product_name}</p>}
        {entitlement.salon_name && <p className="label-lg mt-2 text-secondary" data-testid="salon-name">{entitlement.salon_name}</p>}
        <p className="mt-4 text-[32px] font-medium text-primary" data-testid="face-value">{formatAmount(entitlement.face_value_minor, locale)}</p>
      </div>
      {claimUrl ? (
        <a href={claimUrl} className="bb-primary-cta rounded-full px-6 py-3" data-testid="transfer-cta">
          {t('gift_cta')}
        </a>
      ) : (
        <Link href="/categories" className="bb-primary-cta rounded-full px-6 py-3" data-testid="transfer-cta">
          {t('continue_shopping')}
        </Link>
      )}
    </div>
  );
}

function SelfPurchaseConfirmedView({ entitlement }: { entitlement: EntitlementData }) {
  const t = useTranslations('confirmation');
  const locale = useLocale();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center" data-testid="self-purchase-confirmed">
      <span className="bb-pill">BonBeauty</span>
      <h1 className="heading-xl">{t('active_title')}</h1>
      <div className="bb-section-shell bb-section-shell-strong w-full" data-testid="voucher-card">
        {entitlement.product_name && <p className="heading-sm" data-testid="product-name">{entitlement.product_name}</p>}
        {entitlement.salon_name && <p className="label-lg mt-2 text-secondary" data-testid="salon-name">{entitlement.salon_name}</p>}
        <p className="mt-4 text-[32px] font-medium text-primary" data-testid="face-value">{formatAmount(entitlement.face_value_minor, locale)}</p>
      </div>
      {entitlement.voucher_code && (
        <p
          data-testid="voucher-code"
          className="rounded-full border border-[rgba(144,112,50,0.18)] px-4 py-2 font-mono text-sm"
        >
          {formatVoucherCode(entitlement.voucher_code)}
        </p>
      )}
      {entitlement.voucher_code && (
        <QrErrorBoundary
          fallback={
            <div className="bb-card-muted text-center" data-testid="qr-code-fallback">
              <span className="text-xs text-ui-fg-subtle">{t('voucher_code_label')}</span>
              <p className="mt-2 font-mono">
                {formatVoucherCode(entitlement.voucher_code)}
              </p>
            </div>
          }
        >
          <VoucherQrCode code={entitlement.voucher_code} />
        </QrErrorBoundary>
      )}
      <Link href="/categories" className="bb-primary-cta rounded-full px-6 py-3">
        {t('continue_shopping')}
      </Link>
    </div>
  );
}

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
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center" data-testid="pending-state">
      <div className="bb-section-shell bb-section-shell-strong w-full">
        <h1 className="heading-xl">{t('pending_title')}</h1>
        {elapsed >= 60 ? (
          <p className="mt-3 text-secondary">{t('pending_ready_soon')}</p>
        ) : (
          <p className="mt-3 text-secondary">{t('pending_safe_close')}</p>
        )}
        <p className="mt-4 label-md" data-testid="order-ref">{t('order_ref', { orderId })}</p>
      </div>
    </div>
  );
}

function PaymentErrorView() {
  const t = useTranslations('confirmation');

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center" data-testid="error-state">
      <div className="bb-section-shell w-full">
        <h1 className="heading-xl">{t('error_title')}</h1>
        <p className="mt-3 text-secondary">{t('error_description')}</p>
      </div>
      <Link href="/checkout" className="bb-primary-cta rounded-full px-6 py-3" data-testid="retry-cta">
        {t('retry')}
      </Link>
      <Link href="/cart" className="label-md text-secondary underline underline-offset-4" data-testid="change-method-cta">
        {t('change_method')}
      </Link>
    </div>
  );
}

export function ConfirmationPageContent({ orderId }: Props) {
  const t = useTranslations('confirmation');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [orderRes, entRes] = await Promise.all([
          fetch(`/api/v1/orders/${orderId}`),
          fetch(`/api/v1/entitlements?order_id=${orderId}`),
        ]);

        if (!orderRes.ok) {
          if (!cancelled) setFetchError(true);
          return;
        }

        const orderData = (await orderRes.json()) as OrderData;
        const entData = entRes.ok ? ((await entRes.json()) as EntitlementData[]) : [];

        if (!cancelled) {
          setOrder(orderData);
          setEntitlements(Array.isArray(entData) ? entData : []);
          setLoading(false);
        }
      } catch {
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

  if (loading && !fetchError) {
    return <div className="bb-section-shell text-center" data-testid="loading">{t('loading')}</div>;
  }

  if (fetchError || !order) {
    return (
      <div className="bb-section-shell mx-auto max-w-2xl text-center" data-testid="not-found">
        <h1 className="heading-xl">{t('not_found')}</h1>
      </div>
    );
  }

  const state = getConfirmationState(order.payment_status);

  if (state === 'error') {
    return <PaymentErrorView />;
  }

  if (state === 'pending') {
    return <PurchasePendingView orderId={order.display_id ?? orderId} />;
  }

  // SUCCESS state — determine gift vs self-purchase from first entitlement or metadata
  const entitlement = entitlements[0];
  const buyerIsRecipient = order.metadata?.buyer_is_recipient ?? true;

  if (!entitlement) {
    // No entitlement yet — show generic success
    return (
      <div className="bb-section-shell bb-section-shell-strong mx-auto max-w-2xl text-center" data-testid="order-confirmed-generic">
        <h1 className="heading-xl">{t('generic_title')}</h1>
        <Link href="/categories" className="bb-primary-cta mt-6 rounded-full px-6 py-3">
          {t('continue_shopping')}
        </Link>
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
