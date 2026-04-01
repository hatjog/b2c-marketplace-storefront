import { fetchMarketConfig } from '@/lib/portal.server';
import type { BlogPost } from '@/types/blog';
import { stripHtml } from '@/lib/helpers/text';

export type PayloadStructuredData = {
  articleSection?: string | null;
  image_url?: string | null;
};

export type PayloadPage = {
  id?: string | number;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  summary?: string | null;
  page_type?: string | null;
  _status?: string | null;
  canonicalUrl?: string | null;
  structuredData?: PayloadStructuredData | null;
  image?: { url?: string | null } | string | null;
  hero_image?: { url?: string | null } | string | null;
  publishedAt?: string | null;
  content?: unknown;
};

type PayloadCollectionResponse<T> = {
  docs?: T[];
};

const FALLBACK_IMAGES = [
  '/images/blog/post-1.jpg',
  '/images/blog/post-2.jpg',
  '/images/blog/post-3.jpg'
];

export function getPayloadApiUrl() {
  return process.env.PAYLOAD_API_URL;
}

function buildPayloadUrl(pathname: string) {
  const payloadApiUrl = getPayloadApiUrl();

  if (!payloadApiUrl) {
    throw new Error('PAYLOAD_API_URL is required');
  }

  const normalizedBase = payloadApiUrl.endsWith('/') ? payloadApiUrl : `${payloadApiUrl}/`;
  return new URL(pathname.replace(/^\//, ''), normalizedBase);
}

function getTenantIdFromMarketConfig(marketConfig: Awaited<ReturnType<typeof fetchMarketConfig>>) {
  const rawTenant = marketConfig?.tenant;

  if (rawTenant == null) {
    return null;
  }

  if (typeof rawTenant === 'object') {
    return rawTenant.id == null ? null : String(rawTenant.id);
  }

  return String(rawTenant);
}

async function fetchMarketScopedPages({
  marketId,
  searchParams,
  revalidate = 600,
  tags = ['pages']
}: {
  marketId: string;
  searchParams: Array<[string, string]>;
  revalidate?: number;
  tags?: string[];
}): Promise<PayloadPage[]> {
  try {
    const url = buildPayloadUrl('api/pages');

    if (marketId) {
      const marketConfig = await fetchMarketConfig(marketId);
      const tenantId = getTenantIdFromMarketConfig(marketConfig);

      if (!tenantId) {
        console.warn(
          `[blog] market-config lookup returned no tenant for market "${marketId}"; skipping page fetch`
        );
        return [];
      }

      url.searchParams.set('where[tenant][equals]', tenantId);
    }

    for (const [key, value] of searchParams) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      next: {
        revalidate,
        tags
      }
    });

    if (!response.ok) {
      console.error(`[blog] fetch failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as PayloadCollectionResponse<PayloadPage>;
    return data.docs || [];
  } catch (error) {
    console.error('[blog] request error', error);
    return [];
  }
}

function collectText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const value = node as { text?: unknown; children?: unknown };
  const ownText = typeof value.text === 'string' ? value.text : '';
  const childrenText = Array.isArray(value.children)
    ? value.children.map(child => collectText(child)).join('')
    : '';

  return `${ownText}${childrenText}`;
}

function resolvePayloadImageUrl(image: PayloadPage['image'] | PayloadPage['hero_image']) {
  if (typeof image === 'string') {
    return image;
  }

  return image?.url ?? null;
}

export function getPageImageUrl(
  page: PayloadPage,
  index: number,
  options: { preferHeroImage?: boolean } = {}
) {
  const primaryImage = options.preferHeroImage ? page.hero_image : page.image;
  const secondaryImage = options.preferHeroImage ? page.image : page.hero_image;
  const primaryUrl = resolvePayloadImageUrl(primaryImage);

  if (primaryUrl) {
    return primaryUrl;
  }

  const secondaryUrl = resolvePayloadImageUrl(secondaryImage);
  if (secondaryUrl) {
    return secondaryUrl;
  }

  // Fallback to structuredData.image_url (set by gp-config-sync-blog from blog.yaml)
  const sdImageUrl = page.structuredData?.image_url;
  if (typeof sdImageUrl === 'string' && sdImageUrl.length > 0) {
    return sdImageUrl;
  }

  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

export function getBlogCategory(page: PayloadPage) {
  const articleSection = page.structuredData?.articleSection;
  if (typeof articleSection === 'string' && articleSection.trim().length > 0) {
    return articleSection.toUpperCase();
  }

  return (page.page_type || 'BLOG').toUpperCase();
}

export function getBlogDescription(page: PayloadPage) {
  return stripHtml(page.excerpt || page.summary || 'Read the latest updates from our marketplace blog.');
}

export function getBlogHref(page: PayloadPage) {
  const slug = page.slug?.trim();
  if (slug) {
    return `/blog/${slug}`;
  }

  const canonicalUrl = page.canonicalUrl?.trim();
  if (canonicalUrl && canonicalUrl.startsWith('/')) {
    return canonicalUrl;
  }

  return '#';
}

export function mapPayloadPageToBlogPost(page: PayloadPage, index: number): BlogPost {
  const title = page.title || page.name || 'Untitled post';
  const parsedId = Number(page.id);
  const id = Number.isFinite(parsedId) ? parsedId : index + 1;

  return {
    id,
    title,
    excerpt: getBlogDescription(page),
    image: getPageImageUrl(page, index),
    category: getBlogCategory(page),
    href: getBlogHref(page)
  };
}

export function extractLexicalParagraphs(content: unknown): string[] {
  if (!content || typeof content !== 'object') {
    return [];
  }

  const rootChildren = (content as { root?: { children?: unknown } }).root?.children;
  if (!Array.isArray(rootChildren)) {
    return [];
  }

  return rootChildren.map(node => collectText(node).trim()).filter(Boolean);
}

export function formatBlogPublishedDate(publishedAt: string | null | undefined, locale: string) {
  if (!publishedAt) {
    return null;
  }

  const parsedDate = new Date(publishedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale || 'pl', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parsedDate);
}

export async function fetchHomepageBlogPageDocs({
  marketId,
  limit
}: {
  marketId: string;
  limit?: number | null;
}) {
  const resolvedLimit = Math.max(1, Math.min(limit ?? 3, 12));

  return fetchMarketScopedPages({
    marketId,
    searchParams: [
      ['where[page_type][equals]', 'blog'],
      ['where[_status][equals]', 'published'],
      ['sort', '-publishedAt'],
      ['depth', '1'],
      ['limit', String(resolvedLimit)]
    ]
  });
}

export async function fetchBlogPageBySlug({
  marketId,
  slug
}: {
  marketId: string;
  slug: string;
}) {
  if (!slug) {
    return null;
  }

  const docs = await fetchMarketScopedPages({
    marketId,
    searchParams: [
      ['where[page_type][equals]', 'blog'],
      ['where[_status][equals]', 'published'],
      ['where[slug][equals]', slug],
      ['depth', '1'],
      ['limit', '1']
    ]
  });

  return docs[0] ?? null;
}
