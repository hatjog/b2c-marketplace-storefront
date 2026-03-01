'use client';

import React, { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { Button, Chip, Input } from '@/components/atoms';
import { Accordion, FilterCheckboxOption, Modal } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';
import useGetAllSearchParams from '@/hooks/useGetAllSearchParams';
import useUpdateSearchParams from '@/hooks/useUpdateSearchParams';
import { cn } from '@/lib/utils';

import { ProductListingActiveFilters } from '../ProductListingActiveFilters/ProductListingActiveFilters';

export type FacetModel = {
  count: number;
  value: string;
  label: string;
};

export const AlgoliaProductSidebar = ({ facets }: { facets: Record<string, FacetModel[]> }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { allSearchParams } = useGetAllSearchParams();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile ? (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="mb-4 w-full uppercase"
      >
        Filters
      </Button>
      {isOpen && (
        <Modal
          heading="Filters"
          onClose={() => setIsOpen(false)}
        >
          <div className="px-4">
            <ProductListingActiveFilters />
            <PriceFilter
              defaultOpen={Boolean(allSearchParams.min_price || allSearchParams.max_price)}
            />
            <SizeFilter
              items={facets['variants.size']}
              defaultOpen={Boolean(allSearchParams.size)}
            />
            <ColorFilter
              items={facets['variants.color']}
              defaultOpen={Boolean(allSearchParams.color)}
            />
            <ConditionFilter
              items={facets['variants.condition']}
              defaultOpen={Boolean(allSearchParams.condition)}
            />
          </div>
        </Modal>
      )}
    </>
  ) : (
    <div>
      <PriceFilter />
      <SizeFilter items={facets['variants.size']} />
      <ColorFilter items={facets['variants.color']} />
      <ConditionFilter items={facets['variants.condition']} />
      {/* <RatingFilter /> */}
    </div>
  );
};

function ConditionFilter({
  defaultOpen = true,
  items
}: {
  defaultOpen?: boolean;
  items: FacetModel[];
}) {
  const { updateFilters, isFilterActive } = useFilters('condition');

  const selectHandler = (option: string) => {
    updateFilters(option);
  };
  return (
    <Accordion
      heading="Condition"
      defaultOpen={defaultOpen}
    >
      <ul className="px-4">
        {items &&
          Object.entries(items).map(([label, count]) => (
            <li
              key={label}
              className="mb-4"
            >
              <FilterCheckboxOption
                checked={isFilterActive(label)}
                disabled={Boolean(!count)}
                onCheck={selectHandler}
                label={label}
              />
            </li>
          ))}
      </ul>
    </Accordion>
  );
}

function ColorFilter({
  defaultOpen = true,
  items
}: {
  defaultOpen?: boolean;
  items: FacetModel[];
}) {
  const { updateFilters, isFilterActive } = useFilters('color');

  const selectHandler = (option: string) => {
    updateFilters(option);
  };
  return (
    <Accordion
      heading="Color"
      defaultOpen={defaultOpen}
    >
      <ul className="px-4">
        {items &&
          Object.entries(items).map(([label, count]) => (
            <li
              key={label}
              className="mb-4 flex items-center justify-between"
            >
              <FilterCheckboxOption
                checked={isFilterActive(label)}
                disabled={Boolean(!count)}
                onCheck={selectHandler}
                label={label}
              />
              <div
                style={{ backgroundColor: label.toLowerCase() }}
                className={cn(
                  'h-5 w-5 rounded-xs border border-primary',
                  Boolean(!label) && 'opacity-30'
                )}
              />
            </li>
          ))}
      </ul>
    </Accordion>
  );
}

function SizeFilter({ defaultOpen = true, items }: { defaultOpen?: boolean; items: FacetModel[] }) {
  const { updateFilters, isFilterActive } = useFilters('size');

  const selectSizeHandler = (size: string) => {
    updateFilters(size);
  };

  return (
    <Accordion
      heading="Size"
      defaultOpen={defaultOpen}
    >
      <ul className="mt-2 grid grid-cols-4 gap-2">
        {items &&
          Object.entries(items).map(([label]) => (
            <li
              key={label}
              className="mb-4"
            >
              <Chip
                selected={isFilterActive(label)}
                onSelect={() => selectSizeHandler(label)}
                value={label}
                className="w-full !justify-center !py-2 !font-normal"
              />
            </li>
          ))}
      </ul>
    </Accordion>
  );
}

function PriceFilter({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  const updateSearchParams = useUpdateSearchParams();
  const searchParams = useSearchParams();

  useEffect(() => {
    setMin(searchParams.get('min_price') || '');
    setMax(searchParams.get('max_price') || '');
  }, [searchParams]);

  const updateMinPriceHandler = (
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    updateSearchParams('min_price', min);
  };

  const updateMaxPriceHandler = (
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    updateSearchParams('max_price', max);
  };
  return (
    <Accordion
      heading="Price"
      defaultOpen={defaultOpen}
    >
      <div className="mb-4 flex gap-2">
        <form
          method="POST"
          onSubmit={updateMinPriceHandler}
        >
          <Input
            placeholder="Min"
            onChange={e => setMin(e.target.value)}
            value={min}
            onBlur={e => {
              setTimeout(() => {
                updateMinPriceHandler(e);
              }, 500);
            }}
            type="number"
            className="no-arrows-number-input"
          />
          <input
            type="submit"
            className="hidden"
          />
        </form>
        <form
          method="POST"
          onSubmit={updateMaxPriceHandler}
        >
          <Input
            placeholder="Max"
            onChange={e => setMax(e.target.value)}
            onBlur={e => {
              setTimeout(() => {
                updateMaxPriceHandler(e);
              }, 500);
            }}
            value={max}
            type="number"
            className="no-arrows-number-input"
          />
          <input
            type="submit"
            className="hidden"
          />
        </form>
      </div>
    </Accordion>
  );
}
