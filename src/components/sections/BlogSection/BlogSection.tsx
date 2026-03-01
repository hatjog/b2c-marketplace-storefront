import { BlogCard } from '@/components/organisms';
import type { BlogPost } from '@/types/blog';

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Summer's Most Elegant Accessories",
    excerpt:
      "Discover this season's most sophisticated accessories that blend timeless elegance with modern design.",
    image: '/images/blog/post-1.jpg',
    category: 'ACCESSORIES',
    href: '#'
  },
  {
    id: 2,
    title: 'The Season’s Hottest Trends',
    excerpt:
      'From bold colors to nostalgic silhouettes, explore the must-have looks defining this season’s fashion narrative.',
    image: '/images/blog/post-2.jpg',
    category: 'STYLE GUIDE',
    href: '#'
  },
  {
    id: 3,
    title: 'Minimalist Outerwear Trends',
    excerpt:
      'Explore the latest minimalist outerwear pieces that combine functionality with clean aesthetics.',
    image: '/images/blog/post-3.jpg',
    category: 'TRENDS',
    href: '#'
  }
];

export function BlogSection({
  posts,
  heading
}: {
  posts?: BlogPost[];
  heading?: string;
} = {}) {
  const postsToRender = posts?.length ? posts : blogPosts;

  return (
    <section className="container bg-tertiary">
      <div className="mb-12 flex items-center justify-between">
        <h2 className="heading-lg text-tertiary">{heading ?? 'STAY UP TO DATE'}</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {postsToRender.map((post, index) => (
          <BlogCard
            key={post.id}
            index={index}
            post={post}
          />
        ))}
      </div>
    </section>
  );
}
