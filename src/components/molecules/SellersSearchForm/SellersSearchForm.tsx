import { getTranslations } from 'next-intl/server';

import { NearMeToggle } from '@/components/atoms/NearMeToggle/NearMeToggle';
import { RadiusSelector } from '@/components/atoms/RadiusSelector/RadiusSelector';
import type { SellerSortKey } from '@/lib/data/seller';

const CITY_OPTIONS = ['Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź'] as const;

const SORT_OPTIONS: ReadonlyArray<SellerSortKey> = ['name_asc', 'name_desc'];

export interface SellersSearchFormProps {
  locale: string;
  q: string;
  city: string;
  sort: SellerSortKey;
  /**
   * Story v160-4-3 — current "blisko mnie" filter state, surfaced as hidden
   * inputs so a no-JS form submission preserves the geolocation filter.
   * Client-side toggle/selector mutate the URL directly via router.push.
   */
  nearMe?: boolean;
  radius?: number;
  lat?: number;
  lng?: number;
}

/**
 * Story v160-4-1: search/filter/sort controls for `/[locale]/sellers`.
 *
 * Server-rendered native `<form method="GET">`. No client state — submit
 * navigates the browser to `/[locale]/sellers?q=...&city=...&sort=...`,
 * which re-runs the server component and re-fetches via `searchSellers()`.
 * SEO-positive (NFR-PERF-4 LCP) and works without JS (NFR-A11Y).
 */
export async function SellersSearchForm({
  locale,
  q,
  city,
  sort,
  nearMe = false,
  radius,
  lat,
  lng
}: SellersSearchFormProps) {
  const t = await getTranslations('seller.search');

  return (
    <form
      action={`/${locale}/sellers`}
      method="GET"
      role="search"
      aria-label={t('form_aria')}
      className="mb-8 flex flex-col gap-3 md:flex-row md:items-end"
      data-testid="sellers-search-form"
    >
      <div className="flex-1">
        <label
          htmlFor="sellers-search-q"
          className="label-md mb-1 block text-sm font-medium"
        >
          {t('label_query')}
        </label>
        <input
          id="sellers-search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t('placeholder')}
          className="w-full rounded-sm border bg-component-secondary px-4 py-3 focus:border-primary focus:outline-none focus:ring-0"
          data-testid="sellers-search-input"
        />
      </div>

      <div className="md:w-48">
        <label
          htmlFor="sellers-search-city"
          className="label-md mb-1 block text-sm font-medium"
        >
          {t('label_city')}
        </label>
        <select
          id="sellers-search-city"
          name="city"
          defaultValue={city}
          className="w-full rounded-sm border bg-component-secondary px-4 py-3 focus:border-primary focus:outline-none focus:ring-0"
          data-testid="sellers-search-city"
        >
          <option value="">{t('city_all')}</option>
          {CITY_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="md:w-56">
        <label
          htmlFor="sellers-search-sort"
          className="label-md mb-1 block text-sm font-medium"
        >
          {t('label_sort')}
        </label>
        <select
          id="sellers-search-sort"
          name="sort"
          defaultValue={sort}
          className="w-full rounded-sm border bg-component-secondary px-4 py-3 focus:border-primary focus:outline-none focus:ring-0"
          data-testid="sellers-search-sort"
        >
          {SORT_OPTIONS.map(option => (
            <option key={option} value={option}>
              {t(`sort_${option}`)}
            </option>
          ))}
        </select>
      </div>

      {/*
        Story v160-4-3: client-side island for "Blisko mnie" toggle + radius
        selector. They mutate URL via router.push (NOT form submit) so we
        keep them outside the GET pipeline. Hidden inputs below preserve the
        geolocation params if the user re-submits the search form.
      */}
      <div className="flex flex-col gap-1 md:self-end">
        <NearMeToggle defaultRadiusKm={radius ?? 10} />
      </div>

      <RadiusSelector defaultRadiusKm={(radius ?? 10) as 5 | 10 | 25 | 50} />

      {nearMe && (
        <>
          <input type="hidden" name="nearMe" value="1" />
          {typeof radius === 'number' && (
            <input type="hidden" name="radius" value={String(radius)} />
          )}
          {typeof lat === 'number' && (
            <input type="hidden" name="lat" value={lat.toFixed(6)} />
          )}
          {typeof lng === 'number' && (
            <input type="hidden" name="lng" value={lng.toFixed(6)} />
          )}
        </>
      )}

      <button
        type="submit"
        className="rounded-sm border border-primary bg-primary px-6 py-3 text-white hover:bg-primary/90 md:self-end"
        data-testid="sellers-search-submit"
      >
        {t('submit')}
      </button>
    </form>
  );
}
