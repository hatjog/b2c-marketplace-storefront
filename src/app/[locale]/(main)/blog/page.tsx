import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';

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

  return {
    title: 'Blog',
    description: 'Latest editorial updates and market-specific stories from the storefront.',
    alternates: {
      canonical
    },
    openGraph: {
      title: 'Blog',
      description: 'Latest editorial updates and market-specific stories from the storefront.',
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
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const pages = await fetchHomepageBlogPageDocs({
    marketId,
    limit: 24
  });

  return (
    <main className="container py-8 md:py-12">
      <section className="mx-auto flex max-w-6xl flex-col gap-8" data-testid="blog-index">
        <header className="flex max-w-3xl flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-secondary">Journal</p>
          <h1 className="heading-xl" data-testid="blog-index-title">Blog</h1>
          <p className="text-lg leading-8 text-secondary">
            Market-scoped stories, launch notes and editorial selections published from Payload.
          </p>
        </header>

        {pages.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pages.map((page, index) => {
              const title = page.title || page.name || 'Untitled post';
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
                    <span className="label-md mt-auto uppercase text-primary">Read article</span>
                  </div>
                </LocalizedClientLink>
              );
            })}
          </div>
        ) : (
          <div className="rounded-sm border border-secondary p-6 text-secondary">
            No published blog posts are available for this market yet.
          </div>
        )}
      </section>
    </main>
  );
}