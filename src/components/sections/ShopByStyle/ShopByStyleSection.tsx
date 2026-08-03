import React from 'react';
import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ArrowRightIcon } from '@/icons';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';

type StyleSectionItemProps = {
  imageUrl: string | null;
  href: string;
  label: string;
};

type ShopByStyleSectionProps = {
  heading: string;
  items: StyleSectionItemProps[];
};

export function ShopByStyleSection({ heading, items }: ShopByStyleSectionProps) {
  return (
    <section className="bb-section-shell bb-section-shell-dark w-full overflow-hidden">
      <div className="mb-8">
        <h2 className="heading-lg text-white">{heading}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <div
            key={`${item.href}-${item.label}`}
            className="h-full overflow-hidden rounded-[var(--bb-radius-panel)] border border-white/12 bg-white/6"
          >
            <LocalizedClientLink
              href={item.href}
              className="group flex h-full flex-col gap-4 p-4 text-white transition-colors md:p-5"
            >
              {item.imageUrl && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--bb-radius-panel)] bg-white/8">
                  {/* Decorative: the adjacent label <span> names the tile, so a label-
                      repeating alt triggers axe image-redundant-alt. Empty alt = decorative. */}
                  <Image
                    loading="lazy"
                    src={safeDecodeURIComponent(item.imageUrl)}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                </div>
              )}
              <div className="mt-auto flex items-center justify-between gap-4 rounded-[var(--bb-radius-panel)] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <span className="heading-md text-white">{item.label}</span>
                <ArrowRightIcon className="translate-x-0 opacity-80 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </LocalizedClientLink>
          </div>
        ))}
      </div>
    </section>
  );
}
