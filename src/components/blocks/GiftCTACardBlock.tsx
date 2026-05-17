// W1-01 Home v3 — Gift CTA card.
// BonBeauty DS v2.1.0: cta, bb-radius-card, bb-soft-gradient tokens.
// Story 3.0 Sprint 1 thin slice gate.
import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

interface GiftCTACardBlockProps {
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  locale: string;
}

export async function GiftCTACardBlock({
  heading,
  body,
  ctaLabel,
  ctaHref,
  locale,
}: GiftCTACardBlockProps) {
  const t = await getTranslations({ locale, namespace: 'home_v3.gift_cta' });
  const resolvedHeading = heading ?? t('heading');
  const resolvedBody = body ?? t('body');
  const resolvedCtaLabel = ctaLabel ?? t('cta_label');
  const resolvedCtaHref = ctaHref ?? '/categories?mode=gift';

  return (
    <section
      className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8"
      data-testid="gift-cta-card"
      aria-label={t('aria_label')}
    >
      <div
        className="flex flex-col items-center gap-6 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] p-8 text-center md:flex-row md:text-left lg:p-12"
        style={{ background: 'var(--bb-soft-gradient)' }}
      >
        <div className="flex-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cta)]">
            {t('eyebrow')}
          </p>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
            {resolvedHeading}
          </h2>
          <p className="text-base text-[var(--text-secondary)]">{resolvedBody}</p>
        </div>
        <LocalizedClientLink
          href={resolvedCtaHref}
          className="inline-flex shrink-0 items-center rounded-[var(--bb-radius-pill)] bg-[var(--bg-action)] px-8 py-3 text-sm font-semibold text-[var(--text-on-action)] transition-colors hover:bg-[var(--bg-action-hover)]"
          data-testid="gift-cta-button"
        >
          {resolvedCtaLabel}
        </LocalizedClientLink>
      </div>
    </section>
  );
}
