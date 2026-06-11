import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * BlogLayout — Stories 6.1 (W4-05/06/07 template foundation) + 6.4 (W4-07 reading layout).
 *
 * v1.9.0 Wave F7 hardening (Epic-6-Review F-02):
 *   - Re-implements the full Story 6.1 + 6.4 contract: every declared prop
 *     renders into the DOM tree.
 *   - W4-07 (blog post detail) renders the reading-column layout
 *     (max-w-720, sticky TOC on `md:`, Author card region, Related posts,
 *     inline Newsletter slot).
 *   - W4-05 (collection detail) + W4-06 (blog index) consume the
 *     simpler hero / filters / posts / empty / related shape.
 *   - All sections gated on prop presence so consumers may opt-out.
 */

type BlogSurface = 'W4-05' | 'W4-06' | 'W4-07';

type BlogLayoutAuthorCard = {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  href?: string;
} | null;

type BlogLayoutRelatedPost = {
  slug: string;
  title: string;
  href?: string;
  excerpt?: string;
  category?: string;
  heroImage?: string;
};

type BlogLayoutProps = {
  surface: BlogSurface;
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

function isAuthorCard(input: unknown): input is BlogLayoutAuthorCard {
  if (!input || typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.name === 'string' ||
    typeof value.bio === 'string' ||
    typeof value.avatarUrl === 'string' ||
    typeof value.href === 'string'
  );
}

function isRelatedPostList(input: unknown): input is BlogLayoutRelatedPost[] {
  return Array.isArray(input) && input.every(
    item => item && typeof item === 'object' && typeof (item as { slug?: unknown }).slug === 'string'
  );
}

function AuthorCard({
  author,
  heading
}: {
  author: BlogLayoutAuthorCard;
  heading?: ReactNode;
}) {
  if (!author) return null;
  return (
    <aside
      aria-label={typeof heading === 'string' ? heading : undefined}
      className="mt-10 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-strong)] p-6 md:p-7"
      data-testid="blog-author-card"
    >
      {heading ? <h2 className="bb-eyebrow mb-3">{heading}</h2> : null}
      <div className="flex items-start gap-4">
        {author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatarUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : null}
        <div className="flex flex-1 flex-col gap-1">
          {author.name ? (
            <p className="text-base font-medium text-[var(--text-primary)]">{author.name}</p>
          ) : null}
          {author.bio ? (
            <p className="text-sm text-[var(--text-secondary)]">{author.bio}</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function RelatedPostsGrid({
  posts,
  heading,
  ctaLabel
}: {
  posts: BlogLayoutRelatedPost[];
  heading?: ReactNode;
  ctaLabel?: ReactNode;
}) {
  if (!posts.length) return null;
  return (
    <section
      aria-label={typeof heading === 'string' ? heading : undefined}
      className="mt-12"
      data-testid="blog-related-posts"
    >
      {heading ? <h2 className="heading-sm mb-4 text-[var(--text-primary)]">{heading}</h2> : null}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {posts.map(post => (
          <li
            key={post.slug}
            className="rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4"
          >
            {post.heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.heroImage}
                alt=""
                className="mb-3 aspect-[4/3] w-full rounded-[var(--bb-radius-card)] object-cover"
              />
            ) : null}
            {post.category ? (
              <p className="bb-eyebrow mb-1 text-[var(--text-secondary)]">{post.category}</p>
            ) : null}
            <h3 className="mb-2 text-base font-medium text-[var(--text-primary)]">
              {post.href ? (
                <a
                  href={post.href}
                  className="hover:underline focus:outline-none focus:underline"
                >
                  {post.title}
                </a>
              ) : (
                post.title
              )}
            </h3>
            {post.excerpt ? (
              <p className="mb-2 text-sm text-[var(--text-secondary)]">{post.excerpt}</p>
            ) : null}
            {ctaLabel && post.href ? (
              <a
                href={post.href}
                className="text-sm font-medium text-[var(--text-primary)] underline underline-offset-4"
              >
                {ctaLabel}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeroBand({
  eyebrow,
  title,
  intro,
  meta,
  heroImage,
  heroImageAlt
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  intro?: ReactNode;
  meta?: ReactNode;
  heroImage?: string;
  heroImageAlt?: string;
}) {
  if (!eyebrow && !title && !intro && !meta && !heroImage) return null;
  return (
    <section
      className="mb-6 flex flex-col gap-3 md:mb-8"
      data-testid="blog-hero-band"
    >
      {heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImage}
          alt={heroImageAlt ?? ''}
          className="aspect-[16/9] w-full rounded-[var(--bb-radius-card)] object-cover"
        />
      ) : null}
      {eyebrow ? <p className="bb-eyebrow text-[var(--text-secondary)]">{eyebrow}</p> : null}
      {title ? <h1 className="heading-lg text-[var(--text-primary)]">{title}</h1> : null}
      {intro ? <p className="text-lg text-[var(--text-secondary)]">{intro}</p> : null}
      {meta ? <div>{meta}</div> : null}
    </section>
  );
}

export function BlogLayout(props: BlogLayoutProps) {
  const {
    surface,
    breadcrumbs,
    hero,
    content,
    related,
    title,
    intro,
    eyebrow,
    meta,
    heroImage,
    heroImageAlt,
    toc,
    author,
    authorHeading,
    relatedHeading,
    relatedPosts,
    backToBlogLabel,
    relatedCtaLabel,
    newsletterSlot,
    filters,
    posts,
    empty,
    hasPosts
  } = props;

  const isPost = surface === 'W4-07';
  const isIndex = surface === 'W4-06';
  const authorCard = isAuthorCard(author) ? author : null;
  const relatedPostsList = isRelatedPostList(relatedPosts) ? relatedPosts : [];

  return (
    <main
      id="main-content"
      className="bb-page-shell pb-16"
    >
      <div className="container space-y-6 py-4 md:space-y-8">
        {breadcrumbs}

        {/* W4-05 (collection detail) supplies a custom `hero` slot;
            W4-06 + W4-07 use structured fields (eyebrow/title/intro/meta/heroImage). */}
        {hero
          ? hero
          : (
            <HeroBand
              eyebrow={eyebrow}
              title={title}
              intro={intro}
              meta={meta}
              heroImage={heroImage}
              heroImageAlt={heroImageAlt}
            />
          )}

        {isPost ? (
          <div
            className={cn(
              'mt-2 grid grid-cols-1 gap-6',
              toc ? 'md:grid-cols-[240px_minmax(0,720px)] md:gap-10' : 'md:grid-cols-1'
            )}
          >
            {toc ? (
              <aside
                className="md:sticky md:top-24 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto"
                data-testid="blog-post-toc"
              >
                {toc}
              </aside>
            ) : null}
            <article
              className="mx-auto w-full max-w-[720px]"
              data-testid="blog-post-reading-column"
            >
              {content}
              {newsletterSlot ? <div className="mt-10">{newsletterSlot}</div> : null}
              <AuthorCard
                author={authorCard}
                heading={authorHeading}
              />
              {relatedPostsList.length > 0 ? (
                <RelatedPostsGrid
                  posts={relatedPostsList}
                  heading={relatedHeading}
                  ctaLabel={relatedCtaLabel}
                />
              ) : (
                related
              )}
              {backToBlogLabel ? (
                <p className="mt-8 text-sm">
                  <a
                    href="/blog"
                    className="underline decoration-[var(--bb-text-tint-22)] underline-offset-4"
                  >
                    {backToBlogLabel}
                  </a>
                </p>
              ) : null}
            </article>
          </div>
        ) : (
          <>
            {filters ? <div className="mb-4">{filters}</div> : null}
            {hasPosts === false && empty ? (
              empty
            ) : (
              <div>
                {posts}
                {content}
              </div>
            )}
            {isIndex && newsletterSlot ? <div className="mt-10">{newsletterSlot}</div> : null}
            {related}
          </>
        )}
      </div>
    </main>
  );
}
