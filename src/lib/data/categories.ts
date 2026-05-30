import type { HttpTypes } from '@medusajs/types';

import { sdk } from '@/lib/config';
import { filterByMarket, getMarketId } from '@/lib/helpers/market-filter';
import { localeCacheTag } from '@/lib/sdk/locale-interceptor';

interface CategoriesProps {
  query?: Record<string, unknown>;
}

export const listCategories = async ({ query }: Partial<CategoriesProps> = {}) => {
  const limit = query?.limit || 100;
  const marketId = getMarketId();

  const allCategories = await sdk.client
    .fetch<{
      product_categories: HttpTypes.StoreProductCategory[];
    }>('/store/product-categories', {
      query: {
        fields: 'id,handle,name,rank,metadata,parent_category_id,description,*category_children',
        include_descendants_tree: true,
        include_ancestors_tree: true,
        limit,
        ...query
      },
      cache: 'force-cache',
      next: { revalidate: 3600, tags: [await localeCacheTag('product-categories')] }
    })
    .then(({ product_categories }) => product_categories);

  const filtered = filterByMarket(allCategories, marketId);
  const parentCategories = filtered.filter(cat => !cat.parent_category_id);

  // F3 fix: also filter category_children from the API tree — nested children
  // may lack metadata if Medusa doesn't populate it in the descendants tree.
  const mainCategories = filterByMarket(
    parentCategories.flatMap(parent => parent.category_children || []),
    marketId
  );

  const mainCategoriesWithChildren = mainCategories.map(mainCat => {
    const children = filtered.filter(cat => cat.parent_category_id === mainCat.id);

    if (children.length > 0) {
      return {
        ...mainCat,
        category_children: children
      };
    }

    return mainCat;
  });

  return {
    parentCategories,
    categories: mainCategoriesWithChildren
  };
};

export const getCategoryByHandle = async (categoryHandle: string) => {
  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(`/store/product-categories`, {
      query: {
        fields: 'id,handle,name,rank,metadata,parent_category_id,description,*category_children',
        handle: categoryHandle
      },
      cache: 'force-cache',
      next: { revalidate: 300, tags: [await localeCacheTag('product-categories')] }
    })
    .then(({ product_categories }) => product_categories[0]);
};
