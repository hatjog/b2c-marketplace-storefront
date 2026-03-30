import Link from 'next/link';

import { TRUST_SIGNALS_MAX } from '@/lib/constants';

type TrustSignalsProps = {
  variant: 'full' | 'compact';
  signals: string[];
  detailsUrl?: string;
};

export function TrustSignals({ variant, signals, detailsUrl }: TrustSignalsProps) {
  if (!signals || signals.length === 0) {
    return null;
  }

  const capped = signals.slice(0, TRUST_SIGNALS_MAX);

  if (variant === 'compact') {
    return (
      <div role="region" aria-label="Gwarancje BonBeauty" className="inline-flex flex-wrap gap-x-3">
        {capped.map((signal, i) => (
          <span key={`signal-${i}`}>
            <span>✓</span>{' '}
            {/* TODO: replace with SanitizedHTML after Story 0.4 */}
            <span>{signal}</span>
            {i < capped.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Gwarancje BonBeauty"
      className="rounded bg-[var(--color-trust)] px-4 py-3"
    >
      {capped.map((signal, i) => (
        <div key={`signal-${i}`} className="flex items-center gap-1">
          <span>✓</span>
          {/* TODO: replace with SanitizedHTML after Story 0.4 */}
          <span>{signal}</span>
        </div>
      ))}
      {detailsUrl && (
        <div className="mt-2 text-right">
          <Link href={detailsUrl}>Szczegóły →</Link>
        </div>
      )}
    </div>
  );
}
