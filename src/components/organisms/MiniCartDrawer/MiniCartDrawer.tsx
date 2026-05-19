'use client';

// @chrome-manifest: W6-08
// MiniCartDrawer — Wave 6 chrome W6-08. v1.8.0 BonBeauty DS mini-cart drawer.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/mini-cart-drawer.yaml
// CSS custom properties consumed: --bb-surface, --bb-surface-strong, --bb-surface-muted,
//   --bb-shadow-lift, --bb-border-soft, --bb-border-hairline, --bg-action, --bg-action-hover,
//   --cta, --color-trust, --text-primary, --text-secondary, --text-on-action,
//   --bb-radius-card, --bb-radius-panel, --font-body, --font-weight-medium,
//   --font-weight-bold, --space-4, --space-6, --space-8, --anim-duration-base,
//   --anim-ease-emphasized
// Exposed: --mini-cart-width (400px), --mini-cart-z (250)
//
// 4 stany (Story 3.1 AC5): empty / one-item / many / with-discount-applied
// Slide-in animation z prefers-reduced-motion respect; focus trap + ESC + aria-live

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

export interface CartItem {
  id: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
}

export interface Discount {
  code: string;
  amount: number;
}

export interface MiniCartDrawerProps {
  open: boolean;
  items: CartItem[];
  subtotal: number;
  discountApplied?: Discount | null;
  currency: string;
  locale: string;
  onClose: () => void;
  onCheckout?: () => void;
  onRemoveItem?: (itemId: string) => void;
  onApplyDiscount?: (code: string) => Promise<void>;
  className?: string;
}

function formatPrice(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function MiniCartDrawer({
  open,
  items,
  subtotal,
  discountApplied,
  currency,
  locale,
  onClose,
  onCheckout,
  onRemoveItem,
  onApplyDiscount,
  className,
}: MiniCartDrawerProps) {
  const t = useTranslations('mini_cart');
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const containerRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
    lockScroll: true,
  });

  if (!open) return null;

  const isEmpty = items.length === 0;
  const state = isEmpty
    ? 'empty'
    : items.length === 1
      ? 'one-item'
      : discountApplied
        ? 'with-discount-applied'
        : 'many';

  const total = Math.max(0, subtotal - (discountApplied?.amount ?? 0));

  async function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code || applying) return;
    setApplying(true);
    try {
      await onApplyDiscount?.(code);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--mini-cart-z,250)]"
      style={
        {
          '--mini-cart-width': '400px',
          '--mini-cart-z': '250',
        } as React.CSSProperties
      }
      data-testid="mini-cart-overlay"
    >
      <div
        className="absolute inset-0 bg-[var(--bb-overlay-backdrop)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('aria_label')}
        tabIndex={-1}
        data-testid="mini-cart-drawer"
        data-state={state}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full flex-col bg-[var(--bb-surface)]',
          'shadow-[var(--bb-shadow-lift)] sm:w-[var(--mini-cart-width,400px)]',
          // slide-in animation; disabled under prefers-reduced-motion
          'motion-safe:animate-[slide-in-right_var(--anim-duration-base,250ms)_var(--anim-ease-emphasized,ease-out)]',
          className
        )}
      >
        {/* slot: header */}
        <div className="flex items-center justify-between border-b border-[var(--bb-border-soft)] p-[var(--space-4,16px)]">
          <h2 className="text-base font-[var(--font-weight-bold)] text-[var(--text-primary)]">
            {t('title')}{' '}
            <span
              aria-live="polite"
              className="text-[var(--text-secondary)]"
              data-testid="mini-cart-count"
            >
              ({items.length})
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            data-testid="mini-cart-close"
          >
            ✕
          </button>
        </div>

        {isEmpty ? (
          /* slot: empty-state */
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 p-[var(--space-8,32px)] text-center"
            data-testid="mini-cart-empty"
          >
            <span aria-hidden="true" className="text-4xl">
              🛍️
            </span>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('empty_title')}
            </p>
            <Button onClick={onClose} data-testid="mini-cart-empty-cta">
              {t('empty_cta')}
            </Button>
          </div>
        ) : (
          <>
            {/* slot: item-list */}
            <ul
              className="flex-1 divide-y divide-[var(--bb-border-hairline,var(--bb-border-soft))] overflow-y-auto"
              data-testid="mini-cart-items"
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 p-[var(--space-4,16px)]"
                  data-testid={`mini-cart-item-${item.id}`}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--bb-radius-card,12px)] bg-[var(--bb-surface-muted,var(--bb-surface-strong))]">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        width={64}
                        height={64}
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                      {item.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.quantity} ×{' '}
                      {formatPrice(item.unitPrice, currency, locale)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.id)}
                    aria-label={t('remove')}
                    className="self-start text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                    data-testid={`mini-cart-remove-${item.id}`}
                  >
                    {t('remove')}
                  </button>
                </li>
              ))}
            </ul>

            <div className="space-y-[var(--space-4,16px)] border-t border-[var(--bb-border-soft)] p-[var(--space-4,16px)]">
              {/* slot: discount-row */}
              <form
                onSubmit={handleApply}
                className="flex gap-2"
                data-testid="mini-cart-discount-row"
              >
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('discount_placeholder')}
                  aria-label={t('discount')}
                  className="flex-1 rounded-[var(--bb-radius-card,12px)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]"
                  data-testid="mini-cart-discount-input"
                />
                <Button
                  type="submit"
                  variant="tonal"
                  disabled={applying}
                  data-testid="mini-cart-discount-apply"
                >
                  {t('apply')}
                </Button>
              </form>

              {/* slot: summary */}
              <dl
                className="space-y-1 text-sm"
                aria-live="polite"
                data-testid="mini-cart-summary"
              >
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <dt>{t('subtotal')}</dt>
                  <dd
                    className={cn(
                      discountApplied && 'line-through opacity-60'
                    )}
                  >
                    {formatPrice(subtotal, currency, locale)}
                  </dd>
                </div>
                {discountApplied && (
                  <div className="flex justify-between text-[var(--color-trust)]">
                    <dt>
                      {t('discount')} ({discountApplied.code})
                    </dt>
                    <dd>
                      −{formatPrice(discountApplied.amount, currency, locale)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between font-[var(--font-weight-bold)] text-[var(--text-primary)]">
                  <dt>{t('total')}</dt>
                  <dd data-testid="mini-cart-total">
                    {formatPrice(total, currency, locale)}
                  </dd>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {t('shipping_estimate')}
                </p>
              </dl>

              {/* slot: checkout-cta */}
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={onCheckout}
                  data-testid="mini-cart-checkout"
                >
                  {t('checkout')}
                </Button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-sm text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                  data-testid="mini-cart-continue"
                >
                  {t('continue_shopping')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
