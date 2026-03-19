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
      className="relative w-full"
      data-testid="sidebar"
    >
      <Button
        className="label-sm mb-4 w-full uppercase block md:hidden"
        variant="tonal"
        onClick={() => setFilterModal(true)}
        data-testid="sidebar-open-filters-button"
      >
        {t('filters')}
      </Button>
      <div
        className={cn(
          'left-0 top-0 h-full w-full bg-primary transition-opacity duration-100 pointer-events-none blur-sm md:pointer-events-auto md:blur-none md:relative',
          filterModal ? 'opacity-1 z-20 pointer-events-auto blur-none' : '-z-10 opacity-0 md:z-10 md:opacity-100'
        )}
      >
        {filterModal && (
          <div className="md:hidden">
            <div
              className="mb-4 flex items-center justify-between border-y p-4"
              data-testid="sidebar-filter-header"
            >
              <h3 className="heading-md uppercase">{t('filters')}</h3>
              <div
                onClick={() => setFilterModal(false)}
                className="cursor-pointer"
                data-testid="sidebar-close-button"
              >
                <CloseIcon size={20} />
              </div>
            </div>
            <div className="mb-4 px-2 md:mb-0">
              <ProductListingActiveFilters />
            </div>
          </div>
        )}

        <div
          className="no-scrollbar h-[calc(100vh-200px)] overflow-y-scroll px-2 md:h-full md:overflow-y-auto md:px-0"
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
          className="absolute bottom-0 left-0 flex w-full items-center gap-2 border-y bg-primary px-4 py-4 md:hidden"
          data-testid="sidebar-actions"
        >
          <Button
            className="label-sm w-1/2 uppercase"
            variant="tonal"
            onClick={() => clearAllFilters()}
            data-testid="sidebar-clear-all-button"
          >
            {t('clear_all')}
          </Button>
          <Button
            className="label-sm w-1/2 uppercase"
            onClick={() => setFilterModal(false)}
            data-testid="sidebar-view-listings-button"
          >
            {t('view_results')}
          </Button>
        </div>
      </div>
    </aside>
  );
};
