'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { SUPPORTED_LOCALES, isSupportedLocale } from '@/i18n/routing';

type LanguageSwitcherProps = {
  currentLocale: string;
};

const LANG_LABELS: Record<string, string> = {
  pl: 'PL',
  en: 'EN'
};

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('header');

  const switchToLocale = (newLocale: string) => {
    if (newLocale === currentLocale) return;

    // Replace current locale segment in path with new locale
    const segments = pathname.split('/');
    if (segments[1] && isSupportedLocale(segments[1])) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    const newPath = segments.join('/') || `/${newLocale}`;
    router.push(newPath);
    router.refresh();
  };

  return (
    <div
      className="flex items-center gap-1"
      data-testid="language-switcher"
      aria-label={t('language_switcher_label')}
    >
      {SUPPORTED_LOCALES.map(lang => (
        <button
          key={lang}
          onClick={() => switchToLocale(lang)}
          aria-pressed={lang === currentLocale}
          data-testid={`lang-btn-${lang}`}
          className={`text-sm font-medium px-1 py-0.5 rounded transition-colors ${
            lang === currentLocale
              ? 'text-primary font-bold underline'
              : 'text-secondary hover:text-primary'
          }`}
        >
          {LANG_LABELS[lang] ?? lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
