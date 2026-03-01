import { BlogSection } from '@/components/sections';
import { fetchHomepageBlogPosts } from '@/lib/homepage/dynamic-blocks';

export type BlogSectionSectionBlock = {
  heading?: string | null;
  limit?: number | null;
};

export async function BlogSectionBlock({ section }: { section: BlogSectionSectionBlock }) {
  const posts = await fetchHomepageBlogPosts({
    limit: section.limit
  });

  if (posts.length === 0) {
    return null;
  }

  return (
    <BlogSection
      key={`${section.heading ?? 'blog-section'}-${section.limit ?? 3}`}
      heading={section.heading ?? 'STAY UP TO DATE'}
      posts={posts}
    />
  );
}
