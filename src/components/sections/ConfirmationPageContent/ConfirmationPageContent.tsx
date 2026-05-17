'use client';

import { useEffect, useMemo, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  buildConfirmationStepperState,
  getGeneratingElapsedSeconds,
  isSecondTierGenerating,
  maskEmail,
  normalizeVoucherPipelineStatus,
  shouldStopConfirmationPolling
} from '@/lib/confirmation/order-confirmed-stepper';

type OrderItem = {
  id: string | null;
  title: string | null;
  quantity: number;
  subtotal: number;
  total: number;
  unit_price: number;
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
  email: string | null;
  customer_id: string | null;
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
  const currency = (currencyCode ?? 'PLN').toUpperCase();
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency
  }).format(value / 100);
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

function readString(metadata: Record<string, unknown> | null, keys: string[]): string | null {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
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
  const [generatingStartedAtMs, setGeneratingStartedAtMs] = useState<number | null>(null);
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

  const stepperState = useMemo(
    () => buildConfirmationStepperState(statusData?.status),
    [statusData?.status]
  );

  useEffect(() => {
    if (stepperState.activeStepId === 'voucher_generating') {
      setGeneratingStartedAtMs(current => current ?? Date.now());
      return;
    }

    setGeneratingStartedAtMs(null);
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

    const normalizedStatus = normalizeVoucherPipelineStatus(statusData.status);
    if (shouldStopConfirmationPolling(normalizedStatus)) {
      return;
    }

    let cancelled = false;

    const poller = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/orders/${orderId}/payment-status`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;

        const payload = (await res.json()) as PaymentStatusData;
        if (!cancelled) {
          setStatusData(payload);
        }
      } catch {
        // fail-soft: keep the current visible state and continue polling
      }
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [orderId, statusData]);

  const elapsedSeconds = generatingStartedAtMs
    ? getGeneratingElapsedSeconds(generatingStartedAtMs, nowMs)
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
          <div className="h-8 w-64 animate-pulse rounded bg-stone-200 motion-reduce:animate-none" />
          <div className="h-4 w-96 animate-pulse rounded bg-stone-200 motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
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

  const heroSubcopy = isGift
    ? t('hero_sub_gift', {
        recipient: recipient.name ?? maskEmail(recipient.email ?? order.email)
      })
    : t('hero_sub_self', {
        email: maskEmail(order.email)
      });

  const orderRef = String(order.display_id ?? orderId);
  const isGuest = !order.customer_id;
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
        className="bb-section-shell bb-section-shell-strong"
        data-testid="order-confirmed-hero"
      >
        <h1 className="heading-xl text-primary">{t('hero_title')}</h1>
        <p className="mt-3 text-secondary">{heroSubcopy}</p>
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
          className="grid grid-cols-1 gap-4 md:grid-cols-4"
          data-testid="voucher-stepper"
          role="list"
        >
          {stepperState.steps.map(step => {
            const isActive = step.state === 'active';
            const isDone = step.state === 'done';

            return (
              <li
                key={step.id}
                className={[
                  'rounded-sm border p-4 outline-none',
                  isDone ? 'border-emerald-200 bg-emerald-50' : '',
                  isActive ? 'border-amber-300 bg-amber-50' : '',
                  step.state === 'future' ? 'border-stone-200 bg-white' : ''
                ].join(' ')}
                data-step-id={step.id}
                data-step-state={step.state}
                tabIndex={0}
              >
                <p className="label-sm text-secondary">
                  {step.id === 'paid' ? t('step_paid_label') : null}
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
            className="mt-4 rounded-sm border border-stone-200 bg-stone-50 p-3 text-sm text-secondary"
            data-testid="voucher-second-tier"
          >
            {t('second_tier_message', { elapsed: String(elapsedSeconds) })}
          </p>
        )}
      </section>

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
            className="rounded-full border border-stone-300 px-3 py-1 text-xs text-primary"
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
          {order.items.map(item => (
            <article
              key={item.id ?? `${item.title}-${item.quantity}`}
              className="rounded-sm border border-stone-200 p-3"
            >
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
            </article>
          ))}
        </div>

        <div
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid="order-summary-meta"
        >
          <div className="rounded-sm border border-stone-200 p-3">
            <p className="text-xs text-secondary">{t('summary_delivery_method')}</p>
            <p className="mt-1 text-sm font-medium text-primary">
              {deliveryMethod === 'email' ? t('delivery_email') : null}
              {deliveryMethod === 'scheduled' ? t('delivery_scheduled') : null}
              {deliveryMethod === 'physical' ? t('delivery_physical') : null}
            </p>
          </div>

          <div className="rounded-sm border border-stone-200 p-3">
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
              <div className="flex items-center justify-between border-t border-stone-200 pt-2 font-medium">
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
          <article className="rounded-sm border border-stone-200 p-4">
            <h3 className="text-sm font-medium text-primary">{t('next_for_you_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_you_body')}</p>
            <LocalizedClientLink
              href="/user/orders"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_you_cta')}
            </LocalizedClientLink>
          </article>

          <article className="rounded-sm border border-stone-200 p-4">
            <h3 className="text-sm font-medium text-primary">{t('next_for_recipient_title')}</h3>
            <p className="mt-2 text-sm text-secondary">{t('next_for_recipient_body')}</p>
            <LocalizedClientLink
              href="/pomoc"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              {t('next_for_recipient_cta')}
            </LocalizedClientLink>
          </article>

          <article className="rounded-sm border border-stone-200 p-4">
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
    </div>
  );
}
