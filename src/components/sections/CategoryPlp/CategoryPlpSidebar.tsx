'use client';

import { useMemo } from 'react';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import useFilters from '@/hooks/useFilters';

const PRICE_MIN = 0;
const PRICE_MAX = 2000;
const PRICE_STEP = 50;

type SalonOption = {
  handle: string;
  name: string;
};

type CategoryPlpSidebarProps = {
  salons: SalonOption[];
  cities: string[];
  locale: string;
  currencyCode: string;
};

const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc'] as const;

function parsePrice(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(PRICE_MIN, Math.min(PRICE_MAX, parsed));
}

function formatPrice(value: number, locale: string, currencyCode: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currencyCode}`;
  }
}

export function CategoryPlpSidebar({ salons, cities, locale, currencyCode }: CategoryPlpSidebarProps) {
  const t = useTranslations('category_plp');
  const tSort = useTranslations('sort');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { updateFilters: updateCity, isFilterActive: isCityActive } = useFilters('city');
  const { updateFilters: updateSellerRating, isFilterActive: isSellerRatingActive } = useFilters('seller_rating');

  const minPrice = parsePrice(searchParams.get('min_price'), PRICE_MIN);
  const maxPrice = parsePrice(searchParams.get('max_price'), PRICE_MAX);
  const selectedSalon = searchParams.get('salon') ?? '';
  const selectedSort = searchParams.get('sort') ?? 'recommended';
  const selectedMode = searchParams.get('mode') ?? 'self';
  const availability = searchParams.get('availability') === 'in_stock';

  const selectedCities = useMemo(() => {
    const raw = searchParams.get('city');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const selectedRatings = useMemo(() => {
    const raw = searchParams.get('seller_rating');
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const hasActiveFilters =
    minPrice > PRICE_MIN ||
    maxPrice < PRICE_MAX ||
    selectedSalon.length > 0 ||
    selectedCities.length > 0 ||
    selectedRatings.length > 0 ||
    availability ||
    selectedMode === 'gift' ||
    selectedSort !== 'recommended';

  function setQueryValue(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    if (key !== 'page') {
      params.delete('page');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handlePriceChange(key: 'min_price' | 'max_price', value: number) {
    const normalized = Math.max(PRICE_MIN, Math.min(PRICE_MAX, value));
    setQueryValue(key, String(normalized));
  }

  return (
    <aside
      className="bb-section-shell bb-section-shell-strong space-y-6"
      data-testid="category-plp-sidebar"
      aria-label={t('filters_aria')}
    >
      <div className="flex items-center justify-between">
        <h2 className="heading-md">{t('filters_title')}</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
            className="text-xs font-medium uppercase tracking-[0.08em] text-secondary underline underline-offset-4"
            data-testid="category-plp-clear-filters"
          >
            {t('clear_filters')}
          </button>
        )}
      </div>

      <section className="space-y-3" data-testid="category-plp-filter-price">
        <h3 className="label-sm uppercase text-secondary">{t('filter_price')}</h3>
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs text-secondary" htmlFor="category-plp-min-price">
            <span>{t('price_from')}</span>
            <span>{formatPrice(minPrice, locale, currencyCode)}</span>
          </label>
          <input
            id="category-plp-min-price"
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={Math.min(minPrice, maxPrice)}
            onChange={event => handlePriceChange('min_price', Number(event.target.value))}
            data-testid="category-plp-min-price"
          />
          <label className="flex items-center justify-between text-xs text-secondary" htmlFor="category-plp-max-price">
            <span>{t('price_to')}</span>
            <span>{formatPrice(maxPrice, locale, currencyCode)}</span>
          </label>
          <input
            id="category-plp-max-price"
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={Math.max(maxPrice, minPrice)}
            onChange={event => handlePriceChange('max_price', Number(event.target.value))}
            data-testid="category-plp-max-price"
          />
        </div>
      </section>

      <section className="space-y-3" data-testid="category-plp-filter-salon">
        <h3 className="label-sm uppercase text-secondary">{t('filter_salon')}</h3>
        <select
          className="w-full rounded-md border border-[var(--bb-tint-gold-26)] bg-white px-3 py-2 text-sm"
          value={selectedSalon}
          onChange={event => setQueryValue('salon', event.target.value || null)}
          data-testid="category-plp-salon-select"
        >
          <option value="">{t('all_salons')}</option>
          {salons.map(salon => (
            <option key={salon.handle} value={salon.handle}>
              {salon.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3" data-testid="category-plp-filter-location">
        <h3 className="label-sm uppercase text-secondary">{t('filter_location')}</h3>
        <div className="space-y-2">
          {cities.map(city => (
            <label key={city} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isCityActive(city)}
                onChange={() => updateCity(city)}
                data-testid={`category-plp-city-${city.toLowerCase().replace(/\s+/g, '-')}`}
              />
              {city}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3" data-testid="category-plp-filter-rating">
        <h3 className="label-sm uppercase text-secondary">{t('filter_rating')}</h3>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map(rating => (
            <label key={rating} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSellerRatingActive(String(rating))}
                onChange={() => updateSellerRating(String(rating))}
                data-testid={`category-plp-rating-${rating}`}
              />
              {`${rating}+ ★`}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3" data-testid="category-plp-filter-availability">
        <h3 className="label-sm uppercase text-secondary">{t('filter_availability')}</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={availability}
            onChange={event => setQueryValue('availability', event.target.checked ? 'in_stock' : null)}
            data-testid="category-plp-availability-in-stock"
          />
          {t('availability_in_stock')}
        </label>
      </section>

      <section className="space-y-3" data-testid="category-plp-filter-mode">
        <h3 id="category-plp-mode-label" className="label-sm uppercase text-secondary">{t('filter_mode')}</h3>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="category-plp-mode-label">
          <button
            type="button"
            onClick={() => setQueryValue('mode', 'self')}
            role="radio"
            aria-checked={selectedMode !== 'gift'}
            className={`rounded-full border px-3 py-2 text-sm ${selectedMode !== 'gift' ? 'border-action bg-action text-action-on-primary' : 'border-[var(--bb-tint-gold-26)] bg-white'}`}
            data-testid="category-plp-mode-self"
          >
            {t('mode_self')}
          </button>
          <button
            type="button"
            onClick={() => setQueryValue('mode', 'gift')}
            role="radio"
            aria-checked={selectedMode === 'gift'}
            className={`rounded-full border px-3 py-2 text-sm ${selectedMode === 'gift' ? 'border-action bg-action text-action-on-primary' : 'border-[var(--bb-tint-gold-26)] bg-white'}`}
            data-testid="category-plp-mode-gift"
          >
            {t('mode_gift')}
          </button>
        </div>
      </section>

      <section className="space-y-3" data-testid="category-plp-filter-sort">
        <h3 className="label-sm uppercase text-secondary">{t('filter_sort')}</h3>
        <select
          className="w-full rounded-md border border-[var(--bb-tint-gold-26)] bg-white px-3 py-2 text-sm"
          value={SORT_OPTIONS.includes(selectedSort as (typeof SORT_OPTIONS)[number]) ? selectedSort : 'recommended'}
          onChange={event => setQueryValue('sort', event.target.value)}
          data-testid="category-plp-sort-select"
        >
          <option value="recommended">{tSort('recommended')}</option>
          <option value="price_asc">{tSort('price_asc')}</option>
          <option value="price_desc">{tSort('price_desc')}</option>
        </select>
      </section>
    </aside>
  );
}
