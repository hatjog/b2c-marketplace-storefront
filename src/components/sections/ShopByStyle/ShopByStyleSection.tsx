import React from 'react';
import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ArrowRightIcon } from '@/icons';

function safeDecodeURI(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

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
    <section className="container bg-primary">
      <h2 className="heading-lg mb-12 text-primary">{heading}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <div
            key={`${item.href}-${item.label}`}
            className="h-full rounded-sm border"
          >
            <LocalizedClientLink
              href={item.href}
              className="group flex h-full flex-col gap-4 p-6 text-primary transition-colors hover:text-action"
            >
              {item.imageUrl && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-action-secondary">
                  <Image
                    loading="lazy"
                    src={safeDecodeURI(item.imageUrl)}
                    alt={item.label}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                  />
                </div>
              )}
              <div className="mt-auto flex items-center justify-between gap-4 border-b border-transparent pb-2 group-hover:border-primary">
                <span className="heading-lg">{item.label}</span>
                <ArrowRightIcon className="-translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
            </LocalizedClientLink>
          </div>
        ))}
      </div>
    </section>
  );
}
