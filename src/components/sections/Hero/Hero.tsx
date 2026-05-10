import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ArrowRightIcon } from '@/icons';

import { MarketplaceVerificationMark } from '@/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark';
import { NavbarSearch } from '@/components/molecules/NavbarSearch/NavbarSearch';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';

/**
 * Hero — BonBeauty home hero section.
 *
 * v1.7.0 Story 2.2:
 *   - MarketplaceVerificationMark (UX-CMP-1) added with text label (not icon-only)
 *   - trustMarkLabel prop: required for a11y (screen-reader-readable trust cue)
 *   - Hardcoded "BonBeauty" badge replaced with MarketplaceVerificationMark
 *   - showSearch already present; buttons use token-bound styling (unchanged from 2.1)
 */
type HeroProps = {
  image: string;
  heading: string;
  paragraph: string;
  buttons: { label: string; path: string }[];
  maxHeight?: string | null;
  showSearch?: boolean;
  /** Accessible trust label for MarketplaceVerificationMark (UX-CMP-1).
   *  REQUIRED — must be a locale-resolved string from the caller
   *  (typically `getTranslations('category')('trust_mark_label')`).
   *  v1.7.0 Story 2.2 review fix (MEDIUM M1): no PL default, otherwise EN/UA/DE
   *  pages would render PL when a future caller forgets to pass this prop. */
  trustMarkLabel: string;
};

export const Hero = ({
  image,
  heading,
  paragraph,
  buttons,
  maxHeight = null,
  showSearch = false,
  trustMarkLabel,
}: HeroProps) => {
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
          {/* MarketplaceVerificationMark (UX-CMP-1): single instance.
              v1.7.0 Story 2.2 review fix (LOW L5): consolidated from two responsive
              copies (hidden+inline-flex pair) to one element with a responsive size
              utility. Idiomatic Tailwind, half the DOM, immune to a future
              visibility:hidden / display:contents refactor double-announcing.
              Always renders a text label so the trust cue is screen-reader-accessible. */}
          <MarketplaceVerificationMark
            label={trustMarkLabel}
            variant="default"
            className="text-[10px] sm:text-[11px]"
          />
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
                  color="rgba(var(--bg-primary))"
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
