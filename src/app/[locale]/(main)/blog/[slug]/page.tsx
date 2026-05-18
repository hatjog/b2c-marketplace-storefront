import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/atoms';
import { NewsletterSlot } from '@/components/organisms';
import { BlogLayout, BlogRichText, BlogTocNav } from '@/components/templates';
import { buildTocEntries, formatBlogPublishedDate, getBlogPostDetail } from '@/lib/blog';

export const revalidate = 600;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const page = await getBlogPostDetail({
    locale: locale as 'pl' | 'en' | 'ua' | 'de',
    marketId,
    slug
  });

  if (!page) {
    return {};
  }

  const baseUrl = await getBaseUrl();
  const canonical = new URL(`/${locale}/blog/${page.slug}`, `${baseUrl}/`).toString();
  const openGraphImage = page.heroImage.startsWith('http')
    ? page.heroImage
    : `${baseUrl}${page.heroImage}`;

  return {
    title: page.title,
    description: page.excerpt,
    alternates: {
      canonical
    },
    openGraph: {
      title: page.title,
      description: page.excerpt,
      type: 'article',
      url: canonical,
      images: [
        {
          url: openGraphImage,
          alt: page.heroImageAlt
        }
      ]
    }
  };
}

export default async function BlogArticlePage({
  params
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const [{ slug, locale }, t] = await Promise.all([params, getTranslations('blog')]);
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const page = await getBlogPostDetail({
    locale: locale as 'pl' | 'en' | 'ua' | 'de',
    marketId,
    slug
  });

  if (!page) {
    return notFound();
  }

  const tocEntries = buildTocEntries(page.slug, page.content);
  const publishedDate = formatBlogPublishedDate(page.publishedAt, locale);
  const updatedDate = formatBlogPublishedDate(page.updatedAt, locale);

  const meta = (
    <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-secondary">
      <span data-testid="blog-article-category">{page.category}</span>
      <span>{t('min_read', { minutes: page.readTimeMinutes })}</span>
      {publishedDate ? (
        <span data-testid="blog-article-date">
          {t('published_label')}: {publishedDate}
        </span>
      ) : null}
      {updatedDate ? (
        <span>
          {t('updated_label')}: {updatedDate}
        </span>
      ) : null}
    </div>
  );

  return (
    <BlogLayout
      surface="W4-07"
      breadcrumbs={
        <Breadcrumbs
          items={[
            { path: '/', label: 'Home' },
            { path: '/blog', label: t('title') },
            { path: `/blog/${page.slug}`, label: page.title }
          ]}
        />
      }
      eyebrow={page.category}
      title={page.title}
      intro={page.excerpt}
      meta={meta}
      heroImage={page.heroImage}
      heroImageAlt={page.heroImageAlt}
      toc={
        tocEntries.length > 0 ? (
          <BlogTocNav
            label={t('toc_label')}
            mobileLabel={t('toc_mobile_label')}
            entries={tocEntries}
          />
        ) : null
      }
      content={
        <BlogRichText
          slug={page.slug}
          content={page.content}
          disallowedEmbedLabel={t('disallowed_embed')}
          inlineEmbedLabel={t('inline_embed_label')}
        />
      }
      author={page.author}
      authorHeading={t('author_heading')}
      relatedHeading={t('related_heading')}
      relatedPosts={page.relatedPosts}
      backToBlogLabel={t('back_to_blog')}
      relatedCtaLabel={t('read_article')}
      newsletterSlot={
        <NewsletterSlot
          locale={locale}
          variant="inline-body"
        />
      }
    />
  );
}
