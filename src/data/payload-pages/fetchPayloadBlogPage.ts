import 'server-only';

import { normalizeLexicalRichText, RichTextValidationError } from '@/components/rich-text';
import type { SupportedLocale } from '@/i18n/routing';
import { fetchMarketConfig } from '@/lib/portal.server';
import type { BlogAuthor, BlogPostCard, BlogRichTextNode } from '@/types/blog';

type PayloadMedia = {
  url?: string | null;
  alt?: string | null;
};

type PayloadBlogPageDoc = {
  id?: string | number;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  summary?: string | null;
  page_type?: string | null;
  _status?: string | null;
  canonicalUrl?: string | null;
  image?: PayloadMedia | string | null;
  hero_image?: PayloadMedia | string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  content?: unknown;
  structuredData?: {
    articleSection?: string | null;
    author?: Partial<BlogAuthor> | string | null;
    readTimeMinutes?: number | null;
    relatedPosts?: BlogPostCard[] | null;
  } | null;
  meta?: {
    title?: string | null;
    description?: string | null;
    image?: PayloadMedia | string | null;
  } | null;
};

type PayloadCollectionResponse<T> = {
  docs?: T[];
};

export type PayloadLocale = 'pl' | 'en' | 'uk' | 'de';

export type PayloadBlogPage = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  heroImage: string;
  heroImageAlt: string;
  author: BlogAuthor;
  publishedAt: string | null;
  updatedAt: string | null;
  readTimeMinutes: number;
  content: BlogRichTextNode[];
  relatedPosts: BlogPostCard[];
  seo: {
    title: string;
    description: string;
    canonicalUrl: string | null;
  };
};

export function mapRouteLocaleToPayloadLocale(locale: SupportedLocale | string): PayloadLocale {
  if (locale === 'ua' || locale === 'uk') {
    return 'uk';
  }

  if (locale === 'pl' || locale === 'en' || locale === 'de') {
    return locale;
  }

  return 'pl';
}

function getPayloadApiUrl() {
  return process.env.PAYLOAD_API_URL;
}

function buildPayloadUrl(pathname: string) {
  const payloadApiUrl = getPayloadApiUrl();

  if (!payloadApiUrl) {
    return null;
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

function mediaUrl(media: PayloadMedia | string | null | undefined) {
  if (typeof media === 'string') {
    return media.trim() || null;
  }

  return media?.url?.trim() || null;
}

function mediaAlt(media: PayloadMedia | string | null | undefined) {
  if (!media || typeof media === 'string') {
    return null;
  }

  return media.alt?.trim() || null;
}

function text(value: string | null | undefined, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function buildAuthor(doc: PayloadBlogPageDoc): BlogAuthor {
  const raw = doc.structuredData?.author;

  if (typeof raw === 'string' && raw.trim()) {
    return {
      name: raw.trim(),
      role: 'Editorial',
      bio: 'Payload Pages editorial author'
    };
  }

  if (raw && typeof raw === 'object' && raw.name) {
    return {
      name: text(raw.name, 'Payload Editorial'),
      role: text(raw.role, 'Editorial'),
      bio: text(raw.bio, 'Payload Pages editorial author'),
      avatar: raw.avatar ?? null,
      profileUrl: raw.profileUrl ?? null,
      socialUrl: raw.socialUrl ?? null,
      socialLabel: raw.socialLabel ?? null
    };
  }

  return {
    name: 'Payload Editorial',
    role: 'Editorial',
    bio: 'Payload Pages editorial author'
  };
}

function estimateReadTime(content: BlogRichTextNode[]) {
  const textContent = JSON.stringify(content);
  return Math.max(4, Math.ceil(textContent.split(/\s+/).filter(Boolean).length / 180));
}

function toPayloadBlogPage(doc: PayloadBlogPageDoc): PayloadBlogPage | null {
  if (doc.page_type !== 'blog' || doc._status !== 'published') {
    return null;
  }

  const slug = text(doc.slug);
  const title = text(doc.title ?? doc.name);
  const excerpt = text(doc.excerpt ?? doc.summary);
  const image = doc.hero_image ?? doc.image ?? doc.meta?.image ?? null;
  const heroImage = mediaUrl(image);
  const heroImageAlt = mediaAlt(image);

  if (!slug || !title || !excerpt || !heroImage || !heroImageAlt) {
    return null;
  }

  let content: BlogRichTextNode[];
  try {
    content = normalizeLexicalRichText(doc.content);
  } catch (error) {
    if (error instanceof RichTextValidationError) {
      return null;
    }

    throw error;
  }

  return {
    id: String(doc.id ?? slug),
    slug,
    title,
    excerpt,
    category: text(doc.structuredData?.articleSection, 'Blog'),
    heroImage,
    heroImageAlt,
    author: buildAuthor(doc),
    publishedAt: doc.publishedAt ?? null,
    updatedAt: doc.updatedAt ?? null,
    readTimeMinutes: doc.structuredData?.readTimeMinutes ?? estimateReadTime(content),
    content,
    relatedPosts: doc.structuredData?.relatedPosts ?? [],
    seo: {
      title: text(doc.meta?.title, title),
      description: text(doc.meta?.description, excerpt),
      canonicalUrl: text(doc.canonicalUrl) || null
    }
  };
}

export async function fetchPayloadBlogPage({
  locale,
  slug,
  marketId
}: {
  locale: SupportedLocale | string;
  slug: string;
  marketId: string;
}): Promise<PayloadBlogPage | null> {
  const url = buildPayloadUrl('api/pages');

  if (!url || !slug.trim()) {
    return null;
  }

  if (marketId) {
    const marketConfig = await fetchMarketConfig(marketId);
    const tenantId = getTenantIdFromMarketConfig(marketConfig);

    if (!tenantId) {
      return null;
    }

    url.searchParams.set('where[tenant][equals]', tenantId);
  }

  url.searchParams.set('where[page_type][equals]', 'blog');
  url.searchParams.set('where[_status][equals]', 'published');
  url.searchParams.set('where[slug][equals]', slug.trim());
  url.searchParams.set('locale', mapRouteLocaleToPayloadLocale(locale));
  url.searchParams.set('fallback-locale', 'none');
  url.searchParams.set('depth', '2');
  url.searchParams.set('limit', '1');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      next: {
        revalidate: 600,
        tags: ['pages', `page-${slug.trim()}`]
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PayloadCollectionResponse<PayloadBlogPageDoc>;
    const doc = data.docs?.[0];

    return doc ? toPayloadBlogPage(doc) : null;
  } catch {
    return null;
  }
}