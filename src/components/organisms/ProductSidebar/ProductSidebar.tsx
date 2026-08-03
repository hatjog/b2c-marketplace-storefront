'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { DynamicFilterSidebar, type StorefrontFilterConfig } from '@/components/cells/DynamicFilterSidebar/DynamicFilterSidebar';
import { ProductListingActiveFilters } from '../ProductListingActiveFilters/ProductListingActiveFilters';
import useFilters from '@/hooks/useFilters';
import { CloseIcon } from '@/icons';
import { cn } from '@/lib/utils';

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };

type ProductSidebarProps = {
  filters?: StorefrontFilterConfig[];
  categories?: Category[];
  tags?: Tag[];
  cities?: string[];
};

export const ProductSidebar = ({
  filters = [],
  categories = [],
  tags = [],
  cities = []
}: ProductSidebarProps) => {
  const [filterModal, setFilterModal] = useState(false);
  const { clearAllFilters } = useFilters('');
  const t = useTranslations('filters');

  return (
    <aside
      className="relative w-full lg:sticky lg:top-6 lg:self-start"
      data-testid="sidebar"
    >
      <Button
        className="label-sm mb-4 block w-full rounded-full uppercase md:hidden"
        variant="tonal"
        onClick={() => setFilterModal(true)}
        data-testid="sidebar-open-filters-button"
      >
        {t('filters')}
      </Button>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 px-4 py-6 opacity-0 pointer-events-none transition-opacity duration-150 md:static md:bg-transparent md:p-0 md:opacity-100 md:pointer-events-auto',
          filterModal ? 'opacity-100 pointer-events-auto' : 'md:opacity-100 md:pointer-events-auto'
        )}
      >
        <div className="bb-section-shell bb-section-shell-strong relative h-full max-h-[100vh] overflow-hidden md:h-auto md:max-h-none">
          {filterModal && (
            <div className="md:hidden">
              <div
                className="mb-4 flex items-center justify-between border-b border-[var(--bb-border-soft)] pb-4"
                data-testid="sidebar-filter-header"
              >
                <h3 className="heading-md">{t('filters')}</h3>
                <div
                  onClick={() => setFilterModal(false)}
                  className="cursor-pointer"
                  data-testid="sidebar-close-button"
                >
                  <CloseIcon size={20} />
                </div>
              </div>
              <div className="mb-4">
                <ProductListingActiveFilters />
              </div>
            </div>
          )}

          <div
            className="no-scrollbar h-[calc(100vh-210px)] overflow-y-auto md:h-auto"
            data-testid="sidebar-filters"
          >
            <DynamicFilterSidebar
              filters={filters}
              categories={categories}
              tags={tags}
              cities={cities}
            />
          </div>

          <div
            className="mt-4 flex w-full items-center gap-2 border-t border-[var(--bb-border-soft)] pt-4 md:hidden"
            data-testid="sidebar-actions"
          >
            <Button
              className="label-sm w-1/2 rounded-full uppercase"
              variant="tonal"
              onClick={() => clearAllFilters()}
              data-testid="sidebar-clear-all-button"
            >
              {t('clear_all')}
            </Button>
            <Button
              className="label-sm w-1/2 rounded-full uppercase bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
              onClick={() => setFilterModal(false)}
              data-testid="sidebar-view-listings-button"
            >
              {t('view_results')}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
