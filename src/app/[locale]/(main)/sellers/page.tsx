import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Breadcrumbs } from '@/components/molecules/Breadcrumbs/Breadcrumbs';
import { SellerCard } from '@/components/organisms/seller/SellerCard';
import { getSellers } from '@/lib/data/seller';

export const revalidate = 60;

const DEFAULT_LIMIT = 24;
const DEFAULT_OFFSET = 0;

function parsePositiveInt(
  raw: string | string[] | undefined,
  fallback: number,
  { min, max }: { min: number; max: number }
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;
  const t = await getTranslations('sellers_list');
  const title = t('meta_title');
  const description = t('description');

  return {
    title,
    description,
    openGraph: {
      title,
      description
    }
  };
}

export default async function SellersListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await params;
  const sp = await searchParams;
  const limit = parsePositiveInt(sp.limit, DEFAULT_LIMIT, { min: 1, max: 100 });
  const offset = parsePositiveInt(sp.offset, DEFAULT_OFFSET, { min: 0, max: 10_000 });

  const t = await getTranslations('sellers_list');
  const tSellerPage = await getTranslations('seller_page');

  const allSellers = await getSellers();
  const total = allSellers.length;
  const pageItems = allSellers.slice(offset, offset + limit);

  return (
    <main id="main-content" className="container py-8">
      <Breadcrumbs
        items={[
          { label: tSellerPage('home'), href: '/' },
          { label: tSellerPage('salons'), href: '/sellers' }
        ]}
      />

      <h1 className="mt-6 mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-sm text-gray-500">{t('description')}</p>

      {pageItems.length === 0 ? (
        <p className="text-gray-500" data-testid="sellers-list-empty">
          {t('empty')}
        </p>
      ) : (
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
          data-testid="sellers-list-grid"
        >
          {pageItems.map((seller) => (
            <SellerCard
              key={seller.handle}
              name={seller.name}
              handle={seller.handle}
              photo_url={seller.photo_url}
              city={seller.city}
              product_count={seller.product_count}
            />
          ))}
        </div>
      )}

      {total > limit && (
        <nav
          className="mt-8 flex items-center justify-between text-sm text-gray-500"
          data-testid="sellers-list-pagination"
          aria-label={t('next_page')}
        >
          <span>
            {offset + 1}–{Math.min(offset + limit, total)} / {total}
          </span>
        </nav>
      )}
    </main>
  );
}
