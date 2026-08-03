'use client';

import { Accordion, FilterCheckboxOption } from '@/components/molecules';
import useFilters from '@/hooks/useFilters';

type Tag = {
  id: string;
  value: string;
};

type TagFilterProps = {
  heading: string;
  tags: Tag[];
};

export const TagFilter = ({ heading, tags }: TagFilterProps) => {
  const { updateFilters, isFilterActive } = useFilters('tag_id');

  return (
    <Accordion
      heading={heading}
      data-testid="filter-tag"
    >
      <ul
        className="px-4"
        data-testid="filter-tag-options"
      >
        {tags.map(tag => (
          <li
            key={tag.id}
            className="mb-4"
          >
            <FilterCheckboxOption
              checked={isFilterActive(tag.id)}
              onCheck={() => updateFilters(tag.id)}
              label={tag.value}
              data-testid={`filter-tag-checkbox-${tag.id}`}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  );
};
