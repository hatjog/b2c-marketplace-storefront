'use client';

/**
 * PaymentStatusV180 — v1.8.0 payment status surface with 6 lifecycle states.
 *
 * Story 1.5: Payment Status Surface 6 States.
 *
 * 6 states: paid | pending_psp | failed_retryable | failed_nonretryable | expired | support_required
 *
 * Key behaviors:
 *   - Auto-poll every 5s while pending_psp (via usePaymentStatusPoll → createPaymentStatusPoller)
 *   - Auto-redirect to confirmed after 2s on paid (cancelled on reduced-motion or focus)
 *   - role="alert" (assertive) for failed_nonretryable + support_required
 *   - role="status" (polite) for paid / pending / expired / failed_retryable
 *   - Countdown "Sprawdzamy ponownie za {n}s..." visual; SR announces on 5s tick
 *   - Second-tier message after 90s of pending with dynamic elapsed counter
 *   - CrossActorHandoff on every state (local molecule pending Epic 0 ratification)
 *   - <details> technical section per state
 *
 * ARCH-007: Customer-facing storefront only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import type { BackendPaymentStatusResponse, PaymentStatusV180 } from '@/lib/payment/payment-status-v180-adapter';
import { resolveStatusFromResponse } from '@/lib/payment/payment-status-v180-adapter';
import { COUNTDOWN_SECONDS } from '@/lib/payment/payment-status-poller';
import {
  buildSupportMailto,
  getAriaLiveRole,
  getCtaPath,
  getErrorCopy,
  hasPrimaryCta,
} from '@/lib/payment/payment-status-v180-config';
import { usePaymentStatusPoll } from '@/hooks/usePaymentStatusPoll';

export interface PaymentStatusV180Props {
  orderId: string;
}

// ─── LP2 pulse animation (UX SSOT LP2: opacity 0.6→1.0→0.6 loop 1.4s) ────────

const LP2_PULSE_CSS = `
@keyframes lp2-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1.0; }
}
.lp2-pulse-anim {
  animation: lp2-pulse 1.4s ease-in-out infinite;
}
`;

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
      className={[className, !reducedMotion ? 'lp2-pulse-anim' : ''].filter(Boolean).join(' ')}
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

// ─── Variant container styles per state ───────────────────────────────────────

function getContainerClasses(status: PaymentStatusV180): string {
  switch (status) {
    case 'paid':
      return 'border-[var(--bb-border-success)] bg-[var(--bb-surface-success)]';
    case 'pending_psp':
      return 'border-[var(--bb-border-pending)] bg-[var(--bb-surface-pending,#faf9f7)]';
    case 'failed_retryable':
      return 'border-[var(--bb-border-warning,#d97706)] bg-[var(--bb-icon-bg-error,#fef3c7)]';
    case 'failed_nonretryable':
      return 'border-[var(--bb-border-error)] bg-[var(--bb-icon-bg-error,#fef5f5)]';
    case 'expired':
      return 'border-[var(--bb-border-expired)] bg-[var(--bb-surface-expired,#f5f4f2)]';
    case 'support_required':
      return 'border-[var(--bb-border-warning)] bg-[var(--bb-surface-pending,#faf9f7)]';
    default:
      return 'border-[var(--bb-border-pending)] bg-stone-50';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PaymentStatusV180({ orderId }: PaymentStatusV180Props) {
  const t = useTranslations();
  const locale = useLocale();
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
          // 401 = brak dowodu (typowo gość), 403 = sesja bez uprawnień do tego
          // zamówienia. Dwie różne rady dla kupującej, więc dwa różne stany.
          if (res.status === 401) setFetchError('access_denied_guest');
          else if (res.status === 403) setFetchError('access_denied');
          else setFetchError('unavailable');
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

  // Bez `onError` rozróżnienie access_denied/unavailable działałoby wyłącznie
  // w pierwszym fetchu — wygaśnięcie dowodu w trakcie oczekiwania na płatność
  // asynchroniczną zostawiałoby ekran w stanie „czekamy" bez końca.
  const handlePollError = useCallback((err: Error) => {
    if (err.message === 'access_denied' || err.message === 'access_denied_guest') {
      setFetchError(err.message);
    } else {
      setFetchError('unavailable');
    }
  }, []);

  const { countdown, isSecondTier, secondsTotalElapsed } = usePaymentStatusPoll({
    orderId,
    enabled: status === 'pending_psp' && !loading,
    onStatusChange: handleStatusChange,
    onError: handlePollError,
  });

  // Auto-redirect to confirmed after 2s on paid
  useEffect(() => {
    if (status !== 'paid') return;
    if (reducedMotion) return;

    redirectTimerRef.current = setTimeout(() => {
      // Cancel if CTA has focus (user is about to click — no surprise navigation)
      if (document.activeElement === ctaRef.current) return;
      router.push(`/${locale}/order/${orderId}/confirmed`);
    }, 2_000);

    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [status, reducedMotion, orderId, locale, router]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-[560px] items-center justify-center py-16"
        data-testid="payment-status-v180-loading"
      >
        <span
          className="h-8 w-8 rounded-full border-4 border-t-transparent border-[var(--state-pending,#7E4510)] motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">{t('payment_status.loading')}</span>
      </div>
    );
  }

  if (fetchError || !status || !responseData) {
    // 401/403 to inna diagnoza niż awaria: zamówienie istnieje, brakuje dowodu
    // uprawnienia. Wspólny komunikat „nie udało się pobrać informacji" wysyłał
    // kupującą do obsługi klienta zamiast pokazać jej realne wyjście.
    const errorCopy = getErrorCopy(fetchError);
    return (
      <div
        className="mx-auto max-w-[560px] rounded-sm border border-[var(--bb-border-error)] bg-stone-50 p-6"
        data-testid={errorCopy.testId}
        role={errorCopy.assertive ? 'alert' : undefined}
      >
        <h1 className="heading-sm text-primary">{t(errorCopy.titleKey)}</h1>
        <p className="mt-2 text-sm text-secondary">{t(errorCopy.bodyKey)}</p>
      </div>
    );
  }

  const ariaRole = getAriaLiveRole(status);
  const isAssertive = ariaRole === 'alert';
  const ticketId = responseData.ticket_id ?? null;
  const failureCode = responseData.failure_code ?? null;

  const supportEmail = 'support@bonbeauty.pl';
  const orderLabel = t('payment_status.mailto_order_label');
  const ticketLabel = t('payment_status.mailto_ticket_label');

  const supportMailto = buildSupportMailto(supportEmail, ticketId, orderId, orderLabel, ticketLabel);

  // ─── State content ──────────────────────────────────────────────────────────

  const renderIcon = () => {
    // LP2: pending_psp hero 64px desktop / 48px mobile; other states 48px
    // Semantic color tokens per UX-DR2 (AC3/AC6)
    switch (status) {
      case 'paid':
        return <IconCheck className="h-full w-full text-[var(--state-paid,#166534)]" />;
      case 'pending_psp':
        return <IconPulse className="h-full w-full text-[var(--state-pending,#7E4510)]" reducedMotion={reducedMotion} />;
      case 'failed_retryable':
        return <IconWarning className="h-full w-full text-[var(--state-pending,#7E4510)]" />;
      case 'failed_nonretryable':
        return <IconError className="h-full w-full text-[var(--state-failed,#BB251A)]" />;
      case 'expired':
        return <IconCart className="h-full w-full text-secondary" />;
      case 'support_required':
        return <IconSupport className="h-full w-full text-[var(--state-pending,#7E4510)]" />;
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
        // failure_code is display-only in technical section — never in body (AC6 / raw-provider-error-redaction)
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
            ref={ctaRef as React.RefObject<HTMLAnchorElement | null>}
            href={`/${locale}/order/${orderId}/confirmed`}
            data-testid="payment-status-v180-cta"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('payment_status.paid.cta')}
          </a>
        );
      case 'pending_psp':
        return null;
      case 'failed_retryable':
        // v1.9.0 Wave F7 hardening (Epic-3-Review F-01): button + programmatic
        // navigation with idempotency-key cookie (NFR — Story 1.7 FR1.8 retry
        // contract). Anchor href ?retry_count=1 leaked retry semantics into
        // URL + browser history; button + router.push keeps the retry intent
        // server-action-friendly.
        return (
          <button
            type="button"
            ref={ctaRef as React.RefObject<HTMLButtonElement | null>}
            onClick={() => {
              try {
                if (typeof document !== 'undefined') {
                  const key = `${orderId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
                  document.cookie = `payment_retry_idempotency_key=${encodeURIComponent(key)}; Path=/; Max-Age=900; SameSite=Lax`;
                }
              } catch {
                // best-effort cookie write
              }
              router.push(
                `/${locale}/checkout?order_id=${encodeURIComponent(orderId)}`
              );
            }}
            data-testid="payment-status-v180-cta"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('payment_status.failed_retryable.cta')}
          </button>
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
            href={`/${locale}/cart`}
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
                className="text-sm text-[var(--state-failed,#BB251A)]"
                data-testid="payment-status-v180-ticket-missing"
                role="alert"
              >
                {t('payment_status.support_required.ticket_missing')}
              </p>
            )}
            {ticketId && (
              <p
                className="select-text font-mono text-sm text-secondary"
                data-testid="payment-status-v180-ticket-id"
              >
                {ticketLabel}: <span className="font-semibold">{ticketId}</span>
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
        case 'paid': return t('payment_status.paid.for_you');
        case 'pending_psp': return t('payment_status.pending_psp.for_you');
        case 'failed_retryable': return t('payment_status.failed_retryable.for_you');
        case 'failed_nonretryable': return t('payment_status.failed_nonretryable.for_you');
        case 'expired': return t('payment_status.expired.for_you');
        case 'support_required': return t('payment_status.support_required.for_you');
      }
    })();

    const forUs = (() => {
      switch (status) {
        case 'paid': return t('payment_status.paid.for_us');
        case 'pending_psp': return t('payment_status.pending_psp.for_us');
        case 'failed_retryable': return t('payment_status.failed_retryable.for_us');
        case 'failed_nonretryable': return t('payment_status.failed_nonretryable.for_us');
        case 'expired': return t('payment_status.expired.for_us');
        case 'support_required': return t('payment_status.support_required.for_us');
      }
    })();

    return (
      <CrossActorHandoff
        forYou={forYou}
        forUs={forUs}
        labelForYou={t('payment_status.cross_actor.for_you')}
        labelForUs={t('payment_status.cross_actor.for_us')}
        data-testid="cross-actor-handoff"
      />
    );
  };

  const headingText = renderHeading();

  return (
    <>
      {/* LP2 pulse animation keyframes (pending_psp only) */}
      {status === 'pending_psp' && !reducedMotion && (
        <style dangerouslySetInnerHTML={{ __html: LP2_PULSE_CSS }} />
      )}

      {/* Narrow live region for state announcement — assertive or polite */}
      {/* scope: h1 text only, not the whole card, to avoid AT spam (M5 fix) */}
      {isAssertive ? (
        <div role="alert" className="sr-only" aria-atomic="true" data-testid="payment-status-v180-live-region">
          {headingText}
        </div>
      ) : (
        <div role="status" aria-live="polite" className="sr-only" aria-atomic="true" data-testid="payment-status-v180-live-region">
          {headingText}
        </div>
      )}

      <div
        data-payment-status={status}
        data-testid="payment-status-v180"
        className={[
          'mx-auto max-w-[560px] space-y-5 rounded-sm border p-6',
          getContainerClasses(status),
        ].join(' ')}
      >
        {/* ─── Hero icon + heading ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          {/* LP2: 64px desktop / 48px mobile (M3 fix) */}
          <div
            className="flex h-12 w-12 md:h-16 md:w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/60"
            aria-hidden="true"
          >
            {renderIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="heading-sm text-primary" data-testid="payment-status-v180-heading">
              {headingText}
            </h1>
            {/* AC2: timestamp microcopy — when last checked (M1 fix) */}
            {responseData.last_checked_at && (
              <p className="mt-1 text-xs text-secondary" data-testid="payment-status-v180-timestamp">
                {t('payment_status.last_updated', {
                  timestamp: new Date(responseData.last_checked_at).toLocaleTimeString(
                    locale === 'pl' ? 'pl-PL' : 'en-GB',
                    { hour: '2-digit', minute: '2-digit' }
                  )
                })}
              </p>
            )}
          </div>
        </div>

        {/* ─── Body copy ───────────────────────────────────────────────────────── */}
        <p className="label-md text-primary" data-testid="payment-status-v180-body">
          {renderBody()}
        </p>

        {/* ─── Pending poll countdown (LP4) ────────────────────────────────────── */}
        {status === 'pending_psp' && (
          <div data-testid="payment-status-v180-countdown">
            {/* Visual countdown — aria-hidden to avoid per-second AT spam */}
            <p className="text-sm text-secondary" aria-hidden="true">
              {t('payment_status.pending_psp.countdown', { n: String(countdown) })}
            </p>
            {/* SR-only: announce only on poll tick (when countdown resets to 5s) — M5 fix */}
            {countdown === COUNTDOWN_SECONDS && (
              <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {t('payment_status.pending_psp.countdown', { n: String(COUNTDOWN_SECONDS) })}
              </span>
            )}
            {/* AC5/EDP9 second-tier with dynamic elapsed counter — M9 fix */}
            {isSecondTier && (
              <p
                className="mt-2 text-sm text-secondary"
                data-testid="payment-status-v180-second-tier"
              >
                {t('payment_status.pending_psp.second_tier', { elapsed: String(secondsTotalElapsed) })}
              </p>
            )}
          </div>
        )}

        {/* ─── Primary CTA ─────────────────────────────────────────────────────── */}
        {renderCta()}

        {/* ─── Technical details (expandable, default collapsed) ───────────────── */}
        {/* aria-expanded removed — native <details> communicates state to AT (M6 fix) */}
        <details data-testid={`technical-detail-${status}`}>
          <summary
            className="cursor-pointer select-none text-sm text-secondary hover:text-primary"
          >
            {t('payment_status.technical_expand_summary')}
          </summary>
          <p className="mt-2 text-sm text-secondary">
            {renderTechnicalDetail()}
          </p>
        </details>

        {/* ─── Cross-actor handoff (Trust Invariant #5) ────────────────────────── */}
        {renderCrossActor()}
      </div>
    </>
  );
}
