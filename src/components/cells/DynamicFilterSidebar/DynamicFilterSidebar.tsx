'use client';

import { useTranslations } from 'next-intl';

import { CategoryFilter } from '../CategoryFilter/CategoryFilter';
import { DurationFilter } from '../DurationFilter/DurationFilter';
import { LocationFilter } from '../LocationFilter/LocationFilter';
import { PriceFilter } from '../PriceFilter/PriceFilter';
import { SellerRatingFilter } from '../SellerRatingFilter/SellerRatingFilter';
import { TagFilter } from '../TagFilter/TagFilter';

export type StorefrontFilterConfig = {
  type: 'category_group' | 'tag_group' | 'price_range' | 'duration' | 'seller_rating' | 'location';
  label_key: string;
  source?: string;
  tag_group?: string;
  display?: string;
};

type Category = { id: string; name: string; handle: string };
type Tag = { id: string; value: string };

type DynamicFilterSidebarProps = {
  filters: StorefrontFilterConfig[];
  categories?: Category[];
  tags?: Tag[];
  cities?: string[];
};

export const DynamicFilterSidebar = ({
  filters,
  categories = [],
  tags = [],
  cities = []
}: DynamicFilterSidebarProps) => {
  const t = useTranslations('filters') as (key: string) => string;

  if (filters.length === 0) {
    return null;
  }

  return (
    <div data-testid="dynamic-filter-sidebar">
      {filters.map(filter => {
        // label_key format: "filters.category" → strip "filters." prefix for t()
        const msgKey = filter.label_key.startsWith('filters.')
          ? filter.label_key.slice('filters.'.length)
          : filter.label_key;
        const heading: string = t(msgKey) ?? msgKey;

        switch (filter.type) {
          case 'category_group':
            return (
              <CategoryFilter
                key={filter.type}
                heading={heading}
                categories={categories}
              />
            );
          case 'tag_group':
            return (
              <TagFilter
                key={`${filter.type}-${filter.tag_group ?? ''}`}
                heading={heading}
                tags={tags}
              />
            );
          case 'price_range':
            return <PriceFilter key={filter.type} />;
          case 'duration':
            return (
              <DurationFilter
                key={filter.type}
                heading={heading}
              />
            );
          case 'seller_rating':
            return (
              <SellerRatingFilter
                key={filter.type}
                heading={heading}
              />
            );
          case 'location':
            return (
              <LocationFilter
                key={filter.type}
                heading={heading}
                cities={cities}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};
