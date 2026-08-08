'use client';

/**
 * v1.15.0 Story 3.7 — powierzchnia JEDNEGO zamówienia zakupu.
 *
 * Do tej story cała ta zawartość siedziała w `ConfirmationPageContent`, który
 * przyjmował `orderId: string` i wołał trzy fetch'e dla JEDNEGO identyfikatora.
 * Zakup u dwóch sprzedawców pokazywał wtedy jedno zamówienie i nic nie mówiło,
 * że drugie istnieje.
 *
 * Rozbicie na kartę jest tu warunkiem poprawności, nie estetyką: każde
 * zamówienie ma WŁASNY cykl życia (własny odczyt, własne odpytywanie, własny
 * stan terminalny). Hooki nie mogą być wołane w pętli po tablicy o zmiennej
 * długości, więc jedno zamówienie = jedna instancja komponentu = jeden
 * niezależny poller. Brak danych dla jednego zamówienia jest STANEM TEGO
 * ZAMÓWIENIA, a nie powodem, żeby wypadło z listy (AC1).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  createConfirmationPoller,
  type ConfirmationPollStop,
  type ConfirmationReadHealth
} from '@/lib/confirmation/confirmation-poller';
import {
  buildConfirmationStepperStateFrom,
  getGeneratingElapsedSeconds,
  isFailureConfirmationStatus,
  isSecondTierGenerating,
  maskEmail,
  type VoucherPipelineStatus
} from '@/lib/confirmation/order-confirmed-stepper';
import {
  isGiftOrder,
  localeTag,
  resolveDeliveryMethod,
  resolveRecipient,
  toCssImageUrl,
  type EntitlementData,
  type OrderData,
  type PaymentStatusData
} from '@/lib/confirmation/order-confirmation-view';
import {
  resolveGiftCue,
  resolveVoucherRuleBadges,
  resolveVoucherThumbnail
} from '@/lib/confirmation/order-confirmed-surface';
import { convertToLocale } from '@/lib/helpers/money';
import { cn } from '@/lib/utils';

function formatMoney(value: number, currencyCode: string | null, locale: string): string {
  const currency = (currencyCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return '—';
  }

  try {
    return convertToLocale({
      amount: value,
      currency_code: currency,
      locale: localeTag(locale),
      isMinorUnit: true,
    });
  } catch {
    return '—';
  }
}

function formatTime(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(parsed);
}

/**
 * Rada dla człowieka per stan terminalny porażki. Klucz `cta` jest opcjonalny —
 * stan bez wyjścia byłby ślepym zaułkiem, więc każdy z nich JEDNO wyjście ma.
 */
const FAILURE_COPY: Record<
  'delivery_failed' | 'payment_failed' | 'timed_out',
  { titleKey: string; bodyKey: string; ctaKey: string; testId: string }
> = {
  delivery_failed: {
    titleKey: 'terminal_delivery_failed_title',
    bodyKey: 'terminal_delivery_failed_body',
    ctaKey: 'terminal_delivery_failed_cta',
    testId: 'order-terminal-delivery-failed'
  },
  payment_failed: {
    titleKey: 'terminal_payment_failed_title',
    bodyKey: 'terminal_payment_failed_body',
    ctaKey: 'terminal_payment_failed_cta',
    testId: 'order-terminal-payment-failed'
  },
  timed_out: {
    titleKey: 'terminal_timed_out_title',
    bodyKey: 'terminal_timed_out_body',
    ctaKey: 'terminal_timed_out_cta',
    testId: 'order-terminal-timed-out'
  }
};

const STOP_COPY: Record<ConfirmationPollStop, { titleKey: string; bodyKey: string; testId: string }> = {
  access_denied_guest: {
    titleKey: 'terminal_access_denied_guest_title',
    bodyKey: 'terminal_access_denied_guest_body',
    testId: 'order-terminal-access-denied-guest'
  },
  access_denied: {
    titleKey: 'terminal_access_denied_title',
    bodyKey: 'terminal_access_denied_body',
    testId: 'order-terminal-access-denied'
  },
  order_not_found: {
    titleKey: 'terminal_order_not_found_title',
    bodyKey: 'terminal_order_not_found_body',
    testId: 'order-terminal-not-found'
  }
};

export type OrderConfirmationCardProps = {
  orderId: string;
  /** 1-based pozycja w zakupie; `null`, gdy zakup ma jedno zamówienie. */
  position: number | null;
  /** Liczba zamówień renderowanych na tej powierzchni. */
  total: number;
  onGuestDetected?: (orderId: string, isGuest: boolean) => void;
};

export function OrderConfirmationCard({
  orderId,
  position,
  total,
  onGuestDetected
}: OrderConfirmationCardProps) {
  const t = useTranslations('confirmation');
  const locale = useLocale();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderError, setOrderError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [pipelineStatus, setPipelineStatus] = useState<VoucherPipelineStatus>('unknown');
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementData[]>([]);
  const [readHealth, setReadHealth] = useState<ConfirmationReadHealth>('ok');
  const [stopReason, setStopReason] = useState<ConfirmationPollStop | null>(null);
  /** Liczba wykonanych zapytań — pokazywana wyłącznie maszynie (data-*), dla AC4. */
  const [requestCount, setRequestCount] = useState(0);
  const [pollFinished, setPollFinished] = useState(false);

  const [fallbackGeneratingStartedAtMs, setFallbackGeneratingStartedAtMs] = useState<number | null>(
    null
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  const guestCallbackRef = useRef(onGuestDetected);
  guestCallbackRef.current = onGuestDetected;

  // ── Odczyt danych zamówienia (jednorazowy — treść zamówienia się nie zmienia) ──
  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      try {
        const res = await fetch(`/api/v1/orders/${orderId}`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) {
            setOrderError(true);
            setLoading(false);
          }
          return;
        }
        const data = (await res.json()) as OrderData;
        if (cancelled) return;
        setOrder(data);
        setLoading(false);
        guestCallbackRef.current?.(orderId, Boolean(data.is_guest_checkout));
      } catch {
        if (!cancelled) {
          setOrderError(true);
          setLoading(false);
        }
      }
    }

    void loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // ── Odpytywanie stanu — z KOŃCEM (AC3) ────────────────────────────────────
  //
  // Pętla nie żyje już w tym pliku: dyscyplina (limit zegarowy, zbiór stanów
  // terminalnych, natychmiastowe zakończenie na 401/403/404) siedzi w
  // `createConfirmationPoller` i jest mierzalna bez renderowania strony.
  useEffect(() => {
    const poller = createConfirmationPoller<PaymentStatusData, EntitlementData>({
      orderId,
      callbacks: {
        onSnapshot(snapshot) {
          setPipelineStatus(snapshot.status);
          setStatusData(snapshot.paymentStatus);
          setEntitlements(snapshot.entitlements);
          setReadHealth(snapshot.readHealth);
          setRequestCount(snapshot.requestCount);
          if (snapshot.terminal) {
            setPollFinished(true);
          }
        },
        onStop(reason, meta) {
          setStopReason(reason);
          setRequestCount(meta.requestCount);
          setPollFinished(true);
        }
      }
    });

    poller.start();
    return () => {
      poller.stop();
    };
  }, [orderId]);

  const stepperState = useMemo(
    () => buildConfirmationStepperStateFrom(pipelineStatus),
    [pipelineStatus]
  );

  const generatingAnchorMs = useMemo(() => {
    if (pipelineStatus !== 'voucher_generating') {
      return null;
    }

    const trustedAnchor = order?.updated_at ? Date.parse(order.updated_at) : Number.NaN;
    if (Number.isFinite(trustedAnchor)) {
      return trustedAnchor;
    }

    return fallbackGeneratingStartedAtMs;
  }, [pipelineStatus, order?.updated_at, fallbackGeneratingStartedAtMs]);

  useEffect(() => {
    if (stepperState.activeStepId === 'voucher_generating') {
      setFallbackGeneratingStartedAtMs(current => current ?? Date.now());
      return;
    }

    setFallbackGeneratingStartedAtMs(null);
  }, [stepperState.activeStepId]);

  useEffect(() => {
    if (stepperState.activeStepId !== 'voucher_generating') {
      return;
    }

    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(ticker);
    };
  }, [stepperState.activeStepId]);

  const elapsedSeconds = generatingAnchorMs
    ? getGeneratingElapsedSeconds(generatingAnchorMs, nowMs)
    : 0;
  const countdownSeconds = Math.max(0, 30 - elapsedSeconds);
  const showSecondTier =
    stepperState.activeStepId === 'voucher_generating' && isSecondTierGenerating(elapsedSeconds);

  const positionLabel = position !== null ? t('order_position', {
    index: String(position),
    total: String(total)
  }) : null;

  if (loading) {
    return (
      <section
        className="bb-section-shell"
        data-testid="order-confirmed-loading"
        data-order-id={orderId}
        role="status"
        aria-live="polite"
      >
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--bb-surface-muted)] motion-reduce:animate-none" />
          <div className="h-4 w-96 animate-pulse rounded bg-[var(--bb-surface-muted)] motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded bg-[var(--bb-surface)] motion-reduce:animate-none" />
        </div>
        <span className="sr-only">{t('loading')}</span>
      </section>
    );
  }

  // Brak danych zamówienia jest STANEM TEGO ZAMÓWIENIA — karta zostaje na
  // liście z własnym identyfikatorem, bo zniknięcie pozycji ukryłoby przed
  // kupującą fakt, że coś kupiła (AC1).
  if (orderError || !order) {
    return (
      <section
        className="bb-section-shell border border-[var(--bb-border-error)]"
        data-testid="order-confirmed-error"
        data-order-id={orderId}
        data-order-state="unavailable"
      >
        {positionLabel && <p className="bb-eyebrow">{positionLabel}</p>}
        <h2 className="heading-sm text-primary">{t('not_found')}</h2>
        <p className="mt-3 text-secondary">{t('error_description')}</p>
        <p
          className="mt-2 text-xs text-secondary"
          data-testid="order-confirmed-error-id"
        >
          {t('summary_order_id', { orderId })}
        </p>
      </section>
    );
  }

  const isGift = isGiftOrder(order, entitlements);
  const recipient = resolveRecipient(order, entitlements);
  const fallbackMaskedEmail = order.masked_email ?? maskEmail(null);
  const paidTimestamp = formatTime(order.updated_at, locale);
  const recipientDisplay =
    recipient.name ?? (recipient.email ? maskEmail(recipient.email) : fallbackMaskedEmail);
  const giftCue = resolveGiftCue(isGift, recipientDisplay, order.items);

  const subcopy = isGift
    ? t('hero_sub_gift', { recipient: recipientDisplay })
    : t('hero_sub_self', { email: fallbackMaskedEmail });

  const orderRef = String(order.display_id ?? orderId);
  const deliveryMethod = resolveDeliveryMethod(order);
  const lastUpdated = formatTime(statusData?.last_checked_at ?? order.updated_at, locale);

  const failureCopy = isFailureConfirmationStatus(pipelineStatus)
    ? FAILURE_COPY[pipelineStatus as 'delivery_failed' | 'payment_failed' | 'timed_out']
    : null;
  const stopCopy = stopReason ? STOP_COPY[stopReason] : null;

  const onCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderRef);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article
      className="bb-section-shell space-y-6"
      data-testid="order-confirmation-card"
      data-order-id={orderId}
      data-pipeline-status={pipelineStatus}
      data-poll-finished={pollFinished ? 'true' : 'false'}
      data-poll-requests={String(requestCount)}
      data-read-health={readHealth}
      aria-labelledby={`order-card-heading-${orderId}`}
    >
      <header>
        {positionLabel && (
          <p
            className="bb-eyebrow"
            data-testid="order-position-label"
          >
            {positionLabel}
          </p>
        )}
        <h2
          id={`order-card-heading-${orderId}`}
          className="heading-sm text-primary"
          data-testid="order-card-heading"
        >
          {t('summary_order_id', { orderId: orderRef })}
        </h2>
        <p className="mt-2 text-secondary">{subcopy}</p>
      </header>

      {/* ── Stan terminalny porażki — jedna jasna rada, nie kod błędu ─────── */}
      {(failureCopy || stopCopy) && (
        <div
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-error)] bg-[var(--bb-icon-bg-error,#fef5f5)] p-4"
          data-testid={failureCopy?.testId ?? stopCopy?.testId}
          data-terminal-state={stopReason ?? pipelineStatus}
          role="alert"
        >
          <h3 className="text-sm font-medium text-primary">
            {t(failureCopy?.titleKey ?? stopCopy!.titleKey)}
          </h3>
          <p className="mt-2 text-sm text-secondary">
            {t(failureCopy?.bodyKey ?? stopCopy!.bodyKey)}
          </p>
          <LocalizedClientLink
            href="/user/orders"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-action px-6 py-3 text-base font-medium text-action-on-primary hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)]"
            data-testid="order-terminal-cta"
          >
            {failureCopy ? t(failureCopy.ctaKey) : t('recovery_cta')}
          </LocalizedClientLink>
        </div>
      )}

      {/* ── Odczyt zdegradowany — awaria NIE jest ciszą (AD-19) ───────────── */}
      {readHealth === 'degraded' && !failureCopy && !stopCopy && (
        <p
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-strong)] bg-[var(--bb-surface-muted)] p-3 text-sm text-primary"
          data-testid="order-read-degraded"
          role="status"
        >
          {t('read_degraded_notice')}
        </p>
      )}

      {pipelineStatus === 'delivery_retrying' && (
        <p
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-strong)] bg-[var(--bb-surface-muted)] p-3 text-sm text-primary"
          data-testid="order-delivery-retrying"
          role="status"
        >
          {t('delivery_retrying_notice')}
        </p>
      )}

      <section
        data-testid="voucher-stepper-section"
        aria-labelledby={`voucher-stepper-heading-${orderId}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3
            id={`voucher-stepper-heading-${orderId}`}
            className="heading-sm text-primary"
          >
            {t('stepper_title')}
          </h3>
          {lastUpdated && (
            <p
              className="text-xs text-secondary"
              data-testid="voucher-stepper-last-updated"
            >
              {t('last_checked_label', { timestamp: lastUpdated })}
            </p>
          )}
        </div>

        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {t(`status_${pipelineStatus}`)}
        </div>

        <ol
          className="grid grid-cols-1 gap-4 rounded-[var(--bb-radius-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)] md:grid-cols-4"
          data-testid="voucher-stepper"
          role="list"
          tabIndex={0}
        >
          {stepperState.steps.map((step, index) => {
            const isActive = step.state === 'active';
            const isDone = step.state === 'done';

            return (
              <li
                key={step.id}
                className={cn(
                  'relative rounded-[var(--bb-radius-card)] border p-4 outline-none',
                  index > 0 &&
                    'md:before:absolute md:before:-left-4 md:before:top-8 md:before:h-px md:before:w-4 md:before:bg-[var(--gold)]',
                  isDone && 'border-[var(--gold)] bg-[var(--gold-light)]',
                  isActive && 'border-[var(--gold)] bg-[var(--bb-surface-muted)] shadow-[var(--bb-shadow-card)]',
                  step.state === 'future' && 'border-[var(--bb-border-soft)] bg-[var(--bb-surface)]'
                )}
                data-step-id={step.id}
                data-step-state={step.state}
                aria-current={isActive ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'mb-3 flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium',
                    isDone && 'border-[var(--gold)] bg-[var(--gold)] text-white',
                    isActive && 'border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]',
                    step.state === 'future' && 'border-[var(--bb-border-soft)] bg-[var(--bb-surface)] text-secondary'
                  )}
                  aria-hidden="true"
                >
                  {isDone ? '✓' : index + 1}
                </div>
                <p className={`label-sm ${isDone || isActive ? 'font-medium text-primary' : 'text-secondary'}`}>
                  {step.id === 'paid' ? `${t('step_paid_label')}${isDone ? ' ✓' : ''}` : null}
                  {step.id === 'voucher_generating' ? t('step_generating_label') : null}
                  {step.id === 'email_sent' ? t('step_sent_label') : null}
                  {step.id === 'recipient_opened' ? t('step_opened_label') : null}
                </p>
                <p className="mt-1 text-sm font-medium text-primary">
                  {isDone ? t('step_done') : null}
                  {isActive ? t('step_active') : null}
                  {step.state === 'future' ? t('step_future') : null}
                </p>
                <p className="mt-2 text-xs text-secondary">
                  {step.id === 'paid' ? t('step_paid_eta') : null}
                  {step.id === 'voucher_generating' ? t('step_generating_eta') : null}
                  {step.id === 'email_sent' ? t('step_sent_eta') : null}
                  {step.id === 'recipient_opened' ? t('step_opened_eta') : null}
                </p>
                {step.id === 'paid' && paidTimestamp && (
                  <p
                    className="mt-2 text-xs text-secondary"
                    data-testid="voucher-step-paid-timestamp"
                  >
                    {t('step_paid_timestamp', { timestamp: paidTimestamp })}
                  </p>
                )}
                {step.id === 'voucher_generating' && isActive && (
                  <p
                    className="mt-2 text-xs text-secondary"
                    data-testid="voucher-generating-countdown"
                    aria-live="off"
                  >
                    {t('generating_countdown', { seconds: String(countdownSeconds) })}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {showSecondTier && (
          <p
            className="mt-4 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)] p-3 text-sm text-secondary"
            data-testid="voucher-second-tier"
          >
            {t('second_tier_message', { elapsed: String(elapsedSeconds) })}
          </p>
        )}
      </section>

      {giftCue && (
        <section
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-strong)] bg-[var(--bb-surface-strong)] p-4"
          data-testid="gift-cue"
          aria-labelledby={`gift-cue-heading-${orderId}`}
        >
          <p className="bb-eyebrow">{t('gift_cue_eyebrow')}</p>
          <h3
            id={`gift-cue-heading-${orderId}`}
            className="heading-sm text-primary"
          >
            {t('gift_cue_title', { recipient: giftCue.recipient })}
          </h3>
          {giftCue.message ? (
            <blockquote
              className="mt-4 border-l-2 border-[var(--gold)] pl-4 text-base text-primary"
              data-testid="gift-cue-message"
            >
              {giftCue.message}
            </blockquote>
          ) : (
            <p
              className="mt-3 text-sm text-secondary"
              data-testid="gift-cue-message-missing"
            >
              {t('gift_cue_missing_message')}
            </p>
          )}
        </section>
      )}

      <section
        data-testid="order-summary-section"
        aria-labelledby={`order-summary-heading-${orderId}`}
      >
        <h3
          id={`order-summary-heading-${orderId}`}
          className="heading-sm text-primary"
        >
          {t('summary_title')}
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <p
            className="font-medium text-primary"
            data-testid="order-summary-id"
          >
            {t('summary_order_id', { orderId: orderRef })}
          </p>
          <button
            type="button"
            className="min-h-11 rounded-full border border-[var(--bb-border-strong)] px-4 py-1 text-xs text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)]"
            onClick={onCopyOrderId}
          >
            {copied ? t('summary_copied') : t('summary_copy')}
          </button>
        </div>

        <div
          className="mt-5 space-y-3"
          data-testid="order-summary-items"
        >
          {order.items.length === 0 && (
            <p className="text-sm text-secondary">{t('summary_empty')}</p>
          )}
          {order.items.map(item => {
            const thumbnailRaw = resolveVoucherThumbnail(item);
            const thumbnailCss = thumbnailRaw ? toCssImageUrl(thumbnailRaw) : null;
            const badges = resolveVoucherRuleBadges(item, t('badge_refund_30_days'));

            return (
              <div
                key={item.id ?? `${item.title}-${item.quantity}`}
                className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)] bg-cover bg-center"
                    data-testid="voucher-thumbnail"
                    style={thumbnailCss ? { backgroundImage: thumbnailCss } : undefined}
                  >
                    {thumbnailCss ? (
                      <span className="sr-only">{item.title ?? t('summary_item_fallback')}</span>
                    ) : (
                      <span
                        className="text-xl text-[var(--gold)]"
                        aria-hidden="true"
                      >
                        ✦
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-primary">
                        {item.title ?? t('summary_item_fallback')}
                      </p>
                      <p className="text-sm text-primary">
                        {formatMoney(item.total, order.currency_code, locale)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      {t('summary_item_quantity', { quantity: String(item.quantity) })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {badges.validity && (
                        <span
                          className="badge-pill rounded-full border border-[var(--bb-border-strong)] bg-[var(--gold-light)] px-3 py-1 text-xs text-primary"
                          data-testid="voucher-validity-badge"
                        >
                          {t('badge_valid_until', { value: badges.validity })}
                        </span>
                      )}
                      <span
                        className="badge-pill rounded-full border border-[var(--bb-border-strong)] bg-[var(--bb-surface-muted)] px-3 py-1 text-xs text-primary"
                        data-testid="voucher-refund-badge"
                      >
                        {badges.refund}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid="order-summary-meta"
        >
          <div className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-3">
            <p className="text-xs text-secondary">{t('summary_delivery_method')}</p>
            <p className="mt-1 text-sm font-medium text-primary">
              {deliveryMethod === 'email' ? t('delivery_email') : null}
              {deliveryMethod === 'scheduled' ? t('delivery_scheduled') : null}
              {deliveryMethod === 'physical' ? t('delivery_physical') : null}
            </p>
          </div>

          <div className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-3">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-secondary">{t('summary_subtotal')}</dt>
                <dd className="text-primary">
                  {formatMoney(order.item_total, order.currency_code, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-secondary">{t('summary_fees')}</dt>
                <dd className="text-primary">
                  {formatMoney(order.shipping_total + order.tax_total, order.currency_code, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--bb-border-soft)] pt-2 font-medium">
                <dt className="text-primary">{t('summary_total')}</dt>
                <dd className="text-primary">
                  {formatMoney(order.total, order.currency_code, locale)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </article>
  );
}
