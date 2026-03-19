import { getTranslations } from 'next-intl/server';

import { BlogSection } from '@/components/sections';
import { fetchHomepageBlogPosts } from '@/lib/homepage/dynamic-blocks';

export type BlogSectionSectionBlock = {
  heading?: string | null;
  limit?: number | null;
};

export async function BlogSectionBlock({ section }: { section: BlogSectionSectionBlock }) {
  const [posts, t] = await Promise.all([
    fetchHomepageBlogPosts({ limit: section.limit }),
    getTranslations('blog'),
  ]);

  return (
    <BlogSection
      key={`${section.heading ?? 'blog-section'}-${section.limit ?? 3}`}
      heading={section.heading ?? t('section_heading')}
      posts={posts}
      readMoreLabel={t('read_more')}
    />
  );
}
