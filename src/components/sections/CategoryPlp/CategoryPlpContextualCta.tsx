import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

type CategoryPlpContextualCtaProps = {
  label: string;
};

export function CategoryPlpContextualCta({ label }: CategoryPlpContextualCtaProps) {
  return (
    <div className="bb-section-shell bb-section-shell-soft" data-testid="category-plp-contextual-cta">
      <LocalizedClientLink
        href="/"
        className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--bb-tint-gold-24)] px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-[var(--bb-muted-35)]"
        data-testid="category-plp-contextual-cta-link"
      >
        {label}
      </LocalizedClientLink>
    </div>
  );
}
