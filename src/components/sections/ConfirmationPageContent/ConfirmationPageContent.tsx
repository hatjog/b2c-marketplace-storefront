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

import { getConfirmationState } from '@/lib/helpers/confirmation-state';

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

function formatAmount(minor: number): string {
  return (minor / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
}

function GiftConfirmedView({ entitlement }: { entitlement: EntitlementData }) {
  return (
    <div data-testid="gift-confirmed">
      <h1>Twój voucher jest gotowy!</h1>
      <div data-testid="voucher-card">
        {entitlement.product_name && <p data-testid="product-name">{entitlement.product_name}</p>}
        {entitlement.salon_name && <p data-testid="salon-name">{entitlement.salon_name}</p>}
        <p data-testid="face-value">{formatAmount(entitlement.face_value_minor)}</p>
      </div>
      <a
        href={entitlement.claim_url ?? '#'}
        data-testid="transfer-cta"
      >
        Przekaż voucher
      </a>
    </div>
  );
}

function SelfPurchaseConfirmedView({ entitlement }: { entitlement: EntitlementData }) {
  return (
    <div data-testid="self-purchase-confirmed">
      <h1>Voucher aktywny!</h1>
      <div data-testid="voucher-card">
        {entitlement.product_name && <p data-testid="product-name">{entitlement.product_name}</p>}
        {entitlement.salon_name && <p data-testid="salon-name">{entitlement.salon_name}</p>}
        <p data-testid="face-value">{formatAmount(entitlement.face_value_minor)}</p>
      </div>
      {entitlement.voucher_code && (
        <p
          data-testid="voucher-code"
          style={{ fontFamily: 'monospace' }}
        >
          {formatVoucherCode(entitlement.voucher_code)}
        </p>
      )}
      <div data-testid="qr-code" aria-label="QR code vouchera" />
    </div>
  );
}

function PurchasePendingView({ orderId }: { orderId: string }) {
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
    <div data-testid="pending-state">
      <h1>Przygotowujemy Twój voucher...</h1>
      {elapsed >= 60 ? (
        <p>Voucher zostanie dostarczony wkrótce. Sprawdź email lub wróć na tę stronę.</p>
      ) : (
        <p>Bezpiecznie zamknij przeglądarkę</p>
      )}
      <p data-testid="order-ref">Numer zamówienia: {orderId}</p>
    </div>
  );
}

function PaymentErrorView() {
  return (
    <div data-testid="error-state">
      <h1>Płatność nie powiodła się</h1>
      <a href="/checkout" data-testid="retry-cta">
        Spróbuj ponownie
      </a>
      <a href="/cart" data-testid="change-method-cta">
        Zmień metodę
      </a>
    </div>
  );
}

export function ConfirmationPageContent({ orderId }: Props) {
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
    return <div data-testid="loading">Ładowanie...</div>;
  }

  if (fetchError || !order) {
    return (
      <div data-testid="not-found">
        <h1>Zamówienie nie zostało znalezione</h1>
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
      <div data-testid="order-confirmed-generic">
        <h1>Dziękujemy! Zamówienie zostało przyjęte.</h1>
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
