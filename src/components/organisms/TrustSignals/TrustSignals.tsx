'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { SanitizedHTML } from '@/components/molecules';
import { TRUST_SIGNALS_MAX } from '@/lib/constants';

type TrustSignalsProps = {
  variant: 'full' | 'compact';
  signals: string[];
  detailsUrl?: string;
};

export function TrustSignals({ variant, signals, detailsUrl }: TrustSignalsProps) {
  const t = useTranslations('trust_signals');

  if (!signals || signals.length === 0) {
    return null;
  }

  const capped = signals.slice(0, TRUST_SIGNALS_MAX);

  if (variant === 'compact') {
    return (
      <div role="region" aria-label={t('aria_label')} className="inline-flex flex-wrap gap-2">
        {capped.map((signal, i) => (
          <span key={`signal-${i}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-muted-72)] px-3 py-1 text-[13px] text-primary">
            <span>✓</span>{' '}
            <SanitizedHTML html={signal} className="inline" />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={t('aria_label')}
      className="bb-section-shell h-full space-y-3 border-[var(--bb-trust-tint-10)] bg-[var(--bb-trust-card-bg)]"
    >
      {capped.map((signal, i) => (
        <div key={`signal-${i}`} className="flex items-start gap-2 text-primary">
          <span className="mt-0.5 text-[var(--color-trust)]">✓</span>
          <SanitizedHTML html={signal} className="inline" />
        </div>
      ))}
      {detailsUrl && (
        <div className="mt-2 text-right">
          <Link href={detailsUrl} className="label-md text-[var(--cta)] underline underline-offset-4">
            {t('details_cta')}
          </Link>
        </div>
      )}
    </div>
  );
}
