// W1-01 Home v3 — Journal teaser.
// BonBeauty DS v2.1.0: bb-surface, bb-radius-card, bb-shadow-card, card-journal tokens.
// Story 3.0 Sprint 1 thin slice gate.

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

const DEFAULT_POSTS: JournalPost[] = [
  {
    id: '1',
    title: 'Jak wybrać idealny zabieg na prezent?',
    excerpt: 'Poradnik, który pomoże Ci znaleźć wyjątkowy upominek dla bliskiej osoby.',
    href: '/blog/jak-wybrac-idealny-zabieg',
    category: 'Prezenty',
    readTime: 4,
  },
  {
    id: '2',
    title: 'Trendy pielęgnacji na 2025',
    excerpt: 'Najważniejsze zabiegi i techniki, które zdominują salony beauty w nowym roku.',
    href: '/blog/trendy-pielegnacji-2025',
    category: 'Trendy',
    readTime: 6,
  },
  {
    id: '3',
    title: 'Cicha luksus — dlaczego prostota to nowa elegancja',
    excerpt: 'Minimalizm w beauty wraca w wielkim stylu. Poznaj salony, które to rozumieją.',
    href: '/blog/cicha-luksus',
    category: 'Styl życia',
    readTime: 5,
  },
];

export function JournalTeaserBlock({
  heading = 'Z Journala',
  posts = DEFAULT_POSTS,
  ctaLabel = 'Czytaj więcej',
  ctaHref = '/blog',
}: JournalTeaserBlockProps) {
  return (
    <section
      className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8"
      data-testid="journal-teaser"
      aria-labelledby="journal-teaser-heading"
    >
      <div className="mb-8 flex items-center justify-between">
        <h2
          id="journal-teaser-heading"
          className="text-xl font-semibold text-[var(--text-primary)] md:text-2xl"
        >
          {heading}
        </h2>
        <LocalizedClientLink
          href={ctaHref}
          className="text-sm font-medium text-[var(--cta)] hover:underline"
        >
          {ctaLabel}
        </LocalizedClientLink>
      </div>

      {/* Journal cards grid — card-journal token for background */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <LocalizedClientLink
            key={post.id}
            href={post.href}
            className="group flex flex-col overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] transition-shadow hover:shadow-[var(--bb-shadow-card,var(--bb-shadow-soft))]"
            style={{ background: 'rgba(255,252,247,0.92)' }}
            data-testid={`journal-card-${post.id}`}
          >
            {/* Image placeholder */}
            <div className="h-36 bg-[var(--bb-surface-muted)]" aria-hidden="true" />

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
                <span className="text-xs text-[var(--text-muted,var(--text-secondary))]">{post.readTime} min czytania</span>
              )}
            </div>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  );
}
