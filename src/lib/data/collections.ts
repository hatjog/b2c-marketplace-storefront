'use server';

import type { HttpTypes } from '@medusajs/types';

import { sdk } from '../config';
import { filterByMarket, getMarketId } from '../helpers/market-filter';
import { getCacheOptions } from './cookies';

export const retrieveCollection = async (id: string) => {
  const next = {
    ...(await getCacheOptions('collections'))
  };

  return sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(`/store/collections/${id}`, {
      next,
      cache: 'force-cache'
    })
    .then(({ collection }) => collection);
};

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const next = {
    ...(await getCacheOptions('collections'))
  };

  const marketId = getMarketId();

  queryParams.limit = queryParams.limit || '100';
  queryParams.offset = queryParams.offset || '0';

  return sdk.client
    .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>('/store/collections', {
      query: queryParams,
      next,
      cache: 'force-cache'
    })
    .then(({ collections }) => {
      const filtered = filterByMarket(collections, marketId);
      // NOTE: count reflects client-filtered length, not server total.
      // This was already the case before this guard (original used collections.length).
      return { collections: filtered, count: filtered.length };
    });
};

export const getCollectionByHandle = async (handle: string): Promise<HttpTypes.StoreCollection> => {
  const next = {
    ...(await getCacheOptions('collections'))
  };

  return sdk.client
    .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle, fields: '*products' },
      next,
      cache: 'force-cache'
    })
    .then(({ collections }) => collections[0]);
};
