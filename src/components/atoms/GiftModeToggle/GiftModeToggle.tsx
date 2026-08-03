'use client';

// GiftModeToggle — client-side toggle for gift/self purchase mode on PDP.
// DS v2.1.0: cta, bg-action, text-on-action tokens.
import { useId, useState } from 'react';

import { useTranslations } from 'next-intl';

import { useCartContext, type CartPurchaseMode } from '@/components/providers';
import { cn } from '@/lib/utils';

interface GiftModeToggleProps {
  defaultMode?: CartPurchaseMode;
  onModeChange?: (mode: CartPurchaseMode) => void;
  className?: string;
  'data-testid'?: string;
}

export function GiftModeToggle({
  defaultMode = 'self',
  onModeChange,
  className,
  'data-testid': dataTestId = 'gift-mode-toggle'
}: GiftModeToggleProps) {
  const { purchaseMode, setPurchaseMode } = useCartContext();
  const t = useTranslations('pdp.gift_mode');
  const groupId = useId();
  const [mode, setMode] = useState<CartPurchaseMode>(purchaseMode ?? defaultMode);

  function handleSelect(next: CartPurchaseMode) {
    setMode(next);
    setPurchaseMode(next);
    onModeChange?.(next);
  }

  return (
    <div
      className={cn(
        'rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)] p-3',
        className
      )}
      role="radiogroup"
      aria-labelledby={`${groupId}-label`}
      data-testid={dataTestId}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bb-tint-accent-18)] text-[var(--cta-hover)]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect
              x="3"
              y="8"
              width="18"
              height="13"
              rx="1"
            />
            <path d="M3 8h18M12 21V8M12 8s-2.5-5-5-5-3 4 0 5h5z" />
            <path d="M12 8s2.5-5 5-5 3 4 0 5h-5z" />
          </svg>
        </span>
        <div>
          <p id={`${groupId}-label`} className="text-sm font-medium text-[var(--text-primary)]">{t('title')}</p>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">{t('description')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['self', 'gift'] as const).map(m => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleSelect(m)}
              role="radio"
              aria-checked={active}
              className={cn(
                'min-h-[44px] rounded-[var(--bb-radius-pill)] px-4 py-2 text-sm font-medium transition-colors duration-[var(--anim-duration-fast)]',
                active
                  ? 'bg-[var(--bg-action)] text-[var(--text-on-action)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {m === 'gift' ? t('gift') : t('self')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
