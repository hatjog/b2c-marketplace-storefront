interface CategoriesHeroProps {
  breadcrumbsHome: string
  breadcrumbsCurrent: string
  breadcrumbsAriaLabel: string
  eyebrow: string
  title: string
  intro: string
}

export function CategoriesHero({
  breadcrumbsHome,
  breadcrumbsCurrent,
  breadcrumbsAriaLabel,
  eyebrow,
  title,
  intro,
}: CategoriesHeroProps) {
  return (
    <section
      className="rounded-md border border-primary/10 bg-component px-4 py-6 md:px-6 md:py-8"
      data-testid="categories-hero"
    >
      <nav className="mb-3 flex items-center gap-2 text-sm text-secondary" aria-label={breadcrumbsAriaLabel}>
        <span>{breadcrumbsHome}</span>
        <span aria-hidden="true">/</span>
        <span>{breadcrumbsCurrent}</span>
      </nav>

      <p className="label-sm uppercase tracking-[0.08em] text-secondary">{eyebrow}</p>
      <h1 className="heading-xl mt-2">{title}</h1>
      <p className="text-md mt-3 max-w-4xl text-secondary">{intro}</p>
    </section>
  )
}
