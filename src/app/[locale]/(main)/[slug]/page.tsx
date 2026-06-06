import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BlogRichText } from '@/components/templates';
import { fetchPayloadPage } from '@/data/payload-pages/fetchPayloadPage';

/**
 * Catch-all content-page route for Payload `Pages` with page_type === 'page'
 * (faq, o-nas, kontakt, ...). Static sibling routes (categories, sellers, blog,
 * cart, user, regulamin, polityka-prywatnosci, pomoc, ...) take priority in
 * Next.js routing; this dynamic segment only resolves otherwise-unmatched
 * top-level paths and 404s when no published Payload page matches the slug.
 *
 * Content is tenant-scoped (multi-tenant) and locale-aware (native Payload
 * localization, fallback → pl).
 */

type PageParams = Promise<{ locale: string; slug: string }>;

// Next.js requires a literal for the `revalidate` segment config (no const indirection).
export const revalidate = 600;

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, slug } = await params;
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const page = await fetchPayloadPage({ locale, slug, marketId });

  if (!page) {
    return {};
  }

  return {
    title: page.seo.title,
    description: page.seo.description,
    alternates: page.seo.canonicalUrl ? { canonical: page.seo.canonicalUrl } : undefined,
    robots: page.seo.robots ?? undefined
  };
}

export default async function ContentPage({ params }: { params: PageParams }) {
  const { locale, slug } = await params;
  const marketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
  const page = await fetchPayloadPage({ locale, slug, marketId });

  if (!page) {
    notFound();
  }

  return (
    <main id="main-content" className="bb-page-shell mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <article data-testid="content-page" data-slug={page.slug}>
        <h1 className="mb-6 text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
          {page.title}
        </h1>
        {page.excerpt ? (
          <p className="mb-8 text-lg text-[var(--text-secondary)]">{page.excerpt}</p>
        ) : null}
        <div className="bb-prose">
          <BlogRichText content={page.content} />
        </div>
      </article>
    </main>
  );
}
