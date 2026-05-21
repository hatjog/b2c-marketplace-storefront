import { getFixtureBlogCards, getFixtureBlogPost } from '@/lib/blog-fixtures';
import { stripHtml } from '@/lib/helpers/text';
import { fetchMarketConfig } from '@/lib/portal.server';
import type {
  BlogIndexData,
  BlogInlineNode,
  BlogLocale,
  BlogPostCard,
  BlogPostDetail,
  BlogRichTextNode,
  BlogTag,
  TocEntry
} from '@/types/blog';

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
  updatedAt?: string | null;
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

const IFRAME_HOST_ALLOWLIST = new Set(['www.youtube.com', 'youtube.com', 'player.vimeo.com']);

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

  const sdImageUrl = page.structuredData?.image_url;
  if (typeof sdImageUrl === 'string' && sdImageUrl.length > 0) {
    return sdImageUrl;
  }

  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

export function getBlogCategory(page: PayloadPage) {
  const articleSection = page.structuredData?.articleSection;
  if (typeof articleSection === 'string' && articleSection.trim().length > 0) {
    return articleSection.trim();
  }

  return page.page_type || 'Blog';
}

export function getBlogDescription(page: PayloadPage) {
  return stripHtml(
    page.excerpt || page.summary || 'Read the latest updates from our marketplace blog.'
  );
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

function sanitizeTagSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function estimateReadTimeFromContent(content: unknown) {
  const text = extractLexicalParagraphs(content).join(' ');
  if (!text) {
    return 4;
  }

  return Math.max(4, Math.ceil(text.split(/\s+/).filter(Boolean).length / 180));
}

function payloadPageToBlogCard(page: PayloadPage, index: number): BlogPostCard | null {
  const slug = page.slug?.trim();
  if (!slug) {
    return null;
  }

  const title = page.title || page.name || 'Untitled post';
  const category = getBlogCategory(page).toUpperCase();
  const tag: BlogTag = {
    slug: sanitizeTagSlug(category),
    label: category
  };

  return {
    id: String(page.id ?? slug),
    slug,
    title,
    excerpt: getBlogDescription(page),
    image: getPageImageUrl(page, index),
    imageAlt: title,
    category,
    href: getBlogHref(page),
    tags: [tag],
    author: {
      name: 'Grow Platform Editorial',
      role: 'Editorial team',
      bio: 'Market-specific notes and editorial updates published from the storefront content layer.',
      avatar: null,
      profileUrl: '/blog'
    },
    readTimeMinutes: estimateReadTimeFromContent(page.content),
    publishedAt: page.publishedAt ?? null
  };
}

export function mapPayloadPageToBlogPost(page: PayloadPage, index: number): BlogPostCard {
  return (
    payloadPageToBlogCard(page, index) || {
      id: `fallback-${index + 1}`,
      slug: `fallback-${index + 1}`,
      title: page.title || page.name || 'Untitled post',
      excerpt: getBlogDescription(page),
      image: getPageImageUrl(page, index),
      imageAlt: page.title || page.name || 'Untitled post',
      category: getBlogCategory(page).toUpperCase(),
      href: getBlogHref(page),
      tags: [],
      author: {
        name: 'Grow Platform Editorial',
        role: 'Editorial team',
        bio: 'Market-specific notes and editorial updates published from the storefront content layer.'
      },
      readTimeMinutes: estimateReadTimeFromContent(page.content),
      publishedAt: page.publishedAt ?? null
    }
  );
}

function dedupeCards(cards: BlogPostCard[]) {
  const seen = new Set<string>();
  return cards.filter(card => {
    if (seen.has(card.slug)) {
      return false;
    }

    seen.add(card.slug);
    return true;
  });
}

function getTagSet(posts: BlogPostCard[]) {
  const tags = new Map<string, BlogTag>();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tags.has(tag.slug)) {
        tags.set(tag.slug, tag);
      }
    }
  }

  return Array.from(tags.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function filterPostsByTag(posts: BlogPostCard[], selectedTag: string | null) {
  if (!selectedTag || selectedTag === 'all') {
    return posts;
  }

  return posts.filter(post => post.tags.some(tag => tag.slug === selectedTag));
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildHeadingId(postSlug: string, text: string, index: number) {
  const base = slugifyHeading(text) || `section-${index + 1}`;
  return `${postSlug}-${base}-${index + 1}`;
}

export function buildTocEntries(postSlug: string, content: BlogRichTextNode[]): TocEntry[] {
  return content
    .map((node, index) => {
      switch (node.type) {
        case 'heading-2':
        case 'heading-3':
        case 'heading-4': {
          const level = Number(node.type.slice(-1)) as 2 | 3 | 4;
          return {
            id: buildHeadingId(postSlug, node.text, index),
            label: node.text,
            level
          };
        }
        default:
          return null;
      }
    })
    .filter((entry): entry is TocEntry => Boolean(entry));
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

function lexicalParagraphsToRichText(content: unknown): BlogRichTextNode[] {
  const paragraphs = extractLexicalParagraphs(content);
  if (paragraphs.length === 0) {
    return [];
  }

  return paragraphs.map(paragraph => ({
    type: 'paragraph',
    content: [{ type: 'text', text: paragraph }] satisfies BlogInlineNode[]
  }));
}

export async function fetchHomepageBlogPageDocs({
  marketId,
  limit
}: {
  marketId: string;
  limit?: number | null;
}) {
  const resolvedLimit = Math.max(1, Math.min(limit ?? 12, 24));

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

export async function fetchBlogPageBySlug({ marketId, slug }: { marketId: string; slug: string }) {
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

export async function getBlogIndexData({
  locale,
  marketId,
  selectedTag
}: {
  locale: BlogLocale;
  marketId: string;
  selectedTag: string | null;
}): Promise<BlogIndexData> {
  const [payloadPages, fixtureCards] = await Promise.all([
    fetchHomepageBlogPageDocs({
      marketId,
      limit: 12
    }),
    Promise.resolve(getFixtureBlogCards(locale))
  ]);

  const payloadCards = payloadPages
    .map((page, index) => payloadPageToBlogCard(page, index))
    .filter((card): card is BlogPostCard => Boolean(card));

  const merged = dedupeCards([...payloadCards, ...fixtureCards]).slice(0, 12);
  const availableTags = getTagSet(merged);
  const normalizedTag = selectedTag && selectedTag !== 'all' ? selectedTag : null;
  const filtered = filterPostsByTag(merged, normalizedTag);

  return {
    posts: filtered,
    availableTags,
    selectedTag: normalizedTag
  };
}

export async function getBlogPostDetail({
  locale,
  marketId,
  slug
}: {
  locale: BlogLocale;
  marketId: string;
  slug: string;
}): Promise<BlogPostDetail | null> {
  const fixture = getFixtureBlogPost(locale, slug);
  if (fixture) {
    return fixture;
  }

  const page = await fetchBlogPageBySlug({
    marketId,
    slug
  });

  if (!page) {
    return null;
  }

  const card = payloadPageToBlogCard(page, 0);
  if (!card) {
    return null;
  }

  const allCards = (
    await getBlogIndexData({
      locale,
      marketId,
      selectedTag: null
    })
  ).posts;

  return {
    ...card,
    heroImage: getPageImageUrl(page, 0, { preferHeroImage: true }),
    heroImageAlt: card.title,
    updatedAt: page.updatedAt ?? null,
    content: lexicalParagraphsToRichText(page.content),
    relatedPosts: allCards.filter(entry => entry.slug !== slug).slice(0, 3)
  };
}

export function isAllowedIframeUrl(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && IFRAME_HOST_ALLOWLIST.has(url.hostname);
  } catch {
    return false;
  }
}