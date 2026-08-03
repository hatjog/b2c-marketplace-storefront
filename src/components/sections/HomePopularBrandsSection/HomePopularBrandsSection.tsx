/**
 * HomePopularBrandsSection — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Hardcoded "POPULAR BRANDS" replaced with i18n key (discovery.popular_salons).
 *     Brands/salons section is now locale-aware.
 *
 * v1.7.0 Story 2.2 re-review fix (MEDIUM M4'): the earlier I2 fix renamed the
 * placeholder labels (Balenciaga → Salon Lumière, etc.) but kept the `logo`
 * paths pointing at the original fashion-brand SVGs that are still on disk.
 * That made the leak WORSE — `<img alt="Salon Lumière">` would render the
 * literal Balenciaga wordmark, lying to assistive tech and SR users. The
 * section is CMS-driven in production anyway. Cleanest fix: return null
 * outside of non-production environments so dev preview no longer shows the
 * mismatched assets, and production gets nothing here until CMS wiring lands.
 */
import { getTranslations } from 'next-intl/server';

import { Carousel } from '@/components/cells';
import { BrandCard } from '@/components/organisms';
import type { Brand } from '@/types/brands';

/**
 * v1.7.0 Story 2.2 re-review fix (MEDIUM M4'): placeholder array is intentionally
 * kept only for local dev preview; production renders nothing here (the
 * caller is expected to wire CMS-provided salon data before re-enabling this
 * section in prod). The logo files still reference the original fashion-brand
 * SVGs because we have not yet checked-in neutral monogram placeholders.
 */
const placeholderBrands: Brand[] = [
  { id: 1, name: 'Salon Lumière',  logo: '/images/brands/Balenciaga.svg', href: '#' },
  { id: 2, name: 'Beauty Atelier', logo: '/images/brands/Nike.svg',       href: '#' },
  { id: 3, name: 'Studio Aurum',   logo: '/images/brands/Prada.svg',      href: '#' },
  { id: 4, name: 'Maison Beauté',  logo: '/images/brands/Miu-Miu.svg',    href: '#' },
];

export async function HomePopularBrandsSection() {
  // v1.7.0 Story 2.2 re-review fix (MEDIUM M4'): hide the brand-incoherent
  // placeholder in production. Dev preview still renders the placeholder
  // array so the section layout can be inspected locally.
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const t = await getTranslations('discovery');
  return (
    <section className="w-full bg-action px-4 py-8 md:px-6 lg:px-8" data-testid="popular-brands-section">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="heading-lg text-tertiary">{t('popular_salons')}</h2>
      </div>
      <Carousel
        variant="dark"
        items={placeholderBrands.map(brand => (
          <BrandCard
            key={brand.id}
            brand={brand}
          />
        ))}
      />
    </section>
  );
}
