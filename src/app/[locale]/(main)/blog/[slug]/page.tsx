import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  extractLexicalParagraphs,
  fetchBlogPageBySlug,
  formatBlogPublishedDate,
  getBlogCategory,
  getBlogDescription,
  getBlogHref,
  getPageImageUrl
} from '@/lib/blog';

export const revalidate = 600;

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') || 'https';

  return process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
}

async function getBlogPage(slug: string) {
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';

  return fetchBlogPageBySlug({
    marketId,
    slug
  });
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const page = await getBlogPage(slug);

  if (!page) {
    return {};
  }

  const baseUrl = await getBaseUrl();
  const title = page.title || page.name || 'Blog';
  const description = getBlogDescription(page);
  const blogPath = getBlogHref(page);
  const canonical = new URL(`/${locale}${blogPath}`, `${baseUrl}/`).toString();
  const imageUrl = getPageImageUrl(page, 0, { preferHeroImage: true });
  const openGraphImage = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonical,
      images: [
        {
          url: openGraphImage,
          alt: title
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
  const page = await getBlogPage(slug);

  if (!page) {
    return notFound();
  }

  const title = page.title || page.name || 'Untitled post';
  const description = getBlogDescription(page);
  const category = getBlogCategory(page);
  const publishedDate = formatBlogPublishedDate(page.publishedAt, locale);
  const imageUrl = getPageImageUrl(page, 0, { preferHeroImage: true });
  const paragraphs = extractLexicalParagraphs(page.content);
  const bodyParagraphs = paragraphs.length > 0 ? paragraphs : [];

  return (
    <main className="container py-8 md:py-12">
      <div className="mb-4 hidden md:block">
        <Breadcrumbs
          items={[
            { path: '/', label: 'Home' },
            { path: '/blog', label: 'Blog' },
            { path: `/blog/${page.slug || slug}`, label: title }
          ]}
        />
      </div>

      <article
        className="mx-auto flex max-w-4xl flex-col gap-8"
        data-testid="blog-article"
      >
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.24em] text-secondary">
            <span data-testid="blog-article-category">{category}</span>
            {publishedDate ? <span data-testid="blog-article-date">{publishedDate}</span> : null}
          </div>

          <h1
            className="heading-xl max-w-3xl"
            data-testid="blog-article-title"
          >
            {title}
          </h1>

          <p className="max-w-3xl text-lg leading-8 text-secondary">{description}</p>
        </header>

        <div className="relative overflow-hidden rounded-sm bg-quaternary">
          <Image
            src={imageUrl}
            alt={title}
            width={1440}
            height={960}
            priority
            className="h-auto w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-5 text-base leading-8 text-primary">
          {bodyParagraphs.length > 0 ? (
            bodyParagraphs.map((paragraph, index) => <p key={`${page.slug || slug}-${index}`}>{paragraph}</p>)
          ) : (
            <p>
              {description} Follow the latest edits on the homepage to track what is currently being
              highlighted for this market.
            </p>
          )}
        </div>

        <div className="border-t border-secondary pt-6">
          <LocalizedClientLink
            href="/blog"
            className="label-md inline-flex items-center uppercase text-primary transition-opacity hover:opacity-70"
          >
            Back to blog
          </LocalizedClientLink>
        </div>
      </article>
    </main>
  );
}