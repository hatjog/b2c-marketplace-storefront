import type { HttpTypes } from '@medusajs/types';

import { getCollectionPhotoUrl } from '@/lib/collection-media';
import {
  getCollectionByHandle,
  listCollections,
  type StoreCollectionDetail
} from '@/lib/data/collections';

export type EditorialCollectionBucket = 'editorial' | 'seasonal' | 'recommended';
export type EditorialCollectionSortKey = 'curated' | 'title-asc' | 'title-desc';

type EditorialCollectionFixture = {
  handle: string;
  bucket: EditorialCollectionBucket;
  themeKey: string;
  featured: boolean;
  overlay: 'dark' | 'warm' | 'soft';
  heroImage?: string | null;
  fallbackItems?: Array<{
    id: string;
    title: string;
    handle: string;
    imageUrl?: string | null;
  }>;
};

export type EditorialCollectionCard = {
  handle: string;
  title: string;
  excerpt: string;
  itemCount: number;
  imageUrl: string | null;
  bucket: EditorialCollectionBucket;
  featured: boolean;
  overlay: 'dark' | 'warm' | 'soft';
};

export type EditorialCollectionDetailData = {
  handle: string;
  title: string;
  excerpt: string;
  intro: string;
  callout: string;
  quote: string;
  quoteAttribution: string;
  itemCount: number;
  imageUrl: string | null;
  overlay: 'dark' | 'warm' | 'soft';
  bucket: EditorialCollectionBucket;
  items: Array<{
    id: string;
    title: string;
    handle: string;
    imageUrl: string | null;
  }>;
  sort: EditorialCollectionSortKey;
  related: EditorialCollectionCard[];
  isEmpty: boolean;
};

const FALLBACK_COLLECTIONS: EditorialCollectionFixture[] = [
  {
    handle: 'wybor-redakcji',
    bucket: 'editorial',
    themeKey: 'editorialSelect',
    featured: true,
    overlay: 'dark',
    heroImage: '/images/placeholder.svg',
    fallbackItems: [
      { id: 'ed-1', title: 'Rytuał liftingujący 60 min', handle: 'rytual-liftingujacy-60-min' },
      { id: 'ed-2', title: 'Voucher glow facial', handle: 'voucher-glow-facial' },
      { id: 'ed-3', title: 'Pakiet city spa duet', handle: 'pakiet-city-spa-duet' }
    ]
  },
  {
    handle: 'sezonowe-rytualy',
    bucket: 'seasonal',
    themeKey: 'seasonalRituals',
    featured: false,
    overlay: 'warm',
    heroImage: '/images/placeholder.svg',
    fallbackItems: [
      { id: 'sr-1', title: 'Rytuał nawilżający po słońcu', handle: 'rytual-nawilzajacy-po-sloncu' },
      { id: 'sr-2', title: 'Masaż slow weekend', handle: 'masaz-slow-weekend' }
    ]
  },
  {
    handle: 'polecane-prezenty',
    bucket: 'recommended',
    themeKey: 'giftShortlist',
    featured: false,
    overlay: 'soft',
    heroImage: '/images/placeholder.svg',
    fallbackItems: [
      { id: 'gs-1', title: 'Voucher podarunkowy 200 zł', handle: 'voucher-200' },
      { id: 'gs-2', title: 'Zestaw manicure + brow bar', handle: 'zestaw-manicure-brow-bar' },
      {
        id: 'gs-3',
        title: 'Pakiet relaksacyjny dla dwojga',
        handle: 'pakiet-relaksacyjny-dla-dwojga'
      }
    ]
  },
  {
    handle: 'pusta-kolekcja',
    bucket: 'editorial',
    themeKey: 'quietArchive',
    featured: false,
    overlay: 'soft',
    heroImage: '/images/placeholder.svg',
    fallbackItems: []
  }
];

const BUCKET_ORDER: EditorialCollectionBucket[] = ['editorial', 'seasonal', 'recommended'];

const THEME_COPY = {
  pl: {
    editorialSelect: {
      title: 'Wybór redakcji',
      excerpt: 'Rzeczy wybrane ręcznie przez zespół BonBeauty, bez algorytmu i bez pośpiechu.',
      intro:
        'Ta kolekcja zbiera spokojne rekomendacje redakcji: zabiegi i vouchery, które najczytelniej pokazują sposób wyboru BonBeauty.',
      callout: 'Kolejność nie jest rankingiem. To świadomie ułożona ścieżka odkrywania.',
      quote:
        'Szukamy propozycji, które naprawdę pomagają podjąć decyzję, a nie tylko dobrze wyglądają w siatce.',
      quoteAttribution: 'Redakcja BonBeauty'
    },
    seasonalRituals: {
      title: 'Sezonowe rytuały',
      excerpt:
        'Kuratorowane zestawienie zabiegów, do których wraca się wtedy, gdy zmienia się tempo tygodnia i pogoda.',
      intro:
        'Sezonowe rytuały porządkują oferty pod konkretny moment roku: regenerację, wyciszenie i szybkie odświeżenie.',
      callout: 'To wybór pod konkretny nastrój i potrzebę, nie wynik automatycznej personalizacji.',
      quote:
        'Najlepsze kolekcje sezonowe nie gonią trendu. Dają prosty punkt startu, kiedy chcesz wybrać coś szybko i dobrze.',
      quoteAttribution: 'Zespół odkrywania redakcyjnego'
    },
    giftShortlist: {
      title: 'Polecane prezenty',
      excerpt:
        'Prezenty i vouchery, które łatwo podarować bez zgadywania, jaki zabieg będzie najlepszy.',
      intro:
        'Ta kolekcja została ułożona z myślą o bezpiecznym, eleganckim prezencie: łatwym do wyboru i prostym do wyjaśnienia.',
      callout:
        'Pokazujemy propozycje o różnym progu wejścia, ale bez udawania dynamicznego rankingu.',
      quote: 'Dobra kolekcja prezentowa skraca drogę do decyzji i zostawia miejsce na własny gest.',
      quoteAttribution: 'Notatki redakcji prezentowej'
    },
    quietArchive: {
      title: 'Cicha kolekcja',
      excerpt:
        'Miejsce gotowe na następną serię rekomendacji, gdy redakcja zakończy kolejny research.',
      intro:
        'Ta kolekcja jest przygotowana pod następny zestaw inspiracji. Struktura jest gotowa, ale wybór produktów jeszcze się domyka.',
      callout:
        'Pusta kolekcja nie maskuje braku danych. Pokazuje tylko, że redakcja jeszcze nie opublikowała shortlisty.',
      quote:
        'W odkrywaniu redakcyjnym cisza też jest sygnałem: wolimy opublikować mniej, ale pewniej.',
      quoteAttribution: 'Redakcja BonBeauty'
    }
  },
  en: {
    editorialSelect: {
      title: 'Editor’s choice',
      excerpt: 'Hand-picked by the BonBeauty team, with no algorithm deciding what comes first.',
      intro:
        'This collection gathers the calmest editorial recommendations: treatments and vouchers that explain the BonBeauty point of view.',
      callout: 'The order is curated, not ranked. It is a guided discovery path.',
      quote:
        'We look for options that truly help someone decide, not just cards that look good in a grid.',
      quoteAttribution: 'BonBeauty editorial'
    },
    seasonalRituals: {
      title: 'Seasonal rituals',
      excerpt:
        'Curated treatments for moments when the weather changes and your weekly rhythm needs a reset.',
      intro:
        'Seasonal rituals group offers around a clear mood: recovery, calm and a polished refresh without overthinking.',
      callout:
        'This is a mood board translated into commerce, not an automated recommendation feed.',
      quote:
        'The best seasonal collections do not chase trends. They give you a clear starting point when you want to choose well, quickly.',
      quoteAttribution: 'Editorial discovery team'
    },
    giftShortlist: {
      title: 'Recommended gifts',
      excerpt:
        'Gift-friendly vouchers and treatments selected to be easy to explain and easy to give.',
      intro:
        'This shortlist is built for gifting: polished, legible offers that work when you want a confident present without guesswork.',
      callout: 'We surface a range of entry points, but we do not pretend this is a live ranking.',
      quote:
        'A good gift collection shortens the path to a decision and still leaves space for a personal gesture.',
      quoteAttribution: 'Curated gifting notes'
    },
    quietArchive: {
      title: 'Quiet archive',
      excerpt:
        'A reserved slot for the next round of recommendations once the editorial pass is finished.',
      intro:
        'The shell is ready for the next recommendation set. The collection stays intentionally empty until the shortlist is signed off.',
      callout:
        'An empty collection should stay honest about missing curation instead of faking inventory.',
      quote:
        'Silence can also be a signal in editorial discovery: publish less, but publish with confidence.',
      quoteAttribution: 'BonBeauty editorial'
    }
  },
  ua: {
    editorialSelect: {
      title: 'Вибір редакції',
      excerpt: 'Добірка команди BonBeauty без алгоритмічного ранжування та випадкових пріоритетів.',
      intro:
        'Ця колекція збирає найспокійніші редакційні рекомендації: процедури та ваучери, що найкраще пояснюють підхід BonBeauty.',
      callout: 'Порядок тут кураторський, а не рейтинговий. Це керований маршрут відкриття.',
      quote:
        'Ми шукаємо пропозиції, які реально допомагають ухвалити рішення, а не просто добре виглядають у сітці.',
      quoteAttribution: 'Редакція BonBeauty'
    },
    seasonalRituals: {
      title: 'Сезонні ритуали',
      excerpt:
        'Кураторовані процедури для моментів, коли змінюється погода і потрібне м’яке перезавантаження.',
      intro:
        'Сезонні ритуали групують офери навколо чіткого настрою: відновлення, спокій і швидке оновлення без зайвого шуму.',
      callout: 'Це не автоматична персоналізація, а кураторський добір під конкретний настрій.',
      quote:
        'Найкращі сезонні колекції не женуться за трендом. Вони дають зрозумілий старт, коли потрібно вибрати швидко і добре.',
      quoteAttribution: 'Команда редакційного відкриття'
    },
    giftShortlist: {
      title: 'Рекомендовані подарунки',
      excerpt: 'Ваучери та процедури, які легко подарувати без складних пояснень і здогадок.',
      intro:
        'Цей shortlist створений для подарунка: зрозумілі, акуратні пропозиції, коли хочеться подарувати красиво та впевнено.',
      callout: 'Ми показуємо різні пороги входу, але не маскуємо це під живий рейтинг.',
      quote:
        'Хороша подарункова колекція скорочує шлях до рішення і залишає місце для особистого жесту.',
      quoteAttribution: 'Нотатки подарункової редакції'
    },
    quietArchive: {
      title: 'Тиха колекція',
      excerpt: 'Підготовлений слот для наступної добірки, щойно редакція завершить новий прохід.',
      intro:
        'Структура вже готова для наступного набору рекомендацій. Колекція лишається порожньою, поки shortlist не затверджено.',
      callout:
        'Порожня колекція не маскує відсутність курації. Вона чесно показує, що добірка ще не опублікована.',
      quote: 'Тиша теж може бути сигналом: краще опублікувати менше, але впевненіше.',
      quoteAttribution: 'Редакція BonBeauty'
    }
  },
  de: {
    editorialSelect: {
      title: 'Auswahl der Redaktion',
      excerpt:
        'Von BonBeauty von Hand kuratiert, ohne algorithmische Reihenfolge und ohne künstlichen Druck.',
      intro:
        'Diese Kollektion bündelt die ruhigsten redaktionellen Empfehlungen: Treatments und Gutscheine, die den BonBeauty-Blick am klarsten zeigen.',
      callout: 'Die Reihenfolge ist kuratiert, nicht gerankt. Sie führt bewusst durch die Auswahl.',
      quote:
        'Wir suchen Angebote, die wirklich bei einer Entscheidung helfen und nicht nur gut in einer Grid-Ansicht aussehen.',
      quoteAttribution: 'BonBeauty Redaktion'
    },
    seasonalRituals: {
      title: 'Saisonale Rituale',
      excerpt:
        'Kuratierte Treatments für Momente, in denen sich Wetter und Wochenrhythmus verändern.',
      intro:
        'Saisonale Rituale ordnen Angebote nach einer klaren Stimmung: Regeneration, Ruhe und ein schnelles, gepflegtes Update.',
      callout:
        'Das ist eine kuratierte Auswahl für einen bestimmten Moment, keine automatische Empfehlungsschleife.',
      quote:
        'Die besten saisonalen Kollektionen jagen keinem Trend nach. Sie geben einen klaren Startpunkt, wenn man schnell und gut wählen will.',
      quoteAttribution: 'Editorial-Discovery-Team'
    },
    giftShortlist: {
      title: 'Empfohlene Geschenke',
      excerpt: 'Gutscheine und Treatments, die sich ohne Rätselraten leicht schenken lassen.',
      intro:
        'Diese Shortlist ist für Geschenke gebaut: klare, elegante Angebote für einen sicheren Present-Moment ohne Unsicherheit.',
      callout:
        'Wir zeigen verschiedene Einstiegspunkte, tun aber nicht so, als wäre das ein Live-Ranking.',
      quote:
        'Eine gute Geschenk-Kollektion verkürzt den Weg zur Entscheidung und lässt trotzdem Raum für eine persönliche Geste.',
      quoteAttribution: 'Notizen der Geschenkredaktion'
    },
    quietArchive: {
      title: 'Leises Archiv',
      excerpt:
        'Ein reservierter Platz für die nächste Empfehlungsschleife, sobald die Redaktion ihren Review abgeschlossen hat.',
      intro:
        'Die Struktur ist bereit für die nächste Auswahl. Die Kollektion bleibt bewusst leer, bis die neue Shortlist freigegeben ist.',
      callout:
        'Eine leere Kollektion soll fehlende Kuration nicht kaschieren, sondern ehrlich sichtbar machen.',
      quote:
        'Stille kann im Editorial Discovery ebenfalls ein Signal sein: lieber weniger veröffentlichen, aber mit Sicherheit.',
      quoteAttribution: 'BonBeauty Redaktion'
    }
  }
} as const;

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getFixtureByHandle(handle: string) {
  return FALLBACK_COLLECTIONS.find(collection => collection.handle === handle) ?? null;
}

function resolveThemeCopy(locale: string, themeKey: string) {
  const dictionary = THEME_COPY[locale as keyof typeof THEME_COPY] ?? THEME_COPY.en;

  return dictionary[themeKey as keyof typeof dictionary] ?? dictionary.editorialSelect;
}

function resolveBucket(index: number) {
  return BUCKET_ORDER[index % BUCKET_ORDER.length] ?? 'editorial';
}

function sortCollectionItems(
  items: EditorialCollectionDetailData['items'],
  sort: EditorialCollectionSortKey
) {
  if (sort === 'curated') {
    return items;
  }

  const sorted = [...items].sort((left, right) => left.title.localeCompare(right.title, 'pl'));
  return sort === 'title-desc' ? sorted.reverse() : sorted;
}

function buildCollectionCard(
  locale: string,
  collection: HttpTypes.StoreCollection | null,
  fixture: EditorialCollectionFixture,
  index: number
): EditorialCollectionCard {
  const copy = resolveThemeCopy(locale, fixture.themeKey);
  const liveItemCount = Array.isArray((collection as StoreCollectionDetail | null)?.products)
    ? ((collection as StoreCollectionDetail).products?.length ?? 0)
    : 0;
  const fallbackItemCount = fixture.fallbackItems?.length ?? 0;

  return {
    handle: fixture.handle,
    title: normalizeString(collection?.title) ?? copy.title,
    excerpt: copy.excerpt,
    itemCount: liveItemCount || fallbackItemCount,
    imageUrl: getCollectionPhotoUrl(collection) ?? fixture.heroImage ?? null,
    bucket: fixture.bucket ?? resolveBucket(index),
    featured: fixture.featured,
    overlay: fixture.overlay
  };
}

export async function listEditorialCollections(locale: string) {
  const live = await listCollections().catch(() => ({ collections: [], count: 0 }));
  const liveByHandle = new Map(live.collections.map(collection => [collection.handle, collection]));

  const cards = FALLBACK_COLLECTIONS.map((fixture, index) =>
    buildCollectionCard(locale, liveByHandle.get(fixture.handle) ?? null, fixture, index)
  );

  return {
    featured: cards.find(collection => collection.featured) ?? cards[0] ?? null,
    cards,
    grouped: {
      editorial: cards.filter(card => card.bucket === 'editorial'),
      seasonal: cards.filter(card => card.bucket === 'seasonal'),
      recommended: cards.filter(card => card.bucket === 'recommended')
    }
  };
}

export async function getEditorialCollectionDetail({
  handle,
  locale,
  sort = 'curated'
}: {
  handle: string;
  locale: string;
  sort?: EditorialCollectionSortKey;
}): Promise<EditorialCollectionDetailData | null> {
  const fixture = getFixtureByHandle(handle);

  if (!fixture) {
    return null;
  }

  const [liveCollection, allCollections] = await Promise.all([
    getCollectionByHandle(handle).catch(() => null),
    listCollections().catch(() => ({ collections: [], count: 0 }))
  ]);
  const copy = resolveThemeCopy(locale, fixture.themeKey);
  const liveProducts = Array.isArray(liveCollection?.products)
    ? liveCollection.products.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle ?? product.id,
        imageUrl: normalizeString(product.thumbnail)
      }))
    : [];
  const fallbackItems =
    fixture.fallbackItems?.map(item => ({
      id: item.id,
      title: item.title,
      handle: item.handle,
      imageUrl: item.imageUrl ?? null
    })) ?? [];
  const items = liveProducts.length > 0 ? liveProducts : fallbackItems;
  const imageUrl = getCollectionPhotoUrl(liveCollection) ?? fixture.heroImage ?? null;
  const related = FALLBACK_COLLECTIONS.filter(item => item.handle !== handle)
    .slice(0, 3)
    .map((item, index) =>
      buildCollectionCard(
        locale,
        allCollections.collections.find(collection => collection.handle === item.handle) ?? null,
        item,
        index
      )
    );

  return {
    handle,
    title: normalizeString(liveCollection?.title) ?? copy.title,
    excerpt: copy.excerpt,
    intro: copy.intro,
    callout: copy.callout,
    quote: copy.quote,
    quoteAttribution: copy.quoteAttribution,
    itemCount: items.length,
    imageUrl,
    overlay: fixture.overlay,
    bucket: fixture.bucket,
    items: sortCollectionItems(items, sort),
    sort,
    related,
    isEmpty: items.length === 0
  };
}

export function getEditorialCollectionHandles() {
  return FALLBACK_COLLECTIONS.map(collection => collection.handle);
}
