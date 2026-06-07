'use client';

// @chrome-manifest: W6-10
// LocaleSwitcher — Wave 6 chrome W6-10.
// Closed-pill (28px flag + native name) + open-dropdown; 4 locales PL/EN/UA/DE.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/locale-switcher.yaml
// CSS custom properties: --bb-surface, --bb-shadow-soft, --bb-border-soft, --bb-border-hairline,
//   --text-primary, --text-secondary, --color-selected-bg (via Tailwind bg-action/10),
//   --bb-radius-pill, --bb-radius-card, --font-body, --font-weight-medium,
//   --space-2, --space-4, --anim-duration-fast, --anim-ease-standard

import { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isSupportedLocale, type SupportedLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface LocaleOption {
  code: SupportedLocale;
  nativeName: string;
  flag: string;
  countryCode: string;
}

const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'pl', nativeName: 'Polski', flag: '🇵🇱', countryCode: 'PL' },
  { code: 'en', nativeName: 'English', flag: '🇬🇧', countryCode: 'GB' },
  { code: 'ua', nativeName: 'Українська', flag: '🇺🇦', countryCode: 'UA' },
  { code: 'de', nativeName: 'Deutsch', flag: '🇩🇪', countryCode: 'DE' },
];

interface LocaleSwitcherProps {
  currentLocale: string;
  className?: string;
}

export function LocaleSwitcher({ currentLocale, className }: LocaleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LOCALE_OPTIONS.find((o) => o.code === currentLocale) ?? LOCALE_OPTIONS[0];

  function switchLocale(option: LocaleOption) {
    if (!isSupportedLocale(option.code) || option.code === currentLocale) {
      setOpen(false);
      return;
    }
    const segments = pathname.split('/');
    if (segments[1] && isSupportedLocale(segments[1])) {
      segments[1] = option.code;
    } else {
      segments.splice(1, 0, option.code);
    }
    const newPath = segments.join('/') || `/${option.code}`;
    router.push(newPath);
    router.refresh();
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn('relative', className)} data-testid="locale-switcher">
      {/* W6-10 variant: closed-pill */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Język: ${current.nativeName}`}
        style={{ height: 'var(--locale-pill-height, 28px)' }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[var(--bb-radius-pill)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-3 text-xs font-medium text-[var(--text-primary)]',
          'transition-colors duration-[var(--anim-duration-fast,150ms)]',
          'hover:border-[var(--bb-border-strong)] hover:bg-[var(--bb-surface-strong)]'
        )}
      >
        {/* Local SVG flag (bundled in public/flags) — NOT emoji: flag emoji has
            no glyphs on Windows and falls back to the country letters, which made
            the pill read "PL PL". No external flag CDN (GDPR/supply-chain). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/flags/${current.countryCode.toLowerCase()}.svg`}
          alt=""
          aria-hidden="true"
          width={18}
          height={13}
          className="h-3.5 w-[18px] rounded-[2px] object-cover ring-1 ring-black/10"
        />
        <span>{current.countryCode}</span>
      </button>

      {/* W6-10 variant: open-dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Wybierz język"
          style={{ width: 'var(--locale-dropdown-width, 160px)' }}
          className={cn(
            'absolute right-0 top-full mt-1 z-[var(--site-header-z,100)]',
            'rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)]',
            'shadow-[var(--bb-shadow-soft)] py-1'
          )}
        >
          {LOCALE_OPTIONS.map((option) => {
            const selected = option.code === currentLocale;
            return (
              <button
                key={option.code}
                role="option"
                aria-selected={selected}
                type="button"
                onClick={() => switchLocale(option)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-sm',
                  'transition-colors duration-[var(--anim-duration-fast,150ms)]',
                  selected
                    ? 'bg-[var(--bb-tint-gold-08)] font-medium text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bb-surface-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/flags/${option.countryCode.toLowerCase()}.svg`}
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={14}
                  className="h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-black/10"
                />
                <span>{option.nativeName}</span>
                {selected && <span className="ml-auto text-[var(--cta)]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
