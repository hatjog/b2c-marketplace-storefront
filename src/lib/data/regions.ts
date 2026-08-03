'use server';

import type { HttpTypes } from '@medusajs/types';

import medusaError from '@/lib/helpers/medusa-error';

import { sdk } from '../config';
import { getCacheOptions } from './cookies';

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions('regions')),
    revalidate: 3600
  };

  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: 'GET',
      next,
      cache: 'force-cache'
    })
    .then(({ regions }) => regions)
    .catch(medusaError);
};

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(['regions', id].join('-'))),
    revalidate: 3600
  };

  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: 'GET',
      next,
      cache: 'force-cache'
    })
    .then(({ region }) => region)
    .catch(medusaError);
};

const regionMap = new Map<string, HttpTypes.StoreRegion>();

export const getRegion = async (countryCode: string) => {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode);
    }

    const regions = await listRegions();

    if (!regions) {
      return null;
    }

    regions.forEach(region => {
      region.countries?.forEach(c => {
        regionMap.set(c?.iso_2 ?? '', region);
      });
    });

    // Opcja A (locale-decoupled region, ADR-121): BonBeauty is a PL-only market;
    // locale is UI language only, not a separate market/region. For any country
    // code without a dedicated region (e.g. 'gb' from locale 'en', 'ua', 'de'),
    // fall back to the first available region instead of the hardcoded 'us'
    // which does not exist on gp-dev (single-region: Poland → ['pl']).
    // This prevents getRegion from returning undefined → empty product fetch → PDP 404.
    // Opcja C (defensive fallback) is applied alongside A: regionMap.get('us')
    // was a bug regardless — replaced with first available region.
    const region = regionMap.get(countryCode) ?? regionMap.values().next().value ?? undefined;

    return region;
  } catch {
    return null;
  }
};
