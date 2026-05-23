import { getTranslations } from 'next-intl/server';

import { BlogCard } from '@/components/organisms';
import type { BlogPost } from '@/types/blog';

const placeholderAuthor = {
  id: 'placeholder',
  name: '',
  slug: 'placeholder',
  role: '',
  bio: ''
};

export const blogPosts: BlogPost[] = [
  {
    id: '1',
    slug: 'summer-elegant-accessories',
    title: "Summer's Most Elegant Accessories",
    excerpt:
      "Discover this season's most sophisticated accessories that blend timeless elegance with modern design.",
    image: '/images/blog/post-1.jpg',
    imageAlt: '',
    category: 'ACCESSORIES',
    href: '#',
    tags: [],
    author: placeholderAuthor,
    readTimeMinutes: 0,
    publishedAt: null
  },
  {
    id: '2',
    slug: 'season-hottest-trends',
    title: 'The Season’s Hottest Trends',
    excerpt:
      'From bold colors to nostalgic silhouettes, explore the must-have looks defining this season’s fashion narrative.',
    image: '/images/blog/post-2.jpg',
    imageAlt: '',
    category: 'STYLE GUIDE',
    href: '#',
    tags: [],
    author: placeholderAuthor,
    readTimeMinutes: 0,
    publishedAt: null
  },
  {
    id: '3',
    slug: 'minimalist-outerwear-trends',
    title: 'Minimalist Outerwear Trends',
    excerpt:
      'Explore the latest minimalist outerwear pieces that combine functionality with clean aesthetics.',
    image: '/images/blog/post-3.jpg',
    imageAlt: '',
    category: 'TRENDS',
    href: '#',
    tags: [],
    author: placeholderAuthor,
    readTimeMinutes: 0,
    publishedAt: null
  }
];

export async function BlogSection({
  posts,
  heading,
  readMoreLabel,
}: {
  posts?: BlogPost[];
  heading?: string;
  readMoreLabel?: string;
} = {}) {
  const t = await getTranslations('homepage');
  const postsToRender = posts?.length ? posts : blogPosts;

  return (
    <section className="bb-section-shell w-full bg-transparent">
      <div className="mb-8 space-y-2">
        <p className="bb-eyebrow">{t('blog_eyebrow')}</p>
        <h2 className="heading-lg text-primary">{heading ?? 'Stay up to date'}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {postsToRender.map((post, index) => (
          <BlogCard
            key={post.id}
            index={index}
            post={post}
            readMoreLabel={readMoreLabel}
          />
        ))}
      </div>
    </section>
  );
}
