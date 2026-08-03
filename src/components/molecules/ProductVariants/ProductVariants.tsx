'use client';

import type { HttpTypes } from '@medusajs/types';
import { useTranslations } from 'next-intl';

import { Chip } from '@/components/atoms';
import useUpdateSearchParams from '@/hooks/useUpdateSearchParams';

function optionLabel(title: string, t: (key: 'size' | 'duration' | 'package') => string) {
  const normalized = title.trim().toLowerCase();

  if (normalized === 'size' || normalized === 'rozmiar') return t('size');
  if (normalized === 'duration' || normalized === 'czas trwania') return t('duration');
  if (normalized === 'pakiet' || normalized === 'package' || normalized === 'bundle')
    return t('package');

  return title;
}

// Medusa requires every product to carry at least one option + value, so
// single-variant products (most of the imported catalog) get a synthetic
// placeholder option titled "Default" with a single "Default" value. That has
// no merchandising meaning and rendered as a dead "Default: Default" selector
// on the PDP — hide it. A real option (Size/Color/Denomination…) or any option
// offering an actual choice (>1 value) is always kept.
const SYNTHETIC_DEFAULT_OPTION_TITLES = new Set(['default', 'default option']);

function isSyntheticDefaultOption(option: HttpTypes.StoreProductOption): boolean {
  const normalizedTitle = option.title?.trim().toLowerCase() ?? '';
  if (!SYNTHETIC_DEFAULT_OPTION_TITLES.has(normalizedTitle)) return false;
  return (option.values?.length ?? 0) <= 1;
}

/**
 * True when the product has at least one real (non-synthetic-default) variant
 * option worth rendering. Single-variant products (only the synthetic "Default"
 * option) return false — callers must NOT render the variant-selector wrapper,
 * otherwise an empty muted card renders on the PDP (v1.12.0 chrome fix). Mirrors
 * the `visibleOptions` guard below so the SSOT for "has variants" lives here.
 */
export function hasVisibleVariantOptions(product: HttpTypes.StoreProduct): boolean {
  return (product.options || []).some(option => !isSyntheticDefaultOption(option));
}

export const ProductVariants = ({
  product,
  selectedVariant
}: {
  product: HttpTypes.StoreProduct;
  selectedVariant: Record<string, string>;
}) => {
  const updateSearchParams = useUpdateSearchParams();
  const t = useTranslations('pdp.variants');

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    if (value) updateSearchParams(optionId, value);
  };

  const visibleOptions = (product.options || []).filter(
    option => !isSyntheticDefaultOption(option)
  );

  // Single-variant product (only the synthetic "Default" option) → no selector.
  if (visibleOptions.length === 0) return null;

  return (
    <div
      className="my-4 space-y-2"
      data-testid="product-variants"
    >
      {visibleOptions.map(({ id, title, values }: HttpTypes.StoreProductOption) => (
        <div
          key={id}
          data-testid={`product-variant-${title.toLowerCase()}`}
        >
          <span className="label-md text-secondary">{optionLabel(title, t)}: </span>
          <span
            className="label-md text-primary"
            data-testid={`product-variant-selected-${title.toLowerCase()}`}
          >
            {selectedVariant[title.toLowerCase()]}
          </span>
          <div
            className="mt-2 flex gap-2"
            data-testid={`product-variant-options-${title.toLowerCase()}`}
          >
            {(values || []).map(({ id, value }: Partial<HttpTypes.StoreProductOptionValue>) => (
              <Chip
                key={id}
                selected={selectedVariant[title.toLowerCase()] === value}
                color={title === 'Color'}
                value={value}
                onSelect={() => setOptionValue(title.toLowerCase(), value || '')}
                data-testid={`product-variant-chip-${title.toLowerCase()}-${value?.toLowerCase().replace(/\s+/g, '-')}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
