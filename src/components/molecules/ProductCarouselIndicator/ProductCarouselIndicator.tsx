'use client';

import { useCallback, useEffect, useState } from 'react';

import type { HttpTypes } from '@medusajs/types';
import type { EmblaCarouselType } from 'embla-carousel';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

import { Indicator } from '@/components/atoms';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';
import { cn } from '@/lib/utils';

export const ProductCarouselIndicator = ({
  slides = [],
  embla: parentEmbla,
  productTitle
}: {
  slides: HttpTypes.StoreProduct['images'];
  embla?: EmblaCarouselType;
  productTitle?: string | null;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const t = useTranslations('products');

  const changeSlideHandler = useCallback(
    (index: number) => {
      if (!parentEmbla) return;
      parentEmbla.scrollTo(index);
    },
    [parentEmbla]
  );

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!parentEmbla) return;

    onSelect(parentEmbla);
    parentEmbla.on('reInit', onSelect).on('select', onSelect);
  }, [parentEmbla, onSelect]);

  return (
    <div className="embla__dots pointer-events-none absolute bottom-3 left-3 w-[calc(100%-24px)]">
      <div className="pointer-events-auto lg:hidden">
        <Indicator
          step={selectedIndex + 1}
          size="large"
          maxStep={slides?.length || 0}
        />
      </div>

      <div className="pointer-events-auto relative hidden lg:block">
        <div
          className="grid grid-cols-5 gap-2"
          data-testid="product-carousel-thumbs-5-col"
        >
          {(slides || []).map((slide, index) => (
            <div
              key={slide.id}
              className="hidden aspect-square cursor-pointer rounded-sm bg-primary lg:block"
              onClick={() => changeSlideHandler(index)}
            >
              <Image
                src={safeDecodeURIComponent(slide.url)}
                alt={t('image_alt', { name: productTitle ?? t('fallback_name') })}
                width={64}
                height={64}
                className={cn(
                  'transition-color hidden h-16 w-16 rounded-sm border-2 object-cover duration-300 lg:block',
                  selectedIndex === index ? 'border-primary' : 'border-tertiary'
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
