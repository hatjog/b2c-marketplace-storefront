import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { BlogLayout } from '@/components/templates';
import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { getBlogIndexData } from '@/lib/blog';
import { toHreflang } from '@/lib/helpers/hreflang';

export const revalidate = 600;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

function buildBlogIndexAlternates(baseUrl: string, locale: string) {
  const languages = SUPPORTED_LOCALES.reduce<Record<string, string>>((acc, code) => {
    acc[toHreflang(code)] = new URL(`/${code}/blog`, `${baseUrl}/`).toString();
    return acc;
  }, {});

  return {
    canonical: new URL(`/${locale}/blog`, `${baseUrl}/`).toString(),
    languages: {
      ...languages,
      'x-default': new URL('/pl/blog', `${baseUrl}/`).toString()
    }
  };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = await getBaseUrl();
  const alternates = buildBlogIndexAlternates(baseUrl, locale);
  const t = await getTranslations('blog');

  return {
    title: t('title'),
    description: t('description'),
    alternates,
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      url: alternates.canonical
    }
  };
}

export default async function BlogIndexPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const [{ locale }, resolvedSearchParams, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('blog')
  ]);
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const selectedTag = resolvedSearchParams.tag || null;
  const {
    posts,
    availableTags,
    selectedTag: activeTag
  } = await getBlogIndexData({
    locale: locale as 'pl' | 'en' | 'ua' | 'de',
    marketId,
    selectedTag
  });

  const filters = (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">
        {t('filter_label')}
      </p>
      <div
        className="flex flex-wrap gap-3"
        role="list"
        aria-label={t('filter_label')}
      >
        <span role="listitem">
          <LocalizedClientLink
            href="/blog"
            aria-current={!activeTag ? 'page' : undefined}
            className={`inline-block rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)] ${
              !activeTag
                ? 'border-[var(--bg-action)] bg-[var(--bb-tint-gold-12)] text-primary'
                : 'border-[var(--bb-border-soft)] text-secondary hover:text-primary'
            }`}
          >
            {t('tag_all')}
          </LocalizedClientLink>
        </span>
        {availableTags.map(tag => (
          <span role="listitem" key={tag.slug}>
            <LocalizedClientLink
              href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
              aria-current={activeTag === tag.slug ? 'page' : undefined}
              className={`inline-block rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)] ${
                activeTag === tag.slug
                  ? 'border-[var(--bg-action)] bg-[var(--bb-tint-gold-12)] text-primary'
                  : 'border-[var(--bb-border-soft)] text-secondary hover:text-primary'
              }`}
            >
              {tag.label}
            </LocalizedClientLink>
          </span>
        ))}
      </div>
    </div>
  );

  const postsGrid = (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {posts.map(post => (
        <LocalizedClientLink
          key={post.slug}
          href={post.href}
          className="group flex h-full flex-col overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white transition-transform duration-300 hover:-translate-y-0.5"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={post.image}
              alt={post.imageAlt}
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
              <span>{post.category}</span>
              <span>{t('min_read', { minutes: post.readTimeMinutes })}</span>
            </div>
            <h2 className="heading-sm text-primary">{post.title}</h2>
            <p className="line-clamp-3 text-sm leading-6 text-secondary">{post.excerpt}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-secondary">
              <span>{post.author.name}</span>
              {post.tags.slice(0, 2).map(tag => (
                <span
                  key={tag.slug}
                  className="rounded-full bg-[var(--bb-tint-gold-08)] px-2.5 py-1"
                >
                  {tag.label}
                </span>
              ))}
            </div>
            <span className="label-md uppercase text-primary">{t('read_article')}</span>
          </div>
        </LocalizedClientLink>
      ))}
    </div>
  );

  const emptyState = (
    <div
      className="rounded-[var(--bb-radius-card)] border border-dashed border-[var(--bb-tint-gold-24)] bg-[var(--bb-tint-gold-05)] px-6 py-10 text-center"
      data-testid="blog-index-empty-state"
    >
      <h2 className="heading-sm text-primary">{t('empty_heading')}</h2>
      <p className="mt-3 text-sm leading-6 text-secondary">{t('empty_body')}</p>
      <LocalizedClientLink
        href="/blog"
        className="label-md mt-5 inline-flex uppercase text-primary"
      >
        {t('reset_filters')}
      </LocalizedClientLink>
    </div>
  );

  return (
    <BlogLayout
      surface="W4-06"
      title={t('title')}
      intro={t('editorial_intro')}
      eyebrow={t('journal')}
      filters={filters}
      posts={postsGrid}
      empty={emptyState}
      hasPosts={posts.length > 0}
    />
  );
}