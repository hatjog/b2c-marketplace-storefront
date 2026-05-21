import type { ReactNode } from 'react';

type BlogLayoutProps = {
  surface: 'W4-05';
  breadcrumbs: ReactNode;
  hero: ReactNode;
  content: ReactNode;
  related: ReactNode;
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
