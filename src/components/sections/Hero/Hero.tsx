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
  showSearch?: boolean;
};

export const Hero = ({ image, heading, paragraph, buttons, showSearch = false }: HeroProps) => {
  return (
    <section className="container mt-5 flex w-full flex-col text-primary lg:flex-row">
      <Image
        src={safeDecodeURIComponent(image)}
        width={700}
        height={600}
        alt={`Hero banner - ${heading}`}
        className="order-2 w-full lg:order-1"
        priority
        fetchPriority="high"
        quality={50}
        sizes="(min-width: 1024px) 50vw, 100vw"
      />
      <div className="w-full lg:order-2">
        <div className="flex h-[calc(100%-144px)] w-full items-end rounded-sm border px-6">
          <div>
            <h2 className="display-md mb-6 max-w-[652px] text-4xl font-bold uppercase leading-tight md:text-5xl">
              {heading}
            </h2>
            <p className="mb-8 text-lg">{paragraph}</p>
            {showSearch && (
              <NavbarSearch className="mt-6 w-full max-w-[600px] mx-auto px-4 md:px-0" />
            )}
          </div>
        </div>
        {buttons.length > 0 && (
          <div className="flex h-[72px] font-bold uppercase lg:h-[144px]">
            {buttons.map(({ label, path }) => (
              <Link
                key={path}
                href={path}
                className="bg-content group flex h-full w-1/2 items-end justify-between rounded-sm border p-6 transition-all duration-300 hover:bg-action hover:text-tertiary"
                aria-label={label}
                title={label}
              >
                <span>
                  <span className="hidden group-hover:inline-flex">#</span>
                  {label}
                </span>

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
