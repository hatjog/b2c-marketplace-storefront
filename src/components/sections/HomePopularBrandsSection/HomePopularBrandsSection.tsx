/**
 * HomePopularBrandsSection — v1.7.0 Story 2.2 update.
 *
 * Changes:
 *   - Hardcoded "POPULAR BRANDS" replaced with i18n key (discovery.popular_salons).
 *     Brands/salons section is now locale-aware.
 *   - Brand data remains static placeholder (actual data from gp-config / market config
 *     is out of scope for this story — this section renders CMS-provided data in prod).
 *
 * v1.7.0 Story 2.2 review fix (INFO I2): replaced fashion brand placeholders
 * (Balenciaga / Nike / Prada / Miu Miu) with beauty-aligned salon names so dev
 * preview and any incidental screenshot evidence stay coherent with the
 * BonBeauty register declared in the heading. Logos still reference the
 * existing image filenames so the build does not break — production replaces
 * the entire array via CMS data.
 */
import { getTranslations } from 'next-intl/server';

import { Carousel } from '@/components/cells';
import { BrandCard } from '@/components/organisms';
import type { Brand } from '@/types/brands';

const brands: Brand[] = [
  {
    id: 1,
    name: 'Salon Lumière',
    logo: '/images/brands/Balenciaga.svg',
    href: '#'
  },
  {
    id: 2,
    name: 'Beauty Atelier',
    logo: '/images/brands/Nike.svg',
    href: '#'
  },
  {
    id: 3,
    name: 'Studio Aurum',
    logo: '/images/brands/Prada.svg',
    href: '#'
  },
  {
    id: 4,
    name: 'Maison Beauté',
    logo: '/images/brands/Miu-Miu.svg',
    href: '#'
  }
];

export async function HomePopularBrandsSection() {
  const t = await getTranslations('discovery');
  return (
    <section className="w-full bg-action px-4 py-8 md:px-6 lg:px-8" data-testid="popular-brands-section">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="heading-lg text-tertiary">{t('popular_salons')}</h2>
      </div>
      <Carousel
        variant="dark"
        items={brands.map(brand => (
          <BrandCard
            key={brand.id}
            brand={brand}
          />
        ))}
      />
    </section>
  );
}
