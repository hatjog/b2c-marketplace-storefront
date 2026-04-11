import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ArrowRightIcon } from '@/icons';

import { NavbarSearch } from '@/components/molecules/NavbarSearch/NavbarSearch';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';

import tailwindConfig from '../../../../tailwind.config';

type HeroProps = {
  image: string;
  heading: string;
  paragraph: string;
  buttons: { label: string; path: string }[];
  maxHeight?: string | null;
  showSearch?: boolean;
};

export const Hero = ({ image, heading, paragraph, buttons, maxHeight = null, showSearch = false }: HeroProps) => {
  const sectionStyle = maxHeight ? ({ maxHeight } as CSSProperties) : undefined;
  const contentStyle = maxHeight
    ? ({
        ['--hero-min-height-mobile' as const]: `min(${maxHeight}, 560px)`,
        ['--hero-min-height-desktop' as const]: `min(${maxHeight}, 620px)`,
      } as CSSProperties)
    : undefined;

  return (
    <section
      className="relative w-full overflow-hidden rounded-[36px] border border-white/12 shadow-[0_30px_80px_rgba(37,28,12,0.18)]"
      data-testid="homepage-hero"
      style={sectionStyle}
    >
      <div className="absolute inset-0">
        <Image
          src={safeDecodeURIComponent(image)}
          width={1600}
          height={960}
          alt={`Hero banner - ${heading}`}
          className="h-full w-full object-cover"
          priority
          fetchPriority="high"
          quality={60}
          sizes="100vw"
        />
        <div className="absolute inset-0" style={{ background: 'var(--bb-hero-overlay)' }} />
      </div>
      <div
        className="relative z-10 flex min-h-[var(--hero-min-height-mobile,560px)] flex-col justify-center gap-8 p-6 md:min-h-[var(--hero-min-height-desktop,620px)] md:p-10 lg:max-w-[760px] lg:p-14"
        style={contentStyle}
      >
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-white/88 backdrop-blur">
            BonBeauty
          </span>
          <h2 className="display-sm max-w-[12ch] text-white md:text-[64px] md:leading-[72px]">
            {heading}
          </h2>
          <p className="max-w-[58ch] text-base leading-7 text-white/88 md:text-lg md:leading-8">
            {paragraph}
          </p>
        </div>
        {showSearch && (
          <div className="max-w-[620px] rounded-[24px] border border-white/18 bg-white/92 p-3 shadow-[0_24px_70px_rgba(12,12,12,0.16)] backdrop-blur md:p-4">
            <NavbarSearch className="w-full" />
          </div>
        )}
        {buttons.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {buttons.map(({ label, path }) => (
              <Link
                key={path}
                href={path}
                className="inline-flex min-h-[48px] items-center justify-between gap-3 rounded-full border border-white/18 px-5 py-3 text-sm font-medium uppercase tracking-[0.24em] text-white transition-colors duration-300 hover:bg-white hover:text-primary"
                aria-label={label}
                title={label}
              >
                <span>{label}</span>
                <ArrowRightIcon
                  color={tailwindConfig.theme.extend.backgroundColor.primary}
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
