'use client';

import { useEffect, useMemo, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  buildConfirmationStepperState,
  deriveVoucherPipelineStatus,
  getGeneratingElapsedSeconds,
  isSecondTierGenerating,
  maskEmail,
  shouldStopConfirmationPolling
} from '@/lib/confirmation/order-confirmed-stepper';
import {
  resolveGiftCue,
  resolveVoucherRuleBadges,
  resolveVoucherThumbnail
} from '@/lib/confirmation/order-confirmed-surface';
import { cn } from '@/lib/utils';

type OrderItem = {
  id: string | null;
  title: string | null;
  quantity: number;
  subtotal: number;
  total: number;
  unit_price: number;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
};

type ShippingMethod = {
  id: string | null;
  name: string | null;
};

type OrderData = {
  id: string;
  display_id: string | null;
  payment_status: string | null;
  updated_at: string | null;
  customer_id: string | null;
  masked_email: string | null;
  is_guest_checkout: boolean;
  currency_code: string | null;
  item_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  items: OrderItem[];
  shipping_methods: ShippingMethod[];
};

type PaymentStatusData = {
  status?: string;
  last_checked_at?: string;
  recommended_action_key?: string;
};

type EntitlementData = {
  status?: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  issued_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  opened_at?: string | null;
};

type Props = {
  orderId: string;
};

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

function formatMoney(value: number, currencyCode: string | null, locale: string): string {
  const currency = (currencyCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency
    }).format(value / 100);
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
 * L2 fix: validate URL scheme before embedding in CSS background-image.
 * Only http: and https: URLs are allowed (defense-in-depth — CSS background-image
 * does not execute javascript: but we reject non-http schemes to prevent
 * data: URL leakage and future attack vectors).
 */
function toCssImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  return `url("${url.replace(/["\\]/g, '\\$&')}")`;
}

/**
 * L3 fix: also check metadata.gp sub-object so gift detection is consistent
 * with readMetadataString in order-confirmed-surface.ts (which already checks .gp).
 */
function readString(metadata: Record<string, unknown> | null, keys: string[]): string | null {
  if (!metadata) return null;

  for (const key of keys) {
    const directValue = metadata[key];
    if (typeof directValue === 'string' && directValue.trim().length > 0) {
      return directValue.trim();
    }

    const gp = metadata.gp;
    if (typeof gp === 'object' && gp !== null && !Array.isArray(gp)) {
      const gpValue = (gp as Record<string, unknown>)[key];
      if (typeof gpValue === 'string' && gpValue.trim().length > 0) {
        return gpValue.trim();
      }
    }
  }

  return null;
}

function isGiftOrder(order: OrderData, entitlements: EntitlementData[]): boolean {
  if (entitlements.some(ent => String(ent.status ?? '').toUpperCase() === 'ISSUED')) {
    return true;
  }

  return order.items.some(item => {
    const purchaseMode = readString(item.metadata, ['purchase_mode', 'gift_mode']);
    if (purchaseMode && purchaseMode.toLowerCase() === 'gift') {
      return true;
    }

    const recipientName = readString(item.metadata, ['recipient_name', 'gift_recipient_name']);
    const recipientEmail = readString(item.metadata, ['recipient_email', 'gift_recipient_email']);

    return Boolean(recipientName || recipientEmail);
  });
}

function resolveRecipient(
  order: OrderData,
  entitlements: EntitlementData[]
): { name: string | null; email: string | null } {
  for (const ent of entitlements) {
    if (ent.recipient_name || ent.recipient_email) {
      return {
        name: ent.recipient_name ?? null,
        email: ent.recipient_email ?? null
      };
    }
  }

  for (const item of order.items) {
    const name = readString(item.metadata, ['recipient_name', 'gift_recipient_name']);
    const email = readString(item.metadata, ['recipient_email', 'gift_recipient_email']);
    if (name || email) {
      return { name, email };
    }
  }

  return { name: null, email: null };
}

function resolveDeliveryMethod(order: OrderData): 'email' | 'scheduled' | 'physical' {
  for (const item of order.items) {
    const metadataMethod = readString(item.metadata, [
      'delivery_method',
      'voucher_delivery_method',
      'delivery_type'
    ]);

    if (metadataMethod) {
      const normalized = metadataMethod.toLowerCase();
      if (normalized.includes('sched')) return 'scheduled';
      if (normalized.includes('physical') || normalized.includes('courier')) return 'physical';
      if (normalized.includes('email') || normalized.includes('mail')) return 'email';
    }
  }

  const shippingName = order.shipping_methods[0]?.name?.toLowerCase() ?? '';
  if (
    shippingName.includes('kurier') ||
    shippingName.includes('courier') ||
    shippingName.includes('ship')
  ) {
    return 'physical';
  }

  return 'email';
}

export function ConfirmationPageContent({ orderId }: Props) {
  const t = useTranslations('confirmation');
  const locale = useLocale();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementData[]>([]);
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackGeneratingStartedAtMs, setFallbackGeneratingStartedAtMs] = useState<number | null>(
    null
  );
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [orderRes, statusRes, entitlementsRes] = await Promise.all([
          fetch(`/api/v1/orders/${orderId}`, { cache: 'no-store' }),
          fetch(`/api/v1/orders/${orderId}/payment-status`, { cache: 'no-store' }),
          fetch(`/api/v1/entitlements?order_id=${orderId}`, { cache: 'no-store' })
        ]);

        if (!orderRes.ok) {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        const orderData = (await orderRes.json()) as OrderData;
        const entitlementsData = entitlementsRes.ok
          ? ((await entitlementsRes.json()) as EntitlementData[])
          : [];

        const fallbackStatus: PaymentStatusData = {
          status: orderData.payment_status ?? 'paid',
          last_checked_at: orderData.updated_at ?? new Date().toISOString(),
          recommended_action_key: 'wait'
        };

        const statusPayload = statusRes.ok
          ? ((await statusRes.json()) as PaymentStatusData)
          : fallbackStatus;

        if (!cancelled) {
          setOrder(orderData);
          setEntitlements(Array.isArray(entitlementsData) ? entitlementsData : []);
          setStatusData(statusPayload);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const pipelineStatus = useMemo(
    () => deriveVoucherPipelineStatus(statusData?.status, entitlements),
    [statusData?.status, entitlements]
  );

  const stepperState = useMemo(() => buildConfirmationStepperState(pipelineStatus), [pipelineStatus]);

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

  useEffect(() => {
    if (!statusData) {
      return;
    }

    if (shouldStopConfirmationPolling(pipelineStatus)) {
      return;
    }

    let cancelled = false;

    const poller = window.setInterval(async () => {
      try {
        const [statusRes, entitlementsRes] = await Promise.all([
          fetch(`/api/v1/orders/${orderId}/payment-status`, { cache: 'no-store' }),
          fetch(`/api/v1/entitlements?order_id=${orderId}`, { cache: 'no-store' })
        ]);

        if (cancelled) return;

        const payload = statusRes.ok ? ((await statusRes.json()) as PaymentStatusData) : null;
        const entitlementPayload = entitlementsRes.ok
          ? ((await entitlementsRes.json()) as EntitlementData[])
          : null;

        if (!cancelled) {
          if (payload) {
            setStatusData(payload);
          }
          if (Array.isArray(entitlementPayload)) {
            setEntitlements(entitlementPayload);
          }
        }
      } catch {
        // fail-soft: keep the current visible state and continue polling
      }
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [orderId, pipelineStatus, statusData]);

  const elapsedSeconds = generatingAnchorMs
    ? getGeneratingElapsedSeconds(generatingAnchorMs, nowMs)
    : 0;

  const countdownSeconds = Math.max(0, 30 - elapsedSeconds);
  const showSecondTier =
    stepperState.activeStepId === 'voucher_generating' && isSecondTierGenerating(elapsedSeconds);

  if (loading) {
    return (
      <section
        className="bb-section-shell mx-auto max-w-5xl"
        data-testid="order-confirmed-loading"
        role="status"
        aria-live="polite"
      >
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--bb-surface-muted)] motion-reduce:animate-none" />
          <div className="h-4 w-96 animate-pulse rounded bg-[var(--bb-surface-muted)] motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded bg-[var(--bb-surface)] motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section
        className="bb-section-shell mx-auto max-w-3xl"
        data-testid="order-confirmed-error"
      >
        <h1 className="heading-xl">{t('not_found')}</h1>
        <p className="mt-3 text-secondary">{t('error_description')}</p>
      </section>
    );
  }

  const isGift = isGiftOrder(order, entitlements);
  const recipient = resolveRecipient(order, entitlements);
  const fallbackMaskedEmail = order.masked_email ?? maskEmail(null);
  const paidTimestamp = formatTime(order.updated_at, locale);
  const recipientDisplay = recipient.name ?? (recipient.email ? maskEmail(recipient.email) : fallbackMaskedEmail);
  const giftCue = resolveGiftCue(isGift, recipientDisplay, order.items);

  const heroSubcopy = isGift
    ? t('hero_sub_gift', {
        recipient: recipientDisplay
      })
    : t('hero_sub_self', {
        email: fallbackMaskedEmail
      });

  const orderRef = String(order.display_id ?? orderId);
  const isGuest = order.is_guest_checkout;
  const deliveryMethod = resolveDeliveryMethod(order);
  const lastUpdated = formatTime(statusData?.last_checked_at ?? order.updated_at, locale);

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
    <div
      className="mx-auto max-w-6xl space-y-8"
      data-testid="order-confirmed-w1-07"
    >
      <header
        className="bb-section-shell bb-section-shell-strong relative overflow-hidden"
        data-testid="order-confirmed-hero"
      >
        <div
          className="confirm-orna pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full border border-[var(--bb-border-strong)] opacity-40"
          aria-hidden="true"
          data-testid="confirm-orna"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div
            className="success-mark flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)] shadow-[var(--bb-shadow-card)]"
            aria-hidden="true"
            data-testid="order-confirmed-success-mark"
          >
            <span className="text-5xl leading-none">✓</span>
          </div>
          <div>
            <p className="bb-eyebrow">{t('hero_eyebrow')}</p>
            <h1 className="heading-xl text-primary">{t('hero_title')}</h1>
            <p className="mt-3 text-secondary">{heroSubcopy}</p>
          </div>
        </div>
      </header>

      <section
        className="bb-section-shell"
        data-testid="voucher-stepper-section"
        aria-labelledby="voucher-stepper-heading"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="voucher-stepper-heading"
            className="heading-sm text-primary"
          >
            {t('stepper_title')}
          </h2>
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
          {t(`status_${stepperState.activeStepId ?? 'completed'}`)}
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
                <p className={`label-sm ${isDone || isActive ? 'text-[var(--gold)]' : 'text-secondary'}`}>
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
          className="bb-section-shell border border-[var(--bb-border-strong)] bg-[var(--bb-surface-strong)]"
          data-testid="gift-cue"
          aria-labelledby="gift-cue-heading"
        >
          <p className="bb-eyebrow">{t('gift_cue_eyebrow')}</p>
          <h2
            id="gift-cue-heading"
            className="heading-sm text-primary"
          >
            {t('gift_cue_title', { recipient: giftCue.recipient })}
          </h2>
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
        className="bb-section-shell"
        data-testid="order-summary-section"
        aria-labelledby="order-summary-heading"
      >
        <h2
          id="order-summary-heading"
          className="heading-sm text-primary"
        >
          {t('summary_title')}
        </h2>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <p
            className="font-medium text-primary"
            data-testid="order-summary-id"
          >
            {t('summary_order_id', { orderId: orderRef })}
          </p>
          <button
            type="button"
            className="rounded-full border border-[var(--bb-border-strong)] px-3 py-1 text-xs text-primary"
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
              <article
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
              </article>
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

      <section
        className="bb-section-shell"
        data-testid="what-next-section"
        aria-labelledby="what-next-heading"
      >
        <h2
          id="what-next-heading"
          className="heading-sm text-primary"
        >
          {t('next_title')}
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-4">
            <span
              className="nc-ico mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
              aria-hidden="true"
            >
              1
            </span>
            <h3 className="text-sm font-medium text-primary">{t('next_for_you_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_you_body')}</p>
            <LocalizedClientLink
              href="/user/orders"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_you_cta')}
            </LocalizedClientLink>
          </article>

          <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-4">
            <span
              className="nc-ico mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
              aria-hidden="true"
            >
              2
            </span>
            <h3 className="text-sm font-medium text-primary">{t('next_for_recipient_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_recipient_body')}</p>
            <LocalizedClientLink
              href={t('next_for_recipient_href')}
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_recipient_cta')}
            </LocalizedClientLink>
          </article>

          <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] p-4">
            <span
              className="nc-ico mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
              aria-hidden="true"
            >
              3
            </span>
            <h3 className="text-sm font-medium text-primary">{t('next_for_salon_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_salon_body')}</p>
            <LocalizedClientLink
              href="/user/orders"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_salon_cta')}
            </LocalizedClientLink>
          </article>
        </div>
      </section>

      <section
        className="bb-section-shell"
        data-testid="cross-actor-handoff-section"
      >
        <CrossActorHandoff
          forYou={t('cross_actor_for_you')}
          forUs={t('cross_actor_for_us')}
          labelForYou={t('cross_actor_label_for_you')}
          labelForUs={t('cross_actor_label_for_us')}
        />
      </section>

      {isGuest && (
        <section
          className="bb-section-shell"
          data-testid="guest-account-teaser"
        >
          <h2 className="heading-sm text-primary">{t('guest_teaser_title')}</h2>
          <p className="mt-2 text-secondary">{t('guest_teaser_body')}</p>
          <LocalizedClientLink
            href="/register"
            className="bb-primary-cta mt-4 inline-flex rounded-full px-6 py-3"
          >
            {t('guest_teaser_cta')}
          </LocalizedClientLink>
        </section>
      )}

      <footer
        className="slim-footer border-t border-[var(--bb-border-soft)] py-4 text-sm text-secondary"
        data-testid="order-confirmed-slim-footer"
      >
        {t('slim_footer')}
      </footer>
    </div>
  );
}
