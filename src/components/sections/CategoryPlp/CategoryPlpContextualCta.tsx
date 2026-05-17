import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

type CategoryPlpContextualCtaProps = {
  label: string;
};

export function CategoryPlpContextualCta({ label }: CategoryPlpContextualCtaProps) {
  return (
    <div className="bb-section-shell bb-section-shell-soft" data-testid="category-plp-contextual-cta">
      <LocalizedClientLink
        href="/"
        className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(144,112,50,0.24)] px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-[rgba(239,229,210,0.35)]"
        data-testid="category-plp-contextual-cta-link"
      >
        {label}
      </LocalizedClientLink>
    </div>
  );
}
