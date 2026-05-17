'use client';

/**
 * PaymentStatusV180 — v1.8.0 payment status surface with 6 lifecycle states.
 *
 * Story 1.5: Payment Status Surface 6 States.
 *
 * 6 states: paid | pending_psp | failed_retryable | failed_nonretryable | expired | support_required
 *
 * Key behaviors:
 *   - Auto-poll every 5s while pending_psp (via usePaymentStatusPoll)
 *   - Auto-redirect to confirmed after 2s on paid (cancelled on reduced-motion or focus)
 *   - aria-live="assertive" for failed_nonretryable + support_required
 *   - Countdown "Sprawdzamy ponownie za {n}s..." visible during polling
 *   - Second-tier message after 90s of pending
 *   - CrossActorHandoff on every state
 *   - <details> technical section per state
 *
 * ARCH-007: Customer-facing storefront only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import type { BackendPaymentStatusResponse, PaymentStatusV180 } from '@/lib/payment/payment-status-v180-adapter';
import { resolveStatusFromResponse } from '@/lib/payment/payment-status-v180-adapter';
import { usePaymentStatusPoll } from '@/hooks/usePaymentStatusPoll';

export interface PaymentStatusV180Props {
  orderId: string;
}

// ─── Status Icons ────────────────────────────────────────────────────────────

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 12l3.5 3.5L17 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPulse({ className, reducedMotion }: { className?: string; reducedMotion: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={[
        className,
        !reducedMotion ? 'animate-pulse motion-reduce:animate-none' : '',
      ].filter(Boolean).join(' ')}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconWarning({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 3L22 21H2L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconError({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSupport({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9a3 3 0 116 0c0 2-3 3-3 4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Variant styles per state ─────────────────────────────────────────────────

function getContainerClasses(status: PaymentStatusV180): string {
  switch (status) {
    case 'paid':
      return 'border-[var(--bb-border-success)] bg-[var(--bb-surface-success)]';
    case 'pending_psp':
      return 'border-[var(--bb-border-pending)] bg-[var(--bb-surface-pending,#faf9f7)]';
    case 'failed_retryable':
      return 'border-[var(--bb-border-warning,#d97706)] bg-[var(--bb-icon-bg-error,#fef3c7)]';
    case 'failed_nonretryable':
      return 'border-[var(--bb-border-error)] bg-[var(--bb-icon-bg-error,#fef2f2)]';
    case 'expired':
      return 'border-[var(--bb-border-expired)] bg-[var(--bb-surface-expired,#f5f4f2)]';
    case 'support_required':
      return 'border-[var(--bb-border-warning)] bg-[var(--bb-surface-pending,#faf9f7)]';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PaymentStatusV180({ orderId }: PaymentStatusV180Props) {
  const t = useTranslations();
  const router = useRouter();

  const [status, setStatus] = useState<PaymentStatusV180 | null>(null);
  const [responseData, setResponseData] = useState<BackendPaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const ctaRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/v1/orders/${orderId}/payment-status`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setFetchError(res.status === 401 || res.status === 403 ? 'access_denied' : 'unavailable');
          return;
        }
        const data = (await res.json()) as BackendPaymentStatusResponse;
        if (cancelled) return;
        setResponseData(data);
        setStatus(resolveStatusFromResponse(data));
      })
      .catch(() => {
        if (!cancelled) setFetchError('unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [orderId]);

  // Poll handler
  const handleStatusChange = useCallback(
    (newStatus: PaymentStatusV180, data: BackendPaymentStatusResponse) => {
      setResponseData(data);
      setStatus(newStatus);
    },
    [],
  );

  const { countdown, isSecondTier } = usePaymentStatusPoll({
    orderId,
    enabled: status === 'pending_psp' && !loading,
    onStatusChange: handleStatusChange,
  });

  // Auto-redirect to confirmed after 2s on paid
  useEffect(() => {
    if (status !== 'paid') return;
    if (reducedMotion) return;

    redirectTimerRef.current = setTimeout(() => {
      // Cancel if CTA has focus (user is about to click)
      if (document.activeElement === ctaRef.current) return;
      router.push(`/order/${orderId}/confirmed`);
    }, 2_000);

    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [status, reducedMotion, orderId, router]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-[560px] items-center justify-center py-16"
        data-testid="payment-status-v180-loading"
      >
        <span
          className="h-8 w-8 rounded-full border-4 border-t-transparent border-[var(--color-warning)] motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">{t('payment_status.loading')}</span>
      </div>
    );
  }

  if (fetchError || !status || !responseData) {
    return (
      <div
        className="mx-auto max-w-[560px] rounded-sm border border-[var(--bb-border-error)] bg-stone-50 p-6"
        data-testid="payment-status-v180-error"
      >
        <p className="text-sm text-secondary">
          {t('payment_status.unavailable_body')}
        </p>
      </div>
    );
  }

  const isAssertive = status === 'failed_nonretryable' || status === 'support_required';
  const ticketId = responseData.ticket_id ?? null;
  const failureCode = responseData.failure_code ?? null;

  const supportEmail = 'support@bonbeauty.pl';
  const supportMailto = ticketId
    ? `mailto:${supportEmail}?subject=Ticket ${ticketId}&body=Zamówienie: ${orderId}%0ATicket: ${ticketId}`
    : `mailto:${supportEmail}?body=Zamówienie: ${orderId}`;

  // ─── State content ──────────────────────────────────────────────────────────

  const renderIcon = () => {
    switch (status) {
      case 'paid':
        return <IconCheck className="h-6 w-6 text-[var(--bb-color-success,#16a34a)]" />;
      case 'pending_psp':
        return <IconPulse className="h-6 w-6 text-[var(--color-warning,#d97706)]" reducedMotion={reducedMotion} />;
      case 'failed_retryable':
        return <IconWarning className="h-6 w-6 text-[var(--color-warning,#d97706)]" />;
      case 'failed_nonretryable':
        return <IconError className="h-6 w-6 text-[var(--color-error,#dc2626)]" />;
      case 'expired':
        return <IconCart className="h-6 w-6 text-secondary" />;
      case 'support_required':
        return <IconSupport className="h-6 w-6 text-[var(--color-warning,#d97706)]" />;
    }
  };

  const renderHeading = () => {
    switch (status) {
      case 'paid':
        return t('payment_status.paid.label_v180');
      case 'pending_psp':
        return t('payment_status.pending_psp.label');
      case 'failed_retryable':
        return t('payment_status.failed_retryable.label');
      case 'failed_nonretryable':
        return t('payment_status.failed_nonretryable.label');
      case 'expired':
        return t('payment_status.expired.label_v180');
      case 'support_required':
        return t('payment_status.support_required.label_v180');
    }
  };

  const renderBody = () => {
    switch (status) {
      case 'paid':
        return t('payment_status.paid.body_v180');
      case 'pending_psp':
        return t('payment_status.pending_psp.body');
      case 'failed_retryable':
        return t('payment_status.failed_retryable.body');
      case 'failed_nonretryable':
        return t('payment_status.failed_nonretryable.body');
      case 'expired':
        return t('payment_status.expired.body_v180');
      case 'support_required':
        return t('payment_status.support_required.body_v180', { ticket_id: ticketId ?? '—' });
    }
  };

  const renderTechnicalDetail = () => {
    switch (status) {
      case 'paid':
        return t('payment_status.paid.technical_detail');
      case 'pending_psp':
        return t('payment_status.pending_psp.technical_detail');
      case 'failed_retryable':
        return failureCode
          ? `Stripe error: ${failureCode} — retry recommended`
          : t('payment_status.failed_retryable.technical_detail');
      case 'failed_nonretryable':
        return failureCode
          ? `${t('payment_status.failed_nonretryable.technical_detail')} (${failureCode})`
          : t('payment_status.failed_nonretryable.technical_detail');
      case 'expired':
        return t('payment_status.expired.technical_detail');
      case 'support_required':
        return t('payment_status.support_required.technical_detail');
    }
  };

  const renderCta = () => {
    switch (status) {
      case 'paid':
        return (
          <a
            ref={ctaRef as React.RefObject<HTMLAnchorElement>}
            href={`/order/${orderId}/confirmed`}
            data-testid="payment-status-v180-cta"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('payment_status.paid.cta')}
          </a>
        );
      case 'pending_psp':
        return null;
      case 'failed_retryable':
        return (
          <a
            href="/checkout"
            data-testid="payment-status-v180-cta"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('payment_status.failed_retryable.cta')}
          </a>
        );
      case 'failed_nonretryable':
        return (
          <a
            href={supportMailto}
            data-testid="payment-status-v180-cta"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('payment_status.failed_nonretryable.cta')}
          </a>
        );
      case 'expired':
        return (
          <a
            href="/cart"
            data-testid="payment-status-v180-cta"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('payment_status.expired.cta_v180')}
          </a>
        );
      case 'support_required':
        return (
          <div className="space-y-3">
            {!ticketId && (
              <p
                className="text-sm text-[var(--color-error,#dc2626)]"
                data-testid="payment-status-v180-ticket-missing"
              >
                {t('payment_status.support_required.ticket_missing')}
              </p>
            )}
            {ticketId && (
              <p
                className="select-text font-mono text-sm text-secondary"
                data-testid="payment-status-v180-ticket-id"
              >
                Ticket: {ticketId}
              </p>
            )}
            <a
              href={supportMailto}
              data-testid="payment-status-v180-cta"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t('payment_status.support_required.cta_v180')}
            </a>
          </div>
        );
    }
  };

  const renderCrossActor = () => {
    const forYou = (() => {
      switch (status) {
        case 'paid': return 'Możesz przejść do szczegółów zamówienia.';
        case 'pending_psp': return 'Nie musisz nic robić — sprawdzamy automatycznie.';
        case 'failed_retryable': return 'Wróć do kasy i spróbuj ponownie.';
        case 'failed_nonretryable': return 'Skontaktuj się z bankiem lub wybierz inną metodę płatności.';
        case 'expired': return 'Wróć do koszyka i dokończ zamówienie.';
        case 'support_required': return 'Poczekaj na kontakt z naszej strony lub napisz do nas.';
      }
    })();

    const forUs = (() => {
      switch (status) {
        case 'paid': return 'Zamówienie potwierdzone — przekazujemy do realizacji.';
        case 'pending_psp': return 'Monitorujemy automatycznie — webhook race resolution w toku.';
        case 'failed_retryable': return 'Transakcja anulowana po stronie PSP — brak obciążenia konta.';
        case 'failed_nonretryable': return 'Płatność odrzucona przez bank — wymagane działanie z Twojej strony.';
        case 'expired': return 'Sesja płatności wygasła — zamówienie zarezerwowane przez 7 dni.';
        case 'support_required': return 'Ticket utworzony — weryfikacja manualna w toku.';
      }
    })();

    return (
      <CrossActorHandoff
        forYou={forYou}
        forUs={forUs}
        data-testid="cross-actor-handoff"
      />
    );
  };

  return (
    <div
      role="status"
      aria-live={isAssertive ? 'assertive' : 'polite'}
      data-payment-status={status}
      data-testid="payment-status-v180"
      className={[
        'mx-auto max-w-[560px] space-y-5 rounded-sm border p-6',
        getContainerClasses(status),
      ].join(' ')}
    >
      {/* ─── Hero icon + heading ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/60"
          aria-hidden="true"
        >
          {renderIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="heading-sm text-primary" data-testid="payment-status-v180-heading">
            {renderHeading()}
          </h1>
        </div>
      </div>

      {/* ─── Body copy ───────────────────────────────────────────────────────── */}
      <p className="label-md text-primary" data-testid="payment-status-v180-body">
        {renderBody()}
      </p>

      {/* ─── Pending poll countdown ──────────────────────────────────────────── */}
      {status === 'pending_psp' && (
        <div aria-live="polite" data-testid="payment-status-v180-countdown">
          <p className="text-sm text-secondary">
            {t('payment_status.pending_psp.countdown', { n: String(countdown) })}
          </p>
          {isSecondTier && (
            <p
              className="mt-2 text-sm text-secondary"
              data-testid="payment-status-v180-second-tier"
            >
              {t('payment_status.pending_psp.second_tier')}
            </p>
          )}
        </div>
      )}

      {/* ─── Primary CTA ─────────────────────────────────────────────────────── */}
      {renderCta()}

      {/* ─── Technical details (expandable) ─────────────────────────────────── */}
      <details data-testid={`technical-detail-${status}`}>
        <summary
          className="cursor-pointer select-none text-sm text-secondary hover:text-primary"
          aria-expanded="false"
        >
          {t('payment_status.technical_expand_summary')}
        </summary>
        <p className="mt-2 text-sm text-secondary">
          {renderTechnicalDetail()}
        </p>
      </details>

      {/* ─── Cross-actor handoff ─────────────────────────────────────────────── */}
      {renderCrossActor()}
    </div>
  );
}
