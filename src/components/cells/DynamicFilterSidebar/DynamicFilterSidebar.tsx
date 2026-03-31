'use client';

import { useTranslations } from 'next-intl';

import { filterEmptyOptions } from '@/lib/helpers/filter-utils';

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

type Category = { id: string; name: string; handle: string; count?: number };
type Tag = { id: string; value: string; count?: number };

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
          case 'category_group': {
            const filteredCategories = filterEmptyOptions(categories);
            if (!filteredCategories) return null;
            return (
              <CategoryFilter
                key={filter.type}
                heading={heading}
                categories={filteredCategories}
              />
            );
          }
          case 'tag_group': {
            const filteredTags = filterEmptyOptions(tags);
            if (!filteredTags) return null;
            return (
              <TagFilter
                key={`${filter.type}-${filter.tag_group ?? ''}`}
                heading={heading}
                tags={filteredTags}
              />
            );
          }
          case 'price_range':
            // always visible when range > 0 PLN (ADR-047)
            return <PriceFilter key={filter.type} />;
          case 'duration':
            // duration uses internal DEFAULT_DURATION_OPTIONS; visible per threshold rule
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
            // always visible — ADR-047: signals readiness for market expansion
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
