/**
 * Shared vitest harness for components that read translations.
 *
 * DW-15-326: the v1.7.0-era unit tests call function components directly
 * (`Button({...})`) and inspect the returned JSX. The i18n sweep d16b69c4a
 * (2026-06-15) added `useTranslations` to those components, and a hook called
 * outside a React render has no dispatcher and no `NextIntlClientProvider`
 * context, so every such call throws.
 *
 * `withinIntlRender` runs a callback DURING a real `react-dom/server` render,
 * inside a `NextIntlClientProvider` fed with the real `messages/pl.json`. Hooks
 * called by the callback therefore resolve against a live dispatcher and the
 * real catalogue, while the callback still returns the raw JSX tree, so the
 * existing prop-level assertions keep their exact meaning.
 *
 * A missing message key throws instead of silently rendering the key path:
 * a component asking for a key that the catalogue lacks is a defect the test
 * must surface, not mask.
 */
import * as React from 'react';
import { createTranslator, NextIntlClientProvider, type IntlError } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import plMessages from '../../messages/pl.json';

export const TEST_LOCALE = 'pl';
export const TEST_TIME_ZONE = 'Europe/Warsaw';
export const testMessages = plMessages;

function failOnIntlError(error: IntlError): void {
  throw error;
}

/**
 * Run `fn` while React is rendering inside `NextIntlClientProvider` (locale pl,
 * real catalogue) and return what `fn` returned. Errors thrown by `fn` are
 * re-thrown to the caller unchanged.
 */
export function withinIntlRender<T>(fn: () => T): T {
  let captured: { value: T } | null = null;
  let failure: { error: unknown } | null = null;

  function Probe(): null {
    try {
      captured = { value: fn() };
    } catch (error) {
      failure = { error };
    }
    return null;
  }

  renderToStaticMarkup(
    <IntlTestProvider>
      <Probe />
    </IntlTestProvider>,
  );

  if (failure) throw (failure as { error: unknown }).error;
  if (!captured) throw new Error('withinIntlRender: probe did not render');
  return (captured as { value: T }).value;
}

/** Call `Component(props)` inside an intl-aware render and return its JSX tree. */
export function shallowRenderWithIntl<P, R>(Component: (props: P) => R, props: P): R {
  return withinIntlRender(() => Component(props));
}

/**
 * Wrap a component so that tests can keep calling it as a plain function
 * (`Wrapped(props)`) while its hooks run inside an intl-aware render.
 */
export function withIntlShallow<P, R>(Component: (props: P) => R): (props: P) => R {
  return (props: P) => shallowRenderWithIntl(Component, props);
}

/** Provider used by DOM renders (`createRoot`) and static markup in tests. */
export function IntlTestProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={TEST_LOCALE}
      messages={testMessages}
      timeZone={TEST_TIME_ZONE}
      onError={failOnIntlError}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/** Static markup of `node` rendered inside the same provider (locale pl). */
export function renderToStaticMarkupWithIntl(node: React.ReactNode): string {
  return renderToStaticMarkup(<IntlTestProvider>{node}</IntlTestProvider>);
}

/**
 * Stand-in for `next-intl/server` `getTranslations` backed by the real pl
 * catalogue. Accepts the same argument shapes (`namespace` string or
 * `{ locale, namespace }`) and throws on a missing key.
 */
export async function getTestTranslations(
  arg?: string | { locale?: string; namespace?: string },
) {
  const namespace = typeof arg === 'string' ? arg : arg?.namespace;
  const locale = typeof arg === 'object' && arg?.locale ? arg.locale : TEST_LOCALE;
  if (locale !== TEST_LOCALE) {
    throw new Error(`getTestTranslations: only locale "${TEST_LOCALE}" is loaded, got "${locale}"`);
  }
  return createTranslator({
    locale: TEST_LOCALE,
    messages: testMessages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    namespace: namespace as any,
    timeZone: TEST_TIME_ZONE,
    onError: failOnIntlError,
  });
}
