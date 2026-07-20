'use client';

import { Fragment } from 'react';

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition
} from '@headlessui/react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ReactCountryFlag from 'react-country-flag';

import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from '@/i18n/routing';

type LanguageOption = {
  code: string;
  label: string;
  flagCode: string;
};

// Metadata-per-locale (flag/label), not an authoritative locale list — see the
// same note on LOCALE_OPTIONS in LocaleSwitcher.tsx. Market-aware filtering
// via the `supportedLocales` prop (Story 1.1 v1.14.0, F3).
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'pl', label: 'Polski', flagCode: 'PL' },
  { code: 'en', label: 'English', flagCode: 'GB' }
];

const LANGUAGE_SWITCHER_BUTTON_ID = 'language-switcher-button';
const LANGUAGE_SWITCHER_OPTIONS_ID = 'language-switcher-options';

type LanguageSwitcherProps = {
  currentLocale: string;
  /** Market-aware locale set; defaults to the full platform superset. */
  supportedLocales?: readonly SupportedLocale[];
};

export function LanguageSwitcher({
  currentLocale,
  supportedLocales = SUPPORTED_LOCALES
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('header');

  const languageOptions = LANGUAGE_OPTIONS.filter(option =>
    (supportedLocales as readonly string[]).includes(option.code)
  );

  const currentOption =
    languageOptions.find(o => o.code === currentLocale) ?? languageOptions[0] ?? LANGUAGE_OPTIONS[0];

  const switchToLocale = (option: LanguageOption) => {
    if (!isSupportedLocale(option.code)) return;
    if (option.code === currentLocale) return;

    const segments = pathname.split('/');
    if (segments[1] && isSupportedLocale(segments[1])) {
      segments[1] = option.code;
    } else {
      segments.splice(1, 0, option.code);
    }
    const newPath = segments.join('/') || `/${option.code}`;
    router.push(newPath);
    router.refresh();
  };

  return (
    <div
      className="relative"
      data-testid="language-switcher"
    >
      <Listbox
        value={currentOption}
        onChange={switchToLocale}
      >
        <ListboxButton
          id={LANGUAGE_SWITCHER_BUTTON_ID}
          className="text-base-regular relative flex h-10 w-16 cursor-default items-center justify-between rounded-lg border bg-component-secondary text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300"
          aria-label={t('language_switcher_label')}
        >
          <span className="txt-compact-small mx-auto flex items-center gap-x-2">
            {/* @ts-ignore */}
            <ReactCountryFlag
              alt={`${currentOption.flagCode} flag`}
              svg
              style={{ width: '16px', height: '16px' }}
              countryCode={currentOption.flagCode}
            />
            {currentOption.code.toUpperCase()}
          </span>
        </ListboxButton>

        <div className="relative flex w-16">
          <Transition
            as={Fragment}
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <ListboxOptions
              id={LANGUAGE_SWITCHER_OPTIONS_ID}
              className="no-scrollbar text-small-regular border-top-0 absolute z-20 max-h-60 overflow-auto rounded-lg border bg-white focus:outline-none sm:text-sm"
            >
              {languageOptions.map(option => (
                <ListboxOption
                  id={`language-switcher-option-${option.code}`}
                  key={option.code}
                  value={option}
                  className="relative w-16 cursor-pointer select-none border-b py-2 hover:bg-gray-50"
                  data-testid={`lang-option-${option.code}`}
                >
                  <span className="flex items-center gap-x-2 pl-2">
                    {/* @ts-ignore */}
                    <ReactCountryFlag
                      svg
                      style={{ width: '16px', height: '16px' }}
                      countryCode={option.flagCode}
                    />
                    {option.label}
                  </span>
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}
