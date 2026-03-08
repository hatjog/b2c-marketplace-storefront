'use client';

import { Accordion, FilterCheckboxOption } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';

type LocationFilterProps = {
  heading: string;
  cities: string[];
};

// Location filter is always visible even with 0 or 1 cities (ADR-047 UX decision)
export const LocationFilter = ({ heading, cities }: LocationFilterProps) => {
  const { updateFilters, isFilterActive } = useFilters('city');

  return (
    <Accordion
      heading={heading}
      data-testid="filter-location"
    >
      <ul
        className="px-4"
        data-testid="filter-location-options"
      >
        {cities.map(city => (
          <li
            key={city}
            className="mb-4"
          >
            <FilterCheckboxOption
              checked={isFilterActive(city)}
              onCheck={() => updateFilters(city)}
              label={city}
              data-testid={`filter-location-checkbox-${city.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  );
};
