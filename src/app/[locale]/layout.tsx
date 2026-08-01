import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // v1.12.0 UA-loc: establish the request locale in next-intl's server store so
  // getLocale() resolves the route locale in ALL nested server contexts — including
  // the SDK locale interceptor's async data fetches. Without this, getLocale() fell
  // back to the default locale inside fetch continuations, so the x-medusa-locale
  // header was sent as pl-PL and the backend returned untranslated (PL) catalog data.
  setRequestLocale(locale);
  // QD-03 (CAP-3) — ZMIERZONE ŻYWYM RENDEREM, nie wywnioskowane: mimo
  // `setRequestLocale(locale)` linijkę wyżej, `getMessages()` bez argumentu
  // zwracało na prod buildzie słownik PL na trasach /ua, /de i /en. Cały
  // chrome KLIENCKI (`useTranslations`) leciał więc po polsku — to jest
  // faktyczne źródło „Adres" / „Godziny otwarcia" / „O nas" z audytu
  // kompletności i18n v1.14.0, a nie tylko trust bar renderowany serwerowo.
  // `setRequestLocale` NIE wystarcza jako gwarancja na tej granicy.
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
    >
      <HtmlLangSetter />
      {children}
    </NextIntlClientProvider>
  );
}
