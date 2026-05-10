'use client';

/**
 * ClearFiltersButton — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Replaced raw Mercur stock class (rounded-md border border-input bg-background
 *     hover:bg-accent) with BonBeauty token-bound classes (rounded-sm bg-action
 *     text-action-on-primary hover:bg-action-hover).
 *   - Added aria-live="polite" status announcement when filters are cleared
 *     per UX-DR20 ("cleared state must announce the reset to assistive tech").
 *   - Status region announces "Filtry wyczyszczone" via sr-only live region.
 *   - min-h-[44px] touch target preserved per UX-DR21 (≥44×44px).
 */

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import useFilters from '@/hooks/useFilters';

export const ClearFiltersButton = () => {
  const t = useTranslations('filters');
  const tDiscovery = useTranslations('category');
  const { clearAllFilters } = useFilters('');
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    clearAllFilters();
    setCleared(true);
    // Reset after announcement has been read by SR
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <>
      {/* Polite live region — announces filter clear to assistive tech per UX-DR20 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="filters-cleared-status"
      >
        {cleared ? tDiscovery('filters_cleared') : ''}
      </div>
      <button
        type="button"
        onClick={handleClear}
        aria-label={t('clear_all')}
        className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-action bg-transparent px-4 py-2 text-sm font-medium text-action transition-colors hover:bg-action hover:text-action-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        data-testid="clear-filters-button"
      >
        {t('clear_all')}
      </button>
    </>
  );
};
