import 'server-only';

import { normalizeLexicalRichText, RichTextValidationError } from '@/components/rich-text';
import type { SupportedLocale } from '@/i18n/routing';
import { fetchMarketConfig } from '@/lib/portal.server';
import type { BlogRichTextNode } from '@/types/blog';

import { mapRouteLocaleToPayloadLocale } from './fetchPayloadBlogPage';

/**
 * fetchPayloadPage — storefront half of the Payload "Pages" pipeline for
 * page_type === 'page' (static content pages: faq, o-nas, kontakt, ...).
 *
 * Mirrors fetchPayloadBlogPage but for content pages: no hero image / author /
 * read-time requirements — just localized title, excerpt and richText content.
 * Tenant-scoped (multi-tenant) + locale-aware (native Payload localization).
 */

type PayloadPageDoc = {
  id?: string | number;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  page_type?: string | null;
  _status?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  content?: unknown;
  meta?: {
    title?: string | null;
    description?: string | null;
  } | null;
};

type PayloadCollectionResponse<T> = {
  docs?: T[];
};

export type PayloadContentPage = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: BlogRichTextNode[];
  publishedAt: string | null;
  updatedAt: string | null;
  seo: {
    title: string;
    description: string;
    canonicalUrl: string | null;
    robots: string | null;
  };
};

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

function text(value: string | null | undefined, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function toPayloadContentPage(doc: PayloadPageDoc): PayloadContentPage | null {
  if (doc.page_type !== 'page' || doc._status !== 'published') {
    return null;
  }

  const slug = text(doc.slug);
  const title = text(doc.title);
  if (!slug || !title) {
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

  const excerpt = text(doc.excerpt);

  return {
    id: String(doc.id ?? slug),
    slug,
    title,
    excerpt,
    content,
    publishedAt: doc.publishedAt ?? null,
    updatedAt: doc.updatedAt ?? null,
    seo: {
      title: text(doc.meta?.title, title),
      description: text(doc.meta?.description, excerpt),
      canonicalUrl: text(doc.canonicalUrl) || null,
      robots: text(doc.robots) || null
    }
  };
}

export async function fetchPayloadPage({
  locale,
  slug,
  marketId
}: {
  locale: SupportedLocale | string;
  slug: string;
  marketId: string;
}): Promise<PayloadContentPage | null> {
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

  url.searchParams.set('where[page_type][equals]', 'page');
  url.searchParams.set('where[_status][equals]', 'published');
  url.searchParams.set('where[slug][equals]', slug.trim());
  url.searchParams.set('locale', mapRouteLocaleToPayloadLocale(locale));
  // Native localization with fallback=true in payload.config: a locale missing a
  // translation falls back to the default (pl) rather than rendering empty.
  url.searchParams.set('fallback-locale', 'pl');
  url.searchParams.set('depth', '1');
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

    const data = (await response.json()) as PayloadCollectionResponse<PayloadPageDoc>;
    const doc = data.docs?.[0];

    return doc ? toPayloadContentPage(doc) : null;
  } catch {
    return null;
  }
}
