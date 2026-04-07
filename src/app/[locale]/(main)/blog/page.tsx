import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  fetchHomepageBlogPageDocs,
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

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = await getBaseUrl();
  const canonical = new URL(`/${locale}/blog`, `${baseUrl}/`).toString();
  const t = await getTranslations('blog');

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      url: canonical
    }
  };
}

export default async function BlogIndexPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('blog');
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const pages = await fetchHomepageBlogPageDocs({
    marketId,
    limit: 24
  });

  return (
    <main id="main-content" className="bb-page-shell">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8" data-testid="blog-index">
        <header className="bb-section-shell bb-section-shell-strong flex max-w-4xl flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-secondary">{t('journal')}</p>
          <h1 className="heading-xl" data-testid="blog-index-title">{t('title')}</h1>
          <p className="text-lg leading-8 text-secondary">
            {t('subtitle')}
          </p>
        </header>

        {pages.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pages.map((page, index) => {
              const title = page.title || page.name || t('untitled_post');
              const description = getBlogDescription(page);
              const href = getBlogHref(page);
              const publishedDate = formatBlogPublishedDate(page.publishedAt, locale);

              return (
                <LocalizedClientLink
                  key={page.slug || page.id || index}
                  href={href}
                  className="group flex h-full flex-col overflow-hidden rounded-sm border border-secondary bg-tertiary transition-opacity hover:opacity-90"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={getPageImageUrl(page, index)}
                      alt={title}
                      fill
                      sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-4 p-5 text-tertiary">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
                      <span>{getBlogCategory(page)}</span>
                      {publishedDate ? <span>{publishedDate}</span> : null}
                    </div>

                    <h2 className="heading-sm">{title}</h2>
                    <p className="line-clamp-3 text-base leading-7 text-secondary">{description}</p>
                    <span className="label-md mt-auto uppercase text-primary">{t('read_article')}</span>
                  </div>
                </LocalizedClientLink>
              );
            })}
          </div>
        ) : (
          <div className="bb-section-shell text-secondary">
            {t('no_posts')}
          </div>
        )}
      </section>
    </main>
  );
}