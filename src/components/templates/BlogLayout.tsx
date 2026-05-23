import type { ReactNode } from 'react';

type BlogLayoutProps = {
  surface: 'W4-05' | 'W4-06' | 'W4-07';
  breadcrumbs?: ReactNode;
  hero?: ReactNode;
  content?: ReactNode;
  related?: ReactNode;
  title?: ReactNode;
  intro?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  heroImage?: string;
  heroImageAlt?: string;
  toc?: ReactNode;
  author?: unknown;
  authorHeading?: ReactNode;
  relatedHeading?: ReactNode;
  relatedPosts?: unknown;
  backToBlogLabel?: ReactNode;
  relatedCtaLabel?: ReactNode;
  newsletterSlot?: ReactNode;
  filters?: ReactNode;
  posts?: ReactNode;
  empty?: ReactNode;
  hasPosts?: boolean;
};

export function BlogLayout({ breadcrumbs, hero, content, related }: BlogLayoutProps) {
  return (
    <main
      id="main-content"
      className="bb-page-shell pb-16"
    >
      <div className="container space-y-8 py-4 md:space-y-10">
        {breadcrumbs}
        {hero}
        {content}
        {related}
      </div>
    </main>
  );
}
