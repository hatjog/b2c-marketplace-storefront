// W1-01 Home v3 — Trust strip with <VerifiedMark.
// Trust Invariant #1: <VerifiedMark must appear on home surface once @trust-invariant-scope: v180 is set.
// BonBeauty DS v2.1.0: color-trust, bb-surface, bb-border-hairline tokens.
// Story 3.0 Sprint 1 thin slice gate.

import { VerifiedMark } from '@/components/atoms/VerifiedMark/VerifiedMark';

interface TrustPoint {
  icon: string;
  text: string;
}

interface TrustStripBlockProps {
  verifiedLabel?: string;
  trustPoints?: TrustPoint[];
}

const DEFAULT_TRUST_POINTS: TrustPoint[] = [
  { icon: '🏅', text: '200+ zweryfikowanych salonów' },
  { icon: '⭐', text: '4.8 średnia ocena' },
  { icon: '🔒', text: 'Bezpieczna płatność' },
  { icon: '↩', text: 'Zwrot w 14 dni' },
];

export function TrustStripBlock({
  verifiedLabel = 'Zweryfikowana platforma',
  trustPoints = DEFAULT_TRUST_POINTS,
}: TrustStripBlockProps) {
  return (
    <section
      className="border-y border-[var(--bb-border-hairline,var(--bb-border-soft))] bg-[var(--bb-surface)] py-5"
      data-testid="trust-strip"
      aria-label="Gwarancje platformy"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {/* Trust Invariant #1: <VerifiedMark on home surface */}
          <VerifiedMark
            label={verifiedLabel}
            surface="page"
            data-testid="home-verified-mark"
          />
          {trustPoints.map((point) => (
            <span
              key={point.text}
              className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]"
            >
              <span aria-hidden="true">{point.icon}</span>
              <span>{point.text}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
