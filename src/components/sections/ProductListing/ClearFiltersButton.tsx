'use client';

import { useTranslations } from 'next-intl';

import useFilters from '@/hooks/useFilters';

export const ClearFiltersButton = () => {
  const t = useTranslations('filters');
  const { clearAllFilters } = useFilters('');

  return (
    <button
      onClick={clearAllFilters}
      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
      data-testid="clear-filters-button"
    >
      {t('clear_all')}
    </button>
  );
};
