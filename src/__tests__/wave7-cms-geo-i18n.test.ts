import { describe, expect, it } from 'vitest';

import de from '../../messages/de.json';
import en from '../../messages/en.json';
import pl from '../../messages/pl.json';
import ua from '../../messages/ua.json';

const messages = { pl, en, ua, de } as const;

function keysOf(namespace: Record<string, unknown>) {
  return Object.keys(namespace).sort();
}

describe('Wave 7 CMS and geo SEO i18n', () => {
  it('keeps programmatic landing keys aligned across PL/EN/UA/DE', () => {
    const reference = keysOf(messages.pl.programmaticLanding);

    expect(keysOf(messages.en.programmaticLanding)).toEqual(reference);
    expect(keysOf(messages.ua.programmaticLanding)).toEqual(reference);
    expect(keysOf(messages.de.programmaticLanding)).toEqual(reference);
  });

  it('keeps Payload blog template breadcrumb copy available in all locales', () => {
    expect(messages.pl.blog.breadcrumb_home).toBeTruthy();
    expect(messages.en.blog.breadcrumb_home).toBeTruthy();
    expect(messages.ua.blog.breadcrumb_home).toBeTruthy();
    expect(messages.de.blog.breadcrumb_home).toBeTruthy();
  });
});