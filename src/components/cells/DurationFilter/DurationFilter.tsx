'use client';

import { Accordion, FilterCheckboxOption } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';

const DEFAULT_DURATION_OPTIONS = [30, 45, 60, 90];

type DurationFilterProps = {
  heading: string;
  durationOptions?: number[];
};

export const DurationFilter = ({ heading, durationOptions }: DurationFilterProps) => {
  const { updateFilters, isFilterActive } = useFilters('duration');

  const options = (durationOptions ?? DEFAULT_DURATION_OPTIONS).map(minutes => ({
    value: String(minutes),
    label: `${minutes} min`
  }));

  return (
    <Accordion
      heading={heading}
      data-testid="filter-duration"
    >
      <ul
        className="px-4"
        data-testid="filter-duration-options"
      >
        {options.map(({ value, label }) => (
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
