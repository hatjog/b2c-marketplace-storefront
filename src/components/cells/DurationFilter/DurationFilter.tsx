'use client';

import { Accordion, FilterCheckboxOption } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
];

type DurationFilterProps = {
  heading: string;
};

export const DurationFilter = ({ heading }: DurationFilterProps) => {
  const { updateFilters, isFilterActive } = useFilters('duration');

  return (
    <Accordion
      heading={heading}
      data-testid="filter-duration"
    >
      <ul
        className="px-4"
        data-testid="filter-duration-options"
      >
        {DURATION_OPTIONS.map(({ value, label }) => (
          <li
            key={value}
            className="mb-4"
          >
            <FilterCheckboxOption
              checked={isFilterActive(value)}
              onCheck={() => updateFilters(value)}
              label={label}
              data-testid={`filter-duration-checkbox-${value}`}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  );
};
