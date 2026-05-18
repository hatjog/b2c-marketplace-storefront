'use client';

// VoucherRulesCard — Trust Presence Invariant #3.
// Collapsed by default; expand action shows TTL + extension + cancellation + refund + no-show policy.
// validator: _grow/tools/validate_trust_invariant_voucher_rules.py
// Required token: <VoucherRulesCard

import { useState } from 'react';

import { buildVoucherRulesDisplay, type VoucherRulesData } from '@/lib/voucher/voucher-rules';
import { cn } from '@/lib/utils';

interface VoucherRulesCardProps {
  /** Voucher validity in days */
  ttlDays?: number;
  extensionPolicy?: string;
  cancellationPolicy?: string;
  refundChannel?: string;
  noShowPolicy?: string;
  rules?: VoucherRulesData | null;
  locale?: string;
  defaultOpen?: boolean;
  className?: string;
  'data-testid'?: string;
}

const CHEVRON_DOWN = (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHEVRON_UP = (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
    <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function VoucherRulesCard({
  ttlDays = 365,
  extensionPolicy = 'Możliwość jednorazowego przedłużenia ważności o 90 dni',
  cancellationPolicy = 'Anulowanie do 24h przed umówionym terminem',
  refundChannel = 'Zwrot na kartę lub portfel BonBeauty do 14 dni',
  noShowPolicy = 'Pierwsza nieobecność — ostrzeżenie; druga — brak zwrotu',
  rules,
  locale = 'pl',
  defaultOpen = false,
  className,
  'data-testid': dataTestId = 'voucher-rules-card',
}: VoucherRulesCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const display = buildVoucherRulesDisplay(
    rules ?? {
      validityMonths: Math.max(1, Math.round(ttlDays / 30)),
      extension: {
        allowed: true,
        paid: false,
        feePct: null,
        maxExtensionMonths: 3,
      },
      cancellation: cancellationPolicy,
      refundChannel,
      noShow: noShowPolicy,
    },
    locale,
  );

  return (
    <div
      className={cn(
        'rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)]',
        className
      )}
      data-testid={dataTestId}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
      >
        <span>{display.heading}</span>
        {open ? CHEVRON_UP : CHEVRON_DOWN}
      </button>

      {open && (
        <div className="border-t border-[var(--bb-border-hairline,var(--bb-border-soft))] px-4 pb-4 pt-3 space-y-2 text-xs text-[var(--text-secondary)]">
          <div>
            <p className="text-[var(--text-primary)]">{display.summary}</p>
          </div>
          <div>
            <span className="font-medium text-[var(--text-primary)]">{display.validityLabel}:</span>{' '}
            {display.validity}
          </div>
          <div>
            <span className="font-medium text-[var(--text-primary)]">{display.extensionLabel}:</span>{' '}
            {rules ? display.extension : extensionPolicy}
          </div>
          <div>
            <span className="font-medium text-[var(--text-primary)]">{display.cancellationLabel}:</span>{' '}
            {rules ? display.cancellation : cancellationPolicy}
          </div>
          <div>
            <span className="font-medium text-[var(--text-primary)]">{display.refundLabel}:</span>{' '}
            {rules ? display.refundChannel : refundChannel}
          </div>
          <div>
            <span className="font-medium text-[var(--text-primary)]">{display.noShowLabel}:</span>{' '}
            {rules ? display.noShow : noShowPolicy}
          </div>
        </div>
      )}
    </div>
  );
}
