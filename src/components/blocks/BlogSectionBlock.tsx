import { getLocale, getTranslations } from 'next-intl/server';

import { BlogSection } from '@/components/sections';
import { fetchHomepageBlogPosts } from '@/lib/homepage/dynamic-blocks';

export type BlogSectionSectionBlock = {
  heading?: string | null;
  limit?: number | null;
};

export async function BlogSectionBlock({ section }: { section: BlogSectionSectionBlock }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('blog')]);
  const posts = await fetchHomepageBlogPosts({
    locale,
    limit: section.limit,
    labels: {
      untitledPost: t('untitled_post'),
      excerptFallback: t('excerpt_fallback'),
      authorName: t('author_default_name'),
      authorRole: t('author_default_role'),
      authorBio: t('author_default_bio')
    }
  });

  return (
    <BlogSection
      key={`${section.heading ?? 'blog-section'}-${section.limit ?? 3}`}
      heading={section.heading ?? t('section_heading')}
      posts={posts}
      readMoreLabel={t('read_more')}
    />
  );
}
