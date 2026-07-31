import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ArrowRightIcon } from '@/icons';

import { MarketplaceVerificationMark } from '@/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark';
import { HomeSearchWidget } from '@/components/molecules/HomeSearchWidget/HomeSearchWidget';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
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
  /** Accessible alt text for the hero background image. REQUIRED.
   *  v1.7.0 Story 2.2 re-review fix (HIGH H1'): previously hardcoded EN
   *  `Hero banner - ${heading}` — bled into PL/UA/DE pages. Now caller must
   *  pass a locale-resolved value (e.g. interpolated from `category.hero_image_alt`). */
  imageAlt: string;
  secondaryVoucherCtaLabel: string;
};

export const Hero = ({
  image,
  heading,
  paragraph,
  buttons,
  maxHeight = null,
  showSearch = false,
  trustMarkLabel,
  imageAlt,
  secondaryVoucherCtaLabel,
}: HeroProps) => {
  if (!image) {
    // v1.7.0 Story 2.2 re-review fix (LOW L5'): defensive early-return when
    // no image is supplied — HeroBlock guarantees a fallback path, but Hero
    // should not call <Image src=""> if the consumer ever passes empty.
    return null;
  }
  // v1.12.0 (5.9 close-out, Robert eye check): only honour a config max_height that is
  // tall enough to frame the hero content. The shipped config passed 540px, which (a)
  // clipped the ~687px content so the search card was jammed against the bottom edge and
  // (b) squeezed the portrait hero image into a wide-short eye-band crop. Below that
  // threshold we drop the hard cap and let the hero grow to fit its content.
  const capPx = maxHeight && /^\d+px$/.test(maxHeight) ? Number.parseInt(maxHeight, 10) : null;
  const honourCap = capPx !== null && capPx >= 640;
  const sectionStyle = honourCap ? ({ maxHeight } as CSSProperties) : undefined;
  const contentStyle = {
    ['--hero-min-height-mobile' as const]: honourCap ? `min(${maxHeight}, 600px)` : '600px',
    ['--hero-min-height-desktop' as const]: honourCap ? `min(${maxHeight}, 700px)` : '700px',
  } as CSSProperties;

  return (
    <section
      className="relative w-full overflow-hidden rounded-[var(--bb-radius-hero)] border border-white/12 bg-[var(--bb-hero-bg)] shadow-[var(--bb-shadow-hero)]"
      data-testid="homepage-hero"
      style={sectionStyle}
    >
      <div className="absolute inset-0">
        {/* v1.12.0 (5.9 close-out, Robert eye check): the configured hero art is a PORTRAIT
            (≈810×1215). Full-bleed object-cover cropped it into a tight eye-band close-up
            sitting behind the copy. Instead show the WHOLE portrait anchored to the RIGHT
            (md+: height-fit → its own aspect, no crop) and fade the LEFT into a warm
            image-tone shadow the copy sits on. On mobile the hero is narrow, so the portrait
            fills it (object-cover, upper-face anchored). */}
        {/* Feather the portrait's LEFT edge with a mask gradient so it dissolves into the
            warm section background instead of showing a hard image seam (Robert eye check):
            transparent at the very edge → fully opaque by ~34% (past the face's left side),
            so the whole face stays crisp while the edge melts into the shadow. */}
        <Image
          src={safeDecodeURIComponent(image)}
          width={810}
          height={1215}
          alt={imageAlt}
          className="h-full w-full object-cover object-top md:absolute md:inset-y-0 md:right-0 md:w-auto md:max-w-[62%] md:object-center"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 14%, #000 34%)',
            maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 14%, #000 34%)',
          }}
          priority
          fetchPriority="high"
          quality={70}
          sizes="(max-width: 768px) 100vw, 62vw"
        />
        {/* Gentle, long-fade text shadow over the warm background (no hard band — the photo
            edge is already feathered by the image mask) + a soft gold top-left glow + a
            bottom legibility scrim for the search card. No generated token is edited. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 8% 0%, rgba(197,160,89,0.13) 0%, rgba(197,160,89,0) 55%), ' +
              'linear-gradient(90deg, rgba(20,15,10,0.55) 0%, rgba(20,15,10,0.30) 30%, rgba(20,15,10,0.08) 55%, rgba(20,15,10,0) 72%), ' +
              'linear-gradient(180deg, rgba(20,15,10,0) 50%, rgba(20,15,10,0.38) 100%)',
          }}
        />
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
          <h1 className="display-sm max-w-[12ch] text-white md:text-[64px] md:leading-[72px]">
            {heading}
          </h1>
          <p
            className="max-w-[58ch] text-base leading-7 text-white md:text-lg md:leading-8"
            style={{ textShadow: 'var(--bb-shadow-hero-text)' }}
          >
            {paragraph}
          </p>
        </div>
        {showSearch && (
          <div className="max-w-[680px] space-y-3">
            <HomeSearchWidget />
            <LocalizedClientLink
              href="/categories?mode=gift"
              className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-white/25 bg-white/14 px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_16px_36px_rgba(0,0,0,0.16)] backdrop-blur-md transition-colors hover:bg-white hover:text-primary"
            >
              {secondaryVoucherCtaLabel}
            </LocalizedClientLink>
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
                {/* v1.7.0 Story 2.2 re-review fix (INFO I2'): use className-based
                    token utility instead of inline rgba(var(--…)) string. The
                    ArrowRightIcon paints via the `color` prop, so we pass
                    `currentColor` and let the parent className (`text-primary`)
                    drive it through the standard CSS inheritance path. */}
                <ArrowRightIcon
                  color="currentColor"
                  className="text-primary"
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
