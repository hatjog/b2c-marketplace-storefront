import type { HttpTypes } from '@medusajs/types';

import { sdk } from '@/lib/config';

interface CategoriesProps {
  query?: Record<string, unknown>;
}

export const listCategories = async ({ query }: Partial<CategoriesProps> = {}) => {
  const limit = query?.limit || 100;

  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';

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
      next: { revalidate: 3600 }
    })
    .then(({ product_categories }) => product_categories);

  const filtered = marketId
    ? allCategories.filter(c => (c.metadata?.gp as Record<string, unknown>)?.market_id === marketId)
    : allCategories;

  const parentCategories = filtered.filter(cat => !cat.parent_category_id);

  const mainCategories = parentCategories.flatMap(parent => parent.category_children || []);

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
        fields: '*category_children',
        handle: categoryHandle
      },
      cache: 'force-cache',
      next: { revalidate: 300 }
    })
    .then(({ product_categories }) => product_categories[0]);
};
