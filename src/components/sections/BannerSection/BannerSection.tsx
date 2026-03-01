import Image from 'next/image';

import { Button } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export const BannerSection = () => {
  return (
    <section className="container bg-tertiary text-tertiary">
      <div className="grid grid-cols-1 items-center lg:grid-cols-2">
        <div className="flex h-full flex-col justify-between rounded-sm border border-secondary px-6 py-6">
          <div className="mb-8 lg:mb-48">
            <span className="inline-block rounded-sm border border-secondary px-4 py-1 text-sm">
              #COLLECTION
            </span>
            <h2 className="display-sm">BOHO VIBES: WHERE COMFORT MEETS CREATIVITY</h2>
            <p className="max-w-lg text-lg text-tertiary">
              Discover boho styles that inspire adventure and embrace the beauty of the
              unconventional.
            </p>
          </div>
          <LocalizedClientLink href="/collections/boho">
            <Button
              size="large"
              className="w-fit bg-secondary/10"
            >
              EXPLORE
            </Button>
          </LocalizedClientLink>
        </div>
        <div className="relative flex aspect-[4/3] justify-end rounded-sm lg:aspect-auto lg:h-full">
          <Image
            loading="lazy"
            fetchPriority="high"
            src="/images/banner-section/Image.jpg"
            alt="Boho fashion collection - Model wearing a floral dress with yellow boots"
            width={700}
            height={600}
            className="rounded-sm object-cover object-top"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </div>
      </div>
    </section>
  );
};
