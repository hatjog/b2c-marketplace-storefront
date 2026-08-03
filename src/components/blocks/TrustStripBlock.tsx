// W1-01 Home v3 — Trust strip with <VerifiedMark.
// Trust Invariant #1: <VerifiedMark must appear on home surface once @trust-invariant-scope: v180 is set.
// BonBeauty DS v2.1.0: color-trust, bb-surface, bb-border-hairline tokens.
// Story 3.0 Sprint 1 thin slice gate.
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { VerifiedMark } from '@/components/atoms/VerifiedMark/VerifiedMark';
import { AwardIcon, StarIcon, LockIcon } from '@/icons';

interface TrustPoint {
  icon: ReactNode;
  text: string;
}

interface TrustStripBlockProps {
  locale?: string;
  verifiedLabel?: string;
  trustPoints?: TrustPoint[];
}

function buildDefaultTrustPoints(t: Awaited<ReturnType<typeof getTranslations>>): TrustPoint[] {
  return [
    { icon: <AwardIcon className="h-4 w-4" color="currentColor" />, text: t('trust_strip.points.1') },
    { icon: <StarIcon className="h-4 w-4" color="currentColor" />, text: t('trust_strip.points.2') },
    { icon: <LockIcon className="h-4 w-4" color="currentColor" />, text: t('trust_strip.points.3') },
    { icon: <span aria-hidden="true">↩</span>, text: t('trust_strip.points.4') },
  ];
}

export async function TrustStripBlock({
  locale,
  verifiedLabel,
  trustPoints,
}: TrustStripBlockProps) {
  const t = await getTranslations({ locale, namespace: 'home_v3' });
  const resolvedVerifiedLabel = verifiedLabel ?? t('trust_strip.verified_label');
  const resolvedTrustPoints = trustPoints ?? buildDefaultTrustPoints(t);

  return (
    <section
      className="border-y border-[var(--bb-border-hairline,var(--bb-border-soft))] bg-[var(--bb-surface)] py-5"
      data-testid="trust-strip"
      aria-label={t('trust_strip.aria_label')}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {/* Trust Invariant #1: <VerifiedMark on home surface */}
          <VerifiedMark
            label={resolvedVerifiedLabel}
            surface="page"
            data-testid="home-verified-mark"
          />
          {resolvedTrustPoints.map((point) => (
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
