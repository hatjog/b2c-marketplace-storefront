// @chrome-manifest: W6-03 (renders <NewsletterSlot> chrome organism inline)
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/atoms';
import { NewsletterSlot } from '@/components/organisms';
import { BlogLayout, BlogRichText, BlogTocNav } from '@/components/templates';
import { fetchPayloadBlogPage } from '@/data/payload-pages';
import { type SupportedLocale } from '@/i18n/routing';
import { buildTocEntries, formatBlogPublishedDate } from '@/lib/blog';
import { formatFallbackLanguageName, payloadLocaleToBcp47 } from '@/lib/blog-locale';
import { getMarketDefaultLocale } from '@/lib/market-locales';
import { buildLocaleAlternates } from '@/lib/seo/hreflang';

export const revalidate = 600;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

// Story 1.1 v1.14.0 AC1 — alternates built from the market-aware locale resolver,
// not a hardcoded SUPPORTED_LOCALES iteration; x-default follows locales.default.
async function buildBlogPostAlternates(baseUrl: string, locale: string, slug: string) {
  return buildLocaleAlternates(locale, loc => `/${loc}/blog/${slug}`, baseUrl);
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const page = await fetchPayloadBlogPage({
    locale: locale as SupportedLocale,
    fallbackLocale: await getMarketDefaultLocale(),
    marketId,
    slug
  });

  if (!page) {
    return {};
  }

  const baseUrl = await getBaseUrl();
  const alternates = await buildBlogPostAlternates(baseUrl, locale, page.slug);
  const openGraphImage = page.heroImage.startsWith('http')
    ? page.heroImage
    : `${baseUrl}${page.heroImage}`;

  return {
    title: page.seo.title,
    description: page.seo.description,
    alternates,
    openGraph: {
      title: page.seo.title,
      description: page.seo.description,
      type: 'article',
      url: alternates.canonical,
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
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const page = await fetchPayloadBlogPage({
    locale: locale as SupportedLocale,
    fallbackLocale: await getMarketDefaultLocale(),
    marketId,
    slug
  });

  if (!page) {
    return notFound();
  }

  // CAP-4 — a fallback article is labelled as such and carries its own `lang`;
  // the surrounding page chrome stays in the route locale.
  const fallbackLocale = page.contentFallbackLocale;
  const contentLang = fallbackLocale ? payloadLocaleToBcp47(fallbackLocale) : undefined;
  const contentNotice = fallbackLocale ? (
    <p
      role="note"
      data-testid="blog-content-fallback-notice"
      data-fallback-locale={fallbackLocale}
      className="mb-6 rounded-[var(--bb-radius-card)] border border-dashed border-[var(--bb-tint-gold-24)] bg-[var(--bb-tint-gold-05)] px-4 py-3 text-sm text-secondary"
    >
      {t('content_fallback_notice', {
        language: formatFallbackLanguageName(fallbackLocale, locale)
      })}
    </p>
  ) : null;

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
            { path: '/', label: t('breadcrumb_home') },
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
      contentLang={contentLang}
      contentNotice={contentNotice}
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
