import type { HttpTypes } from '@medusajs/types';

import { sortProducts } from '@/lib/helpers/sort-products';
import type { BlogPost } from '@/types/blog';
import type { SortOptions } from '@/types/product';

type HomepageProductsSort = 'newest' | 'price_asc' | 'price_desc';

type PayloadPage = {
  id?: string | number;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  summary?: string | null;
  page_type?: string | null;
  _status?: string | null;
  image?: { url?: string | null } | string | null;
  hero_image?: { url?: string | null } | string | null;
};

type PayloadCollectionResponse<T> = {
  docs?: T[];
};

function getMedusaBackendUrl() {
  return process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
}

function getPayloadApiUrl() {
  return process.env.PAYLOAD_API_URL;
}

function buildMedusaUrl(pathname: string) {
  const baseUrl = getMedusaBackendUrl();
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ''), normalizedBase);
}

function getPublishableHeaders() {
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  return {
    'Content-Type': 'application/json',
    ...(publishableKey ? { 'x-publishable-api-key': publishableKey } : {})
  };
}

function mapSortToStorefront(sort: HomepageProductsSort): SortOptions {
  if (sort === 'newest') {
    return 'created_at';
  }

  return sort;
}

function getPageImageUrl(page: PayloadPage, index: number) {
  const fallbackImages = [
    '/images/blog/post-1.jpg',
    '/images/blog/post-2.jpg',
    '/images/blog/post-3.jpg'
  ];

  const image = page.image;
  const heroImage = page.hero_image;

  if (typeof image === 'string') {
    return image;
  }

  if (typeof heroImage === 'string') {
    return heroImage;
  }

  if (image?.url) {
    return image.url;
  }

  if (heroImage?.url) {
    return heroImage.url;
  }

  return fallbackImages[index % fallbackImages.length];
}

function mapPayloadPageToBlogPost(page: PayloadPage, index: number): BlogPost {
  const title = page.title || page.name || 'Untitled post';
  const excerpt =
    page.excerpt || page.summary || 'Read the latest updates from our marketplace blog.';
  const slug = page.slug;
  const parsedId = Number(page.id);
  const id = Number.isFinite(parsedId) ? parsedId : index + 1;

  return {
    id,
    title,
    excerpt,
    image: getPageImageUrl(page, index),
    category: (page.page_type || 'BLOG').toUpperCase(),
    href: slug ? `/blog/${slug}` : '#'
  };
}

export async function fetchHomepageProducts({
  locale,
  sort,
  limit
}: {
  locale: string;
  sort?: HomepageProductsSort | null;
  limit?: number | null;
}): Promise<HttpTypes.StoreProduct[]> {
  const resolvedLimit = Math.max(1, Math.min(limit ?? 4, 24));
  const resolvedSort = mapSortToStorefront(sort ?? 'newest');

  const url = buildMedusaUrl('/store/products');
  url.searchParams.set('country_code', locale);
  url.searchParams.set('limit', String(resolvedLimit));
  url.searchParams.set('fields', '*variants.calculated_price,*variants,*seller');

  const fallbackUrl = buildMedusaUrl('/store/products');
  fallbackUrl.searchParams.set('country_code', locale);
  fallbackUrl.searchParams.set('limit', String(resolvedLimit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getPublishableHeaders(),
      next: {
        revalidate: 3600,
        tags: ['products']
      }
    });

    if (!response.ok) {
      console.error(`[homepage][products] fetch failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as {
      products?: HttpTypes.StoreProduct[];
    };

    let products = Array.isArray(data.products) ? data.products : [];

    if (products.length === 0) {
      const fallbackResponse = await fetch(fallbackUrl.toString(), {
        method: 'GET',
        headers: getPublishableHeaders(),
        next: {
          revalidate: 3600,
          tags: ['products']
        }
      });

      if (fallbackResponse.ok) {
        const fallbackData = (await fallbackResponse.json()) as {
          products?: HttpTypes.StoreProduct[];
        };
        products = Array.isArray(fallbackData.products) ? fallbackData.products : [];
      }
    }

    const sorted = sortProducts(products, resolvedSort);
    return sorted.slice(0, resolvedLimit);
  } catch (error) {
    console.error('[homepage][products] request error', error);
    return [];
  }
}

export async function fetchHomepageCategories({
  limit
}: {
  limit?: number | null;
} = {}): Promise<{ name: string; handle: string }[]> {
  const resolvedLimit = Math.max(1, Math.min(limit ?? 24, 100));
  const url = buildMedusaUrl('/store/product-categories');

  url.searchParams.set(
    'fields',
    'id,handle,name,rank,metadata,parent_category_id,*category_children'
  );
  url.searchParams.set('include_descendants_tree', 'true');
  url.searchParams.set('include_ancestors_tree', 'true');
  url.searchParams.set('limit', String(resolvedLimit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getPublishableHeaders(),
      next: {
        revalidate: 86400,
        tags: ['categories']
      }
    });

    if (!response.ok) {
      console.error(
        `[homepage][categories] fetch failed: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = (await response.json()) as {
      product_categories?: HttpTypes.StoreProductCategory[];
    };

    const allCategories = data.product_categories || [];
    const rootCategories = allCategories.filter(cat => !cat.parent_category_id);
    const mapped = rootCategories
      .map(cat => ({
        name: cat.name,
        handle: cat.handle
      }))
      .filter(cat => Boolean(cat.name && cat.handle));

    return mapped.slice(0, resolvedLimit);
  } catch (error) {
    console.error('[homepage][categories] request error', error);
    return [];
  }
}

export async function fetchHomepageBlogPosts({
  limit
}: {
  limit?: number | null;
}): Promise<BlogPost[]> {
  const payloadApiUrl = getPayloadApiUrl();

  if (!payloadApiUrl) {
    console.error('[homepage][blog] PAYLOAD_API_URL is required');
    return [];
  }

  const resolvedLimit = Math.max(1, Math.min(limit ?? 3, 12));
  const normalizedBase = payloadApiUrl.endsWith('/') ? payloadApiUrl : `${payloadApiUrl}/`;
  const url = new URL('api/pages', normalizedBase);

  url.searchParams.set('where[page_type][equals]', 'blog');
  url.searchParams.set('where[_status][equals]', 'published');
  url.searchParams.set('limit', String(resolvedLimit));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      next: {
        revalidate: 600,
        tags: ['pages']
      }
    });

    if (!response.ok) {
      console.error(`[homepage][blog] fetch failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as PayloadCollectionResponse<PayloadPage>;
    return (data.docs || []).map(mapPayloadPageToBlogPost);
  } catch (error) {
    console.error('[homepage][blog] request error', error);
    return [];
  }
}
