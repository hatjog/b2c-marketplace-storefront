import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBlogCards, getFixtureBlogPost } from '@/lib/blog-fixtures';

import {
  buildHeadingId,
  buildTocEntries,
  fetchBlogPageBySlug,
  fetchHomepageBlogPageDocs,
  getBlogIndexData,
  isAllowedIframeUrl,
  payloadPageToBlogCard,
  type BlogCardLabels
} from './blog';

vi.mock('@/lib/portal.server', () => ({
  fetchMarketConfig: async () => ({ id: 'market-config', tenant: { id: 42 } })
}));

const LABELS: BlogCardLabels = {
  untitledPost: 'LABEL_untitled',
  excerptFallback: 'LABEL_excerpt',
  authorName: 'LABEL_author_name',
  authorRole: 'LABEL_author_role',
  authorBio: 'LABEL_author_bio'
};

const originalFetch = global.fetch;
const originalPayloadApiUrl = process.env.PAYLOAD_API_URL;

function restoreEnvironment() {
  global.fetch = originalFetch;

  if (originalPayloadApiUrl == null) {
    delete process.env.PAYLOAD_API_URL;
  } else {
    process.env.PAYLOAD_API_URL = originalPayloadApiUrl;
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

type FetchCall = { url: URL; tags: string[] };

/**
 * Serves a per-locale Payload fixture and records the URL + Next cache tags of
 * every request, so both the request locale and the cache key are observable.
 */
function stubPayload(docsByLocale: Record<string, unknown[]>) {
  process.env.PAYLOAD_API_URL = 'https://payload.test';
  const calls: FetchCall[] = [];

  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);

    if (url.pathname !== '/api/pages') {
      throw new Error(`Unexpected fetch: ${url.toString()}`);
    }

    const nextOptions = (init as { next?: { tags?: string[] } } | undefined)?.next;
    calls.push({ url, tags: nextOptions?.tags ?? [] });

    const locale = url.searchParams.get('locale') ?? '';
    return jsonResponse({ docs: docsByLocale[locale] ?? [] });
  }) as unknown as typeof fetch;

  return calls;
}

const PL_DOC = {
  id: 'post-1',
  slug: 'poranny-rytual',
  title: 'Poranny rytuał',
  excerpt: 'Polski zajawka',
  page_type: 'blog',
  _status: 'published',
  hero_image: { url: '/images/blog/post-1.jpg' },
  publishedAt: '2026-05-18T10:00:00.000Z'
};

const DE_DOC = {
  ...PL_DOC,
  title: 'Morgenritual',
  excerpt: 'Deutscher Auszug'
};

/** Payload with `fallback-locale=none` returns the doc with empty localized fields. */
const UNTRANSLATED_DOC = {
  ...PL_DOC,
  title: null,
  excerpt: null
};

afterEach(() => {
  restoreEnvironment();
  vi.restoreAllMocks();
});

describe('blog fixtures and helpers', () => {
  it('provides at least eight deterministic cards for the index route', () => {
    const cards = getFixtureBlogCards('pl');
    expect(cards).toHaveLength(8);
    expect(cards[0]?.slug).toBe('mercur-accessories-edit');
  });

  it('builds stable heading ids and TOC entries from fixture content', () => {
    const post = getFixtureBlogPost('pl', 'mercur-accessories-edit');
    expect(post).not.toBeNull();
    const toc = buildTocEntries(post!.slug, post!.content);
    expect(toc.length).toBeGreaterThanOrEqual(3);
    expect(toc[0]?.id).toBe(buildHeadingId(post!.slug, toc[0]!.label, 2));
    expect(toc.every(entry => entry.level >= 2 && entry.level <= 4)).toBe(true);
  });

  it('excludes the current post from related posts', () => {
    const post = getFixtureBlogPost('en', 'mercur-accessories-edit');
    expect(post?.relatedPosts.some(entry => entry.slug === post.slug)).toBe(false);
    expect(post?.relatedPosts).toHaveLength(3);
  });

  it('filters posts by tag using the deterministic fixture fallback', async () => {
    const result = await getBlogIndexData({
      locale: 'pl',
      fallbackLocale: 'pl',
      marketId: '',
      labels: LABELS,
      selectedTag: 'rituals'
    });

    expect(result.posts.length).toBeGreaterThan(0);
    expect(result.posts.every(post => post.tags.some(tag => tag.slug === 'rituals'))).toBe(true);
    expect(result.availableTags.some(tag => tag.slug === 'rituals')).toBe(true);
  });

  it('allows only explicit iframe providers', () => {
    expect(isAllowedIframeUrl('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe(true);
    expect(isAllowedIframeUrl('https://player.vimeo.com/video/1234')).toBe(true);
    expect(isAllowedIframeUrl('https://evil.example.com/widget')).toBe(false);
    expect(isAllowedIframeUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('Payload locale contract (QD-I18N-04 / CAP-4)', () => {
  it('sends the canonical Payload locale and refuses implicit cross-locale fallback', async () => {
    const calls = stubPayload({ uk: [PL_DOC] });

    await fetchHomepageBlogPageDocs({ marketId: 'bonbeauty', locale: 'ua', limit: 5 });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.searchParams.get('locale')).toBe('uk');
    expect(calls[0]!.url.searchParams.get('fallback-locale')).toBe('none');
    expect(calls[0]!.url.searchParams.get('where[tenant][equals]')).toBe('42');
  });

  it('puts the canonical locale into every cache tag (list and detail)', async () => {
    const calls = stubPayload({ de: [DE_DOC] });

    await fetchHomepageBlogPageDocs({ marketId: 'bonbeauty', locale: 'de' });
    await fetchBlogPageBySlug({ marketId: 'bonbeauty', locale: 'de', slug: 'poranny-rytual' });

    expect(calls[0]!.tags).toEqual(['pages-de']);
    expect(calls[1]!.tags).toEqual(['pages-de', 'page-poranny-rytual-de']);
    expect(calls[1]!.tags.every(tag => tag.endsWith('-de'))).toBe(true);
  });

  it('does not bleed between locales regardless of request order (PL→DE and DE→PL)', async () => {
    const firstCalls = stubPayload({ pl: [PL_DOC], de: [DE_DOC] });
    const plFirst = await fetchHomepageBlogPageDocs({ marketId: 'bonbeauty', locale: 'pl' });
    const deSecond = await fetchHomepageBlogPageDocs({ marketId: 'bonbeauty', locale: 'de' });

    expect(plFirst[0]?.title).toBe('Poranny rytuał');
    expect(deSecond[0]?.title).toBe('Morgenritual');
    expect(firstCalls.map(call => call.url.searchParams.get('locale'))).toEqual(['pl', 'de']);
    expect(new Set(firstCalls.flatMap(call => call.tags)).size).toBe(2);

    restoreEnvironment();

    const secondCalls = stubPayload({ pl: [PL_DOC], de: [DE_DOC] });
    const deFirst = await fetchHomepageBlogPageDocs({ marketId: 'bonbeauty', locale: 'de' });
    const plSecond = await fetchHomepageBlogPageDocs({ marketId: 'bonbeauty', locale: 'pl' });

    expect(deFirst[0]?.title).toBe('Morgenritual');
    expect(plSecond[0]?.title).toBe('Poranny rytuał');
    expect(secondCalls.map(call => call.url.searchParams.get('locale'))).toEqual(['de', 'pl']);
  });
});

describe('blog card fallback labels (AC3)', () => {
  it('takes every fallback label from the caller-supplied message catalogue', () => {
    const card = payloadPageToBlogCard(
      { slug: 'no-metadata', page_type: 'blog', _status: 'published' },
      0,
      LABELS
    );

    expect(card?.title).toBe('LABEL_untitled');
    expect(card?.excerpt).toBe('LABEL_excerpt');
    expect(card?.author.name).toBe('LABEL_author_name');
    expect(card?.author.role).toBe('LABEL_author_role');
    expect(card?.author.bio).toBe('LABEL_author_bio');
    expect(card?.contentFallbackLocale).toBeNull();
  });
});

describe('blog index fallback policy (AC1/AC2)', () => {
  it('serves the requested locale variant without a fallback marker', async () => {
    stubPayload({ de: [DE_DOC], pl: [PL_DOC] });

    const result = await getBlogIndexData({
      locale: 'de',
      fallbackLocale: 'pl',
      marketId: 'bonbeauty',
      labels: LABELS,
      selectedTag: null
    });

    const card = result.posts.find(post => post.slug === 'poranny-rytual');
    expect(card?.title).toBe('Morgenritual');
    expect(card?.excerpt).toBe('Deutscher Auszug');
    expect(card?.contentFallbackLocale).toBeNull();
  });

  it('marks the market-default variant when the requested locale has no translation', async () => {
    const calls = stubPayload({ de: [UNTRANSLATED_DOC], pl: [PL_DOC] });

    const result = await getBlogIndexData({
      locale: 'de',
      fallbackLocale: 'pl',
      marketId: 'bonbeauty',
      labels: LABELS,
      selectedTag: null
    });

    const card = result.posts.find(post => post.slug === 'poranny-rytual');
    expect(card?.title).toBe('Poranny rytuał');
    // The Polish copy is never presented as German: the marker is what the
    // route turns into a visible notice and a `lang` attribute.
    expect(card?.contentFallbackLocale).toBe('pl');
    expect(calls.map(call => call.url.searchParams.get('locale')).sort()).toEqual(['de', 'pl']);
  });

  it('never marks a fallback when the requested locale is the market default', async () => {
    const calls = stubPayload({ pl: [PL_DOC] });

    const result = await getBlogIndexData({
      locale: 'pl',
      fallbackLocale: 'pl',
      marketId: 'bonbeauty',
      labels: LABELS,
      selectedTag: null
    });

    expect(calls).toHaveLength(1);
    expect(
      result.posts.find(post => post.slug === 'poranny-rytual')?.contentFallbackLocale
    ).toBeNull();
  });
});
