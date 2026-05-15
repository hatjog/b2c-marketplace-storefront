// W1-01 Home v3 — Gift CTA card.
// BonBeauty DS v2.1.0: cta, bb-radius-card, bb-soft-gradient tokens.
// Story 3.0 Sprint 1 thin slice gate.

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

interface GiftCTACardBlockProps {
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  locale: string;
}

export function GiftCTACardBlock({
  heading = 'Podaruj wyjątkowy moment',
  body = 'Vouchery na zabiegi beauty — idealny prezent dla bliskich. Realizuj w ponad 200 salonach w Polsce.',
  ctaLabel = 'Kup voucher',
  ctaHref = '/categories/prezenty',
  locale,
}: GiftCTACardBlockProps) {
  return (
    <section
      className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8"
      data-testid="gift-cta-card"
      aria-label="Vouchery prezentowe"
    >
      <div
        className="flex flex-col items-center gap-6 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] p-8 text-center md:flex-row md:text-left lg:p-12"
        style={{ background: 'var(--bb-soft-gradient)' }}
      >
        <div className="flex-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cta)]">
            Prezenty
          </p>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
            {heading}
          </h2>
          <p className="text-base text-[var(--text-secondary)]">{body}</p>
        </div>
        <LocalizedClientLink
          href={ctaHref}
          className="inline-flex shrink-0 items-center rounded-[var(--bb-radius-pill)] bg-[var(--bg-action)] px-8 py-3 text-sm font-semibold text-[var(--text-on-action)] transition-colors hover:bg-[var(--bg-action-hover)]"
          data-testid="gift-cta-button"
        >
          {ctaLabel}
        </LocalizedClientLink>
      </div>
    </section>
  );
}
