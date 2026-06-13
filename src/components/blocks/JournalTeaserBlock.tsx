// W1-01 Home v3 — Journal teaser.
// BonBeauty DS v2.1.0: bb-surface, bb-radius-card, bb-shadow-card, card-journal tokens.
// Story 3.0 Sprint 1 thin slice gate.
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

interface JournalPost {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  imageUrl?: string;
  category?: string;
  readTime?: number;
}

interface JournalTeaserBlockProps {
  heading?: string;
  posts?: JournalPost[];
  ctaLabel?: string;
  ctaHref?: string;
  locale: string;
}

function buildDefaultPosts(t: Awaited<ReturnType<typeof getTranslations>>): JournalPost[] {
  return [
    {
      id: '1',
      title: t('journal.posts.1.title'),
      excerpt: t('journal.posts.1.excerpt'),
      href: '/blog',
      imageUrl: '/images/blog/post-1.jpg',
      category: t('journal.posts.1.category'),
      readTime: 4,
    },
    {
      id: '2',
      title: t('journal.posts.2.title'),
      excerpt: t('journal.posts.2.excerpt'),
      href: '/blog',
      imageUrl: '/images/blog/post-2.jpg',
      category: t('journal.posts.2.category'),
      readTime: 5,
    },
    {
      id: '3',
      title: t('journal.posts.3.title'),
      excerpt: t('journal.posts.3.excerpt'),
      href: '/blog',
      imageUrl: '/images/blog/post-3.jpg',
      category: t('journal.posts.3.category'),
      readTime: 6,
    },
  ];
}

export async function JournalTeaserBlock({
  heading,
  posts,
  ctaLabel,
  ctaHref,
  locale,
}: JournalTeaserBlockProps) {
  const t = await getTranslations({ locale, namespace: 'home_v3' });
  const resolvedHeading = heading ?? t('journal.heading');
  const resolvedPosts = posts ?? buildDefaultPosts(t);
  const resolvedCtaLabel = ctaLabel ?? t('journal.cta_label');
  const resolvedCtaHref = ctaHref ?? '/blog';

  return (
    <section
      className="bb-section-shell bb-section-shell-soft mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8"
      data-testid="journal-teaser"
      aria-labelledby="journal-teaser-heading"
    >
      <div className="mb-8 flex items-center justify-between">
        <h2
          id="journal-teaser-heading"
          className="text-xl font-semibold text-[var(--text-primary)] md:text-2xl"
        >
          {resolvedHeading}
        </h2>
        <LocalizedClientLink
          href={resolvedCtaHref}
          className="text-sm font-medium text-[var(--cta)] hover:underline"
        >
          {resolvedCtaLabel}
        </LocalizedClientLink>
      </div>

      {/* Journal cards grid — card-journal token for background */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resolvedPosts.map((post) => (
          <LocalizedClientLink
            key={post.id}
            href={post.href}
            className="group flex flex-col overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] transition-shadow hover:shadow-[var(--bb-shadow-card,var(--bb-shadow-soft))]"
            style={{ background: 'var(--bb-surface)' }}
            data-testid={`journal-card-${post.id}`}
          >
            {post.imageUrl ? (
              <Image
                src={post.imageUrl}
                alt={post.title}
                width={520}
                height={320}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                data-testid={`journal-card-image-${post.id}`}
              />
            ) : (
              <div className="h-36 bg-[var(--bb-surface-muted)]" aria-hidden="true" />
            )}

            <div className="flex flex-1 flex-col gap-2 p-4">
              {post.category && (
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--cta)]">
                  {post.category}
                </span>
              )}
              <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--cta)]">
                {post.title}
              </h3>
              <p className="flex-1 text-xs text-[var(--text-secondary)] line-clamp-2">
                {post.excerpt}
              </p>
              {post.readTime && (
                <span className="text-xs text-[var(--text-muted,var(--text-secondary))]">
                  {t('journal.read_time_minutes', { count: post.readTime })}
                </span>
              )}
            </div>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  );
}
