import 'server-only';

import { normalizeLexicalRichText, RichTextValidationError } from '@/components/rich-text';
import type { SupportedLocale } from '@/i18n/routing';
import {
  blogCacheTag,
  mapRouteLocaleToPayloadLocale,
  type PayloadLocale
} from '@/lib/blog-locale';
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

export type { PayloadLocale };

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
  /**
   * `null` → the article was authored in the requested locale.
   * Non-null → this is the `market.locales.default` variant served under the
   * CAP-4 fallback policy; the route MUST render a visible notice and set
   * `lang` on the fallback fragment (party review PR-2).
   */
  contentFallbackLocale: PayloadLocale | null;
};

export { mapRouteLocaleToPayloadLocale };

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

function toPayloadBlogPage(
  doc: PayloadBlogPageDoc,
  contentFallbackLocale: PayloadLocale | null
): PayloadBlogPage | null {
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
    },
    contentFallbackLocale
  };
}

async function fetchOnePayloadLocale({
  payloadLocale,
  slug,
  tenantId,
  contentFallbackLocale
}: {
  payloadLocale: PayloadLocale;
  slug: string;
  tenantId: string | null;
  contentFallbackLocale: PayloadLocale | null;
}): Promise<PayloadBlogPage | null> {
  const url = buildPayloadUrl('api/pages');

  if (!url) {
    return null;
  }

  if (tenantId) {
    url.searchParams.set('where[tenant][equals]', tenantId);
  }

  url.searchParams.set('where[page_type][equals]', 'blog');
  url.searchParams.set('where[_status][equals]', 'published');
  url.searchParams.set('where[slug][equals]', slug);
  url.searchParams.set('locale', payloadLocale);
  // Payload's own fallback would hand us Polish prose labelled as German with
  // no way to tell the difference. The fallback decision belongs to the caller.
  url.searchParams.set('fallback-locale', 'none');
  url.searchParams.set('depth', '2');
  url.searchParams.set('limit', '1');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      next: {
        revalidate: 600,
        // Canonical locale in the cache key — SPEC decision 5.
        tags: [
          blogCacheTag('pages', payloadLocale),
          blogCacheTag(`page-${slug}`, payloadLocale)
        ]
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PayloadCollectionResponse<PayloadBlogPageDoc>;
    const doc = data.docs?.[0];

    return doc ? toPayloadBlogPage(doc, contentFallbackLocale) : null;
  } catch {
    return null;
  }
}

export async function fetchPayloadBlogPage({
  locale,
  fallbackLocale,
  slug,
  marketId
}: {
  locale: SupportedLocale | string;
  /**
   * `market.locales.default` from the ADR-154 resolver. Required so the fallback
   * target is never guessed at the reader boundary.
   */
  fallbackLocale: SupportedLocale | string;
  slug: string;
  marketId: string;
}): Promise<PayloadBlogPage | null> {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug || !buildPayloadUrl('api/pages')) {
    return null;
  }

  let tenantId: string | null = null;

  if (marketId) {
    const marketConfig = await fetchMarketConfig(marketId);
    tenantId = getTenantIdFromMarketConfig(marketConfig);

    if (!tenantId) {
      return null;
    }
  }

  const requestedLocale = mapRouteLocaleToPayloadLocale(locale);
  const defaultLocale = mapRouteLocaleToPayloadLocale(fallbackLocale);

  const requested = await fetchOnePayloadLocale({
    payloadLocale: requestedLocale,
    slug: normalizedSlug,
    tenantId,
    contentFallbackLocale: null
  });

  if (requested || requestedLocale === defaultLocale) {
    return requested;
  }

  // CAP-4: no variant in the requested locale → serve the market default,
  // tagged so the route renders a notice instead of a silent translation.
  return fetchOnePayloadLocale({
    payloadLocale: defaultLocale,
    slug: normalizedSlug,
    tenantId,
    contentFallbackLocale: defaultLocale
  });
}