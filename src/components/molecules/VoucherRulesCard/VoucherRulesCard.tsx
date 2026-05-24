'use client';

// VoucherRulesCard — Trust Presence Invariant #3.
// validator: _grow/tools/validate_trust_invariant_voucher_rules.py
// Required token: <VoucherRulesCard
import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface VoucherRulesCardProps {
  validityMonths?: number;
  usageConditions?: string[];
  refundPolicy?: string;
  cancellationPolicy?: string;
  extensionPolicy?: string;
  noShowPolicy?: string;
  defaultOpen?: boolean;
  className?: string;
  'data-testid'?: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('h-4 w-4 transition-transform duration-200', open ? 'rotate-180' : '')}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RuleRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bb-tint-accent-18)] text-[var(--cta-hover)]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      </div>
    </div>
  );
}

export function VoucherRulesCard({
  validityMonths = 12,
  usageConditions,
  refundPolicy,
  cancellationPolicy,
  extensionPolicy,
  noShowPolicy,
  defaultOpen = false,
  className,
  'data-testid': dataTestId = 'voucher-rules-card'
}: VoucherRulesCardProps) {
  const t = useTranslations('pdp.voucher_rules');
  const [open, setOpen] = useState(defaultOpen);
  const resolvedUsageConditions =
    usageConditions && usageConditions.length > 0 ? usageConditions : [t('usage_body')];

  return (
    <section
      className={cn(
        'rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-75)] shadow-[var(--bb-shadow-soft)]',
        className
      )}
      data-testid={dataTestId}
      aria-label={t('aria_label')}
    >
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={`${dataTestId}-panel`}
        className="flex min-h-[56px] w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)]"
      >
        <span>
          <span className="block text-sm font-medium">{t('title')}</span>
          <span className="block text-xs font-normal leading-5 text-[var(--text-secondary)]">
            {t('summary', { months: validityMonths })}
          </span>
        </span>
        <Chevron open={open} />
      </button>

      <div
        id={`${dataTestId}-panel`}
        hidden={!open}
        className="space-y-4 border-t border-[var(--bb-border-hairline,var(--bb-border-soft))] px-4 pb-4 pt-4"
      >
        <RuleRow
          title={t('validity_title', { months: validityMonths })}
          body={t('validity_body')}
        />
        <RuleRow
          title={t('usage_title')}
          body={resolvedUsageConditions.join(' ')}
        />
        <RuleRow
          title={t('refund_title')}
          body={refundPolicy ?? t('refund_body')}
        />
        <RuleRow
          title={t('cancellation_title')}
          body={cancellationPolicy ?? t('cancellation_body')}
        />
        <RuleRow
          title={t('extension_title')}
          body={extensionPolicy ?? t('extension_body')}
        />
        <RuleRow
          title={t('no_show_title')}
          body={noShowPolicy ?? t('no_show_body')}
        />
      </div>
    </section>
  );
}
