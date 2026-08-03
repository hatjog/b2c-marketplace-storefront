/**
 * v1.14.0 Story 4.6 — AC-A4: przeciek `seo.meta_title` na category i seller detail.
 *
 * Review Story 1.3 (finding `1-3-c2-pl-fallback-live`) domknął tę klasę
 * WYŁĄCZNIE dla PDP i zostawił jawną adnotację, że te same locale-neutralne
 * pola `seo.meta_title` / `meta_description` wygrywają w `generateMetadata`
 * także na `categories/[category]/page.tsx` i `sellers/[handle]/page.tsx`.
 * Ten plik jest testem odtwarzającym tę wadę — jego asercje są CZERWONE na
 * kodzie sprzed 4.6 (potwierdzone przebiegiem przed fixem: `/ua` dostawało
 * `Kategoria Twarz — zabiegi | BonBeauty` zamiast `Обличчя`, a seller
 * `Studio Nova — salon premium w Warszawie | BonBeauty` zamiast
 * zlokalizowanego `title_template`).
 *
 * Wzorzec mocków jest ten sam co w `seo-product-metadata-locale.test.ts`
 * (describe „cykl 2"): PRAWDZIWE `messages/<locale>.json`, wymuszony jawny
 * `{ locale }` w `getTranslations` tam, gdzie kontrakt R-7 tego wymaga, oraz
 * market 4-locale z `defaultLocale: 'pl'`.
 *
 * Bar/`content_bar` NIE jest tu przedmiotem testu — kanał HEAD i kanał body
 * to dwie różne wady (przeciek dotyczył HEAD przy poprawnym body), więc
 * asercje celują wyłącznie w `<title>` / `og:*` / `twitter:*` / description.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// --- Mock next/headers: deterministyczny host (crawler bez env) -------------

vi.mock('next/headers', () => ({
  headers: async () =>
    new Map<string, string>([
      ['host', 'bonbeauty.example'],
      ['x-forwarded-proto', 'https']
    ])
}));

// --- Mock next-intl/server: PRAWDZIWE messages ------------------------------

type Messages = Record<string, unknown>;
const messagesCache = new Map<string, Messages>();

function loadMessages(locale: string): Messages {
  const cached = messagesCache.get(locale);
  if (cached) return cached;
  const file = path.resolve(__dirname, `../../../../messages/${locale}.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Messages;
  messagesCache.set(locale, parsed);
  return parsed;
}

function resolveKey(messages: Messages, dottedKey: string): string {
  const value = dottedKey
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  if (typeof value !== 'string') {
    throw new Error(`Brak klucza i18n: ${dottedKey}`);
  }
  return value;
}

/**
 * Locale „bieżącego requestu". Oba route'y wołają `setRequestLocale(locale)`
 * przed kontekstozależnym `getTranslations('<namespace>')`, więc mock
 * odwzorowuje ten kontrakt zamiast wymuszać jawny `{ locale }` wszędzie.
 */
let requestLocale = 'pl';

vi.mock('next-intl/server', () => ({
  setRequestLocale: (locale: string) => {
    requestLocale = locale;
  },
  getTranslations: async (arg: unknown) => {
    const { locale, namespace } =
      typeof arg === 'string'
        ? { locale: requestLocale, namespace: arg }
        : (arg as { locale?: string; namespace?: string });
    const messages = loadMessages(locale ?? requestLocale);
    return (key: string, params?: Record<string, string>) => {
      const template = resolveKey(messages, namespace ? `${namespace}.${key}` : key);
      return template.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? `{${name}}`);
    };
  }
}));

// --- Mock market-locales: pełny market 4-locale (deployment bonbeauty) ------

vi.mock('@/lib/market-locales', () => ({
  resolveMarketLocales: async () => ({
    supported: ['pl', 'en', 'ua', 'de'],
    defaultLocale: 'pl'
  })
}));

// --- Mock warstw danych obu route'ów ---------------------------------------

const CATEGORY_NAME_BY_LOCALE: Record<string, string> = {
  pl: 'Twarz',
  ua: 'Обличчя',
  de: 'Gesicht',
  en: 'Face'
};

/**
 * Kuratorowane, locale-NEUTRALNE pola SEO — dokładnie taki kształt trzyma
 * dziś `market.yaml → vendors[].seo` i `metadata.gp.seo` kategorii: polski
 * tekst bez wymiaru locale.
 */
const PL_ONLY_SEO = {
  meta_title: 'Kategoria Twarz — zabiegi | BonBeauty',
  meta_description: 'Zabiegi na twarz w Warszawie. Kup voucher w BonBeauty.',
  og_image_url: 'https://cdn.example/curated-og.jpg'
};

vi.mock('@/lib/data/categories', () => ({
  getCategoryByHandle: async (_handle: string, locale: string) => ({
    id: 'pcat_1',
    name: CATEGORY_NAME_BY_LOCALE[locale] ?? CATEGORY_NAME_BY_LOCALE.pl,
    handle: 'twarz',
    description: 'body',
    category_children: [],
    metadata: { gp: { seo: PL_ONLY_SEO } }
  })
}));

const SELLER_PL_ONLY_SEO = {
  meta_title: 'Studio Nova — salon premium w Warszawie | BonBeauty',
  meta_description: 'Salon premium w centrum Warszawy. Zarezerwuj przez BonBeauty.',
  og_image_url: 'https://cdn.example/seller-og.jpg'
};

vi.mock('@/lib/data/seller', () => ({
  getSellerByHandle: async () => ({
    id: 'sel_1',
    name: 'Studio Nova',
    handle: 'studio-nova',
    description: 'Опис салону українською.',
    seo: SELLER_PL_ONLY_SEO,
    photo: null,
    reviews: [],
    products: []
  }),
  getSellers: async () => []
}));

const { generateMetadata: generateCategoryMetadata } = await import(
  '@/app/[locale]/(main)/categories/[category]/page'
);
const { generateMetadata: generateSellerMetadata } = await import(
  '@/app/[locale]/(main)/sellers/[handle]/page'
);

function categoryParams(locale: string) {
  return { params: Promise.resolve({ category: 'twarz', locale }) };
}

function sellerParams(locale: string) {
  return { params: Promise.resolve({ handle: 'studio-nova', locale }) };
}

function headChannels(metadata: Record<string, unknown>) {
  const openGraph = metadata.openGraph as { title?: string; description?: string } | undefined;
  const twitter = metadata.twitter as { title?: string; description?: string } | undefined;
  return {
    titles: [metadata.title, openGraph?.title, twitter?.title],
    descriptions: [metadata.description, openGraph?.description, twitter?.description]
  };
}

describe('Story 4.6 AC-A4 — category detail: PL-only seo.* nie wyciekają poza default locale', () => {
  it.each(['ua', 'de'])(
    '/%s: <title>/og:title/twitter:title = zlokalizowana nazwa kategorii, NIE seo.meta_title',
    async locale => {
      const metadata = await generateCategoryMetadata(categoryParams(locale));
      const { titles, descriptions } = headChannels(metadata as Record<string, unknown>);

      for (const title of titles) {
        expect(title).toBe(CATEGORY_NAME_BY_LOCALE[locale]);
        expect(title).not.toContain('Kategoria Twarz');
      }
      for (const description of descriptions) {
        expect(description).not.toBe(PL_ONLY_SEO.meta_description);
        expect(description).not.toContain('Kup voucher w BonBeauty');
      }
    }
  );

  it('/ua: locale-neutralny seo.og_image_url ZOSTAJE (bramkujemy tylko pola tekstowe)', async () => {
    const metadata = await generateCategoryMetadata(categoryParams('ua'));
    const images = (metadata.openGraph as { images?: Array<{ url: string }> })?.images ?? [];
    expect(images[0]?.url).toBe(PL_ONLY_SEO.og_image_url);
  });

  it('/pl (default locale marketu): kuratorowane seo.meta_title/meta_description dalej wygrywają', async () => {
    const metadata = await generateCategoryMetadata(categoryParams('pl'));
    expect(metadata.title).toBe(PL_ONLY_SEO.meta_title);
    expect(metadata.description).toBe(PL_ONLY_SEO.meta_description);
  });
});

describe('Story 4.6 AC-A4 — seller detail: PL-only seo.* nie wyciekają poza default locale', () => {
  it.each(['ua', 'de'])(
    '/%s: <title>/og:title = zlokalizowany title_template, NIE seller.seo.meta_title',
    async locale => {
      const metadata = await generateSellerMetadata(sellerParams(locale));
      const { titles } = headChannels(metadata as Record<string, unknown>);

      const expected = resolveKey(loadMessages(locale), 'seller.detail.title_template').replace(
        '{name}',
        'Studio Nova'
      );
      for (const title of titles.filter(value => value !== undefined)) {
        expect(title).toBe(expected);
        expect(title).not.toContain('salon premium w Warszawie');
      }
    }
  );

  it.each(['ua', 'de'])(
    '/%s: description NIE pochodzi z PL-only seo.meta_description',
    async locale => {
      const metadata = await generateSellerMetadata(sellerParams(locale));
      const { descriptions } = headChannels(metadata as Record<string, unknown>);

      for (const description of descriptions.filter(value => value !== undefined)) {
        expect(description).not.toBe(SELLER_PL_ONLY_SEO.meta_description);
        expect(description).not.toContain('Zarezerwuj przez BonBeauty');
      }
    }
  );

  it('/ua: locale-neutralny seo.og_image_url ZOSTAJE', async () => {
    const metadata = await generateSellerMetadata(sellerParams('ua'));
    const images = (metadata.openGraph as { images?: Array<{ url: string }> })?.images ?? [];
    expect(images[0]?.url).toBe(SELLER_PL_ONLY_SEO.og_image_url);
  });

  it('/pl (default locale marketu): kuratorowane seo.* dalej wygrywają', async () => {
    const metadata = await generateSellerMetadata(sellerParams('pl'));
    expect(metadata.title).toBe(SELLER_PL_ONLY_SEO.meta_title);
    expect(metadata.description).toBe(SELLER_PL_ONLY_SEO.meta_description);
  });
});
