'use client';

import { useTranslations } from 'next-intl';

import useFilters from '@/hooks/useFilters';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export function CategoryPlpNoResults() {
  const t = useTranslations('category_plp');
  const { clearAllFilters } = useFilters('');

  return (
    <section
      className="bb-section-shell bb-section-shell-soft mx-auto flex max-w-[520px] flex-col items-center gap-4 py-8 text-center"
      role="status"
      aria-live="polite"
      data-testid="category-plp-no-results"
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--bb-tint-gold-22)] bg-[var(--bb-muted-35)]"
        aria-hidden="true"
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 17L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.5 13.5L13.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="heading-md">{t('empty_heading')}</h3>
      <p className="text-sm text-secondary">{t('empty_body')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={clearAllFilters}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-action px-5 py-2 text-sm font-medium text-action-on-primary transition-colors hover:bg-action-hover"
          data-testid="category-plp-no-results-clear"
        >
          {t('clear_filters')}
        </button>
        <LocalizedClientLink
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--bb-tint-gold-24)] px-5 py-2 text-sm font-medium text-primary"
          data-testid="category-plp-no-results-editorial"
        >
          {t('editorial_cta')}
        </LocalizedClientLink>
      </div>
    </section>
  );
}
