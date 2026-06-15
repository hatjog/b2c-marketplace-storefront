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
  const messages = await getMessages();

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
