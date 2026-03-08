'use client';

import { Accordion, FilterCheckboxOption } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';

type Category = {
  id: string;
  name: string;
  handle: string;
};

type CategoryFilterProps = {
  heading: string;
  categories: Category[];
};

export const CategoryFilter = ({ heading, categories }: CategoryFilterProps) => {
  const { updateFilters, isFilterActive } = useFilters('category_handle');

  return (
    <Accordion
      heading={heading}
      data-testid="filter-category"
    >
      <ul
        className="px-4"
        data-testid="filter-category-options"
      >
        {categories.map(cat => (
          <li
            key={cat.id}
            className="mb-4"
          >
            <FilterCheckboxOption
              checked={isFilterActive(cat.handle)}
              onCheck={() => updateFilters(cat.handle)}
              label={cat.name}
              data-testid={`filter-category-checkbox-${cat.handle}`}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  );
};
