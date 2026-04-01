import React from 'react';
import Image from 'next/image';

import { Button } from '@/components/atoms/Button/Button';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

function safeDecodeURI(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

type BannerSectionProps = {
  heading: string;
  subheading: string;
  imageUrl: string | null;
  label: string;
  ctaLink: string;
};

export const BannerSection = ({
  heading,
  subheading,
  imageUrl,
  label,
  ctaLink,
}: BannerSectionProps) => {
  return (
    <section className="container bg-tertiary text-tertiary">
      <div className={`grid grid-cols-1 items-center ${imageUrl ? 'lg:grid-cols-2' : ''}`}>
        <div className="flex h-full flex-col justify-between rounded-sm border border-secondary px-6 py-6">
          <div className="mb-8 lg:mb-48">
            <h2 className="display-sm">{heading}</h2>
            {subheading && (
              <p className="max-w-lg text-lg text-tertiary">
                {subheading}
              </p>
            )}
          </div>
          <LocalizedClientLink href={ctaLink}>
            <Button
              size="large"
              className="w-fit bg-secondary/10"
            >
              {label}
            </Button>
          </LocalizedClientLink>
        </div>
        {imageUrl && (
          <div className="relative flex aspect-[4/3] justify-end rounded-sm lg:aspect-auto lg:h-full">
            <Image
              loading="lazy"
              src={safeDecodeURI(imageUrl)}
              alt={heading || label}
              width={700}
              height={600}
              className="rounded-sm object-cover object-top"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        )}
      </div>
    </section>
  );
};
