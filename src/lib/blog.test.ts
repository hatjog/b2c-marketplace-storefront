import { describe, expect, it } from 'vitest';

import { getFixtureBlogCards, getFixtureBlogPost } from '@/lib/blog-fixtures';

import { buildHeadingId, buildTocEntries, getBlogIndexData, isAllowedIframeUrl } from './blog';

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
      marketId: '',
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
