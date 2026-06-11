import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { cn } from '@/lib/utils';

const MONOGRAM_SRC = {
  dark: '/bonbeauty/logo/bonbeauty-logo-monogram-dark.svg',
  light: '/bonbeauty/logo/bonbeauty-logo-monogram-light.svg',
} as const;

export type LogoLockupVariant = keyof typeof MONOGRAM_SRC;

export type LogoLockupProps = {
  className?: string;
  imageClassName?: string;
  wordmarkClassName?: string;
  variant?: LogoLockupVariant;
  logoSrc?: string | null;
  locale?: string;
  'data-testid'?: string;
};

export function LogoLockup({
  className,
  imageClassName,
  wordmarkClassName,
  variant = 'dark',
  logoSrc,
  locale,
  'data-testid': dataTestId = 'logo-lockup',
}: LogoLockupProps) {
  const resolvedLogoSrc = logoSrc || MONOGRAM_SRC[variant];

  return (
    <LocalizedClientLink
      href="/"
      locale={locale}
      className={cn('inline-flex shrink-0 items-center gap-2', className)}
      data-testid={dataTestId}
      aria-label="BonBeauty"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedLogoSrc}
        alt=""
        aria-hidden="true"
        className={cn('h-8 w-auto shrink-0', imageClassName)}
        width={32}
        height={32}
      />
      <span
        className={cn(
          'text-xl font-semibold leading-none text-[var(--text-primary)]',
          wordmarkClassName
        )}
        style={{ fontFamily: 'var(--font-wordmark)' }}
      >
        BonBeauty
      </span>
    </LocalizedClientLink>
  );
}

export { MONOGRAM_SRC };
