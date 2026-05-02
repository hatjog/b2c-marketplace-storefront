'use client';

import { useId, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Story 5.8 — PurchaseModeToggle molecule.
 *
 * Buyer Marta self-purchase mode default per FR67 + FR68.
 *
 * AC mappings:
 *   AC1 — molecule component authored ('use client', controlled props,
 *         2 radio cards, data-testid hooks).
 *   AC2 — default mode = 'self' (parent passes URL-resolved value;
 *         component never silently mutates).
 *   AC3 — gift placeholder is rendered by the PARENT (cart/checkout page);
 *         the molecule only emits `onChange` so state stays single-source.
 *   AC6 — every visible string from `seller.checkout.*` namespace.
 *
 * Implementation notes:
 *   - Pure controlled component — parent owns state for URL param sync.
 *   - <fieldset>/<legend> wraps native radios for keyboard a11y baseline
 *     (mirrors Story 5.2 SellerSelector semantic grouping).
 *   - Tailwind `accent-action` re-uses Story 5.2 SellerSelector token wzorzec.
 *   - NIE owns gift recipient form — Epic 6 territory (Story 6.x); parent
 *     renders a static placeholder card while v1.6.0 ships mode-toggle UX
 *     foundation only.
 */

export type PurchaseMode = 'self' | 'gift';

export interface PurchaseModeToggleProps {
  mode: PurchaseMode;
  onChange: (mode: PurchaseMode) => void;
  className?: string;
}

export function PurchaseModeToggle({
  mode,
  onChange,
  className
}: PurchaseModeToggleProps): ReactElement {
  const t = useTranslations('seller.checkout');
  const groupId = useId();

  const options: Array<{
    value: PurchaseMode;
    titleKey: 'mode_self' | 'mode_gift';
    descKey: 'mode_self_description' | 'mode_gift_description';
  }> = [
    { value: 'self', titleKey: 'mode_self', descKey: 'mode_self_description' },
    { value: 'gift', titleKey: 'mode_gift', descKey: 'mode_gift_description' }
  ];

  return (
    <fieldset
      data-testid="purchase-mode-toggle"
      className={`flex flex-col gap-3 ${className ?? ''}`.trim()}
    >
      <legend className="heading-sm mb-2 font-medium">
        {t('purchase_mode_label')}
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-legend`}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {options.map((opt) => {
          const checked = mode === opt.value;
          return (
            <label
              key={opt.value}
              data-testid={`purchase-mode-option-${opt.value}`}
              data-checked={checked ? 'true' : 'false'}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors ${
                checked
                  ? 'border-action bg-action/5'
                  : 'border-component-secondary hover:border-tertiary'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`purchase-mode-${groupId}`}
                  value={opt.value}
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                  className="size-4 accent-action"
                  data-testid={`purchase-mode-input-${opt.value}`}
                />
                <span className="text-base font-medium">{t(opt.titleKey)}</span>
              </span>
              <span className="text-sm text-tertiary">{t(opt.descKey)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
