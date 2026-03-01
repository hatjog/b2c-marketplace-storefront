import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ArrowRightIcon } from '@/icons';
import type { Style } from '@/types/styles';

export const styles: Style[] = [
  {
    id: 1,
    name: 'LUXURY',
    href: '/collections/luxury'
  },
  {
    id: 2,
    name: 'VINTAGE',
    href: '/collections/vintage'
  },
  {
    id: 3,
    name: 'CASUAL',
    href: '/collections/casual'
  },
  {
    id: 4,
    name: 'STREETWEAR',
    href: '/collections/streetwear'
  },
  {
    id: 5,
    name: 'Y2K',
    href: '/collections/y2k'
  }
];

export function ShopByStyleSection() {
  return (
    <section className="container bg-primary">
      <h2 className="heading-lg mb-12 text-primary">SHOP BY STYLE</h2>
      <div className="grid grid-cols-1 items-center lg:grid-cols-2">
        <div className="h-full rounded-sm border px-[58px] py-[52px]">
          {styles.map(style => (
            <LocalizedClientLink
              key={style.id}
              href={style.href}
              className="group mb-8 flex w-fit items-center gap-4 border-b border-transparent pb-2 text-primary transition-colors hover:border-primary hover:text-action"
            >
              <span className="heading-lg">{style.name}</span>
              <ArrowRightIcon className="-translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </LocalizedClientLink>
          ))}
        </div>
        <div className="relative hidden lg:block">
          <Image
            loading="lazy"
            fetchPriority="high"
            src="/images/shop-by-styles/Image.jpg"
            alt="Models showcasing luxury fashion styles"
            width={700}
            height={600}
            className="h-auto w-full rounded-sm object-cover"
          />
        </div>
      </div>
    </section>
  );
}
