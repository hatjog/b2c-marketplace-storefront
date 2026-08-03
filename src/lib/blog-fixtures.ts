import type {
  BlogAuthor,
  BlogLocale,
  BlogPostCard,
  BlogPostDetail,
  BlogRichTextNode,
  BlogTag
} from '@/types/blog';

type LocalizedCopy = Record<BlogLocale, string>;

type FixtureSeed = {
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  readTimeMinutes: number;
  image: string;
  category: LocalizedCopy;
  title: LocalizedCopy;
  excerpt: LocalizedCopy;
  author: {
    name: string;
    role: LocalizedCopy;
    bio: LocalizedCopy;
    avatar?: string | null;
    profileUrl?: string | null;
    socialUrl?: string | null;
    socialLabel?: string | null;
  };
  tags: Array<{
    slug: string;
    label: LocalizedCopy;
  }>;
  content?: Record<BlogLocale, BlogRichTextNode[]>;
};

const AUTHORS: Record<string, FixtureSeed['author']> = {
  editorialLead: {
    name: 'Karolina Markiewicz',
    role: {
      pl: 'Redaktorka prowadząca',
      en: 'Editorial lead',
      ua: 'Головна редакторка',
      de: 'Leitende Redakteurin'
    },
    bio: {
      pl: 'Łączy rytuały pielęgnacyjne z praktycznymi wskazówkami zakupowymi dla klientów BonBeauty.',
      en: 'Connects beauty rituals with practical shopping guidance for BonBeauty customers.',
      ua: 'Поєднує бʼюті-ритуали з практичними підказками для клієнтів BonBeauty.',
      de: 'Verbindet Beauty-Rituale mit praktischer Einkaufsberatung für BonBeauty-Kund:innen.'
    },
    avatar: '/images/blog/post-1.jpg',
    profileUrl: '/blog',
    socialUrl: 'https://www.instagram.com/bonbeauty',
    socialLabel: 'Instagram'
  },
  marketEditor: {
    name: 'Marta Vogel',
    role: {
      pl: 'Redaktorka rynku',
      en: 'Market editor',
      ua: 'Редакторка ринку',
      de: 'Marktredakteurin'
    },
    bio: {
      pl: 'Pilnuje, aby historie, oferty i rekomendacje miały lokalny kontekst dla każdego rynku.',
      en: 'Keeps stories, offers, and recommendations grounded in local market context.',
      ua: 'Стежить, щоб історії, пропозиції та рекомендації мали локальний контекст.',
      de: 'Sorgt dafür, dass Stories, Angebote und Empfehlungen lokal relevant bleiben.'
    },
    avatar: '/images/blog/post-2.jpg',
    profileUrl: '/blog'
  }
};

function copy(value: string): LocalizedCopy {
  return { pl: value, en: value, ua: value, de: value };
}

const FIXTURE_POSTS: FixtureSeed[] = [
  {
    slug: 'mercur-accessories-edit',
    publishedAt: '2026-03-14T09:00:00.000Z',
    updatedAt: '2026-03-15T11:30:00.000Z',
    readTimeMinutes: 8,
    image: '/images/blog/post-1.jpg',
    category: {
      pl: 'Rytuały',
      en: 'Rituals',
      ua: 'Ритуали',
      de: 'Rituale'
    },
    title: {
      pl: 'Mercur Accessories Edit for Early Spring',
      en: 'Mercur Accessories Edit for Early Spring',
      ua: 'Mercur Accessories Edit for Early Spring',
      de: 'Mercur Accessories Edit for Early Spring'
    },
    excerpt: {
      pl: 'Jak zbudować spokojny, funkcjonalny rytuał zakupowy wokół dodatków, które naprawdę pracują dla codzienności.',
      en: 'How to build a calm, functional shopping ritual around accessories that genuinely support everyday life.',
      ua: 'Як побудувати спокійний і функціональний ритуал покупок навколо аксесуарів, що справді працюють щодня.',
      de: 'Wie man ein ruhiges, funktionales Einkaufsritual rund um Accessoires aufbaut, die im Alltag wirklich funktionieren.'
    },
    author: AUTHORS.editorialLead,
    tags: [
      {
        slug: 'rituals',
        label: {
          pl: 'Rytuały',
          en: 'Rituals',
          ua: 'Ритуали',
          de: 'Rituale'
        }
      },
      {
        slug: 'accessories',
        label: {
          pl: 'Akcesoria',
          en: 'Accessories',
          ua: 'Аксесуари',
          de: 'Accessoires'
        }
      },
      {
        slug: 'editorial',
        label: {
          pl: 'Redakcja',
          en: 'Editorial',
          ua: 'Редакція',
          de: 'Redaktion'
        }
      }
    ],
    content: {
      pl: [
        { type: 'heading-1', text: 'Wiosenny reset codziennych dodatków' },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Dobry rytuał zakupowy zaczyna się od spokojnej selekcji. Zamiast kupować więcej, warto kupować '
            },
            { type: 'bold', text: 'mądrzej' },
            { type: 'text', text: ', zostawiając miejsce na ' },
            { type: 'italic', text: 'powtarzalność' },
            { type: 'text', text: ', ' },
            { type: 'underline', text: 'czytelne sygnały jakości' },
            { type: 'text', text: ' i ' },
            { type: 'strikethrough', text: 'chaotyczne impulsy' },
            { type: 'text', text: ' wyciszone przez prostą listę wyboru.' }
          ]
        },
        { type: 'heading-2', text: 'Od czego zacząć selekcję' },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Zapisz trzy role dodatku: codzienna funkcja, materiał i sposób pielęgnacji. Pomaga też prosty zapis '
            },
            { type: 'inline-code', text: 'cost-per-wear' },
            { type: 'text', text: ' oraz szybkie porównanie z ' },
            {
              type: 'link',
              text: 'kartą produktu',
              href: '/pl/products/bonbeauty-gift-card'
            },
            { type: 'text', text: '.' }
          ]
        },
        {
          type: 'unordered-list',
          items: [
            [{ type: 'text', text: 'jeden materiał bazowy na cały tydzień' }],
            [{ type: 'text', text: 'jedna forma, która współpracuje z kurtką i torbą' }],
            [{ type: 'text', text: 'jedna decyzja o pielęgnacji zapisana obok zamówienia' }]
          ]
        },
        {
          type: 'blockquote',
          quote: 'Akcesorium ma dodać rytmu do dnia, nie kolejnego mikrozadania do wykonania.',
          citation: 'Karolina Markiewicz'
        },
        { type: 'heading-3', text: 'Mini audyt przed zakupem' },
        {
          type: 'ordered-list',
          items: [
            [
              { type: 'text', text: 'Sprawdź, czy kolor działa z co najmniej trzema stylizacjami.' }
            ],
            [{ type: 'text', text: 'Zweryfikuj teksturę w świetle dziennym i wieczornym.' }],
            [{ type: 'text', text: 'Zapisz, jak szybko element wraca do użycia po czyszczeniu.' }]
          ]
        },
        {
          type: 'pull-quote',
          quote: 'Najlepsze dodatki nie krzyczą. Porządkują ruch, tempo i decyzje.',
          attribution: 'Notatka redakcyjna'
        },
        { type: 'heading-4', text: 'Co warto zapisać po pierwszym tygodniu' },
        {
          type: 'inline-embed',
          title: 'Checklista rytuału dodatków',
          href: '/pl/blog',
          description:
            'Krótka lista pytań do zapisania po pierwszym tygodniu używania nowego dodatku.'
        },
        {
          type: 'image',
          src: '/images/blog/post-2.jpg',
          alt: 'Skórzana torba i złota biżuteria ułożone na jasnym blacie',
          caption: 'Zestaw dodatków powinien pracować w jednej temperaturze kolorystycznej.'
        },
        {
          type: 'video',
          src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          poster: '/images/blog/post-3.jpg',
          title: 'Krótki przegląd materiałów dodatków',
          caption: 'Wideo pokazuje, jak światło zmienia odbiór metalu i skóry.'
        },
        { type: 'divider' },
        {
          type: 'table',
          headers: ['Rola', 'Sygnał jakości', 'Po tygodniu'],
          rows: [
            ['Torba', 'sztywna forma', 'brak przetarć przy uchwycie'],
            ['Biżuteria', 'bezpieczne zapięcie', 'brak odbarwień na skórze'],
            ['Apaszka', 'miękka krawędź', 'łatwe składanie po praniu']
          ],
          caption: 'Prosty rejestr tego, co naprawdę działa po pierwszych użyciach.'
        },
        {
          type: 'embedded-iframe',
          src: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
          title: 'Wideo redakcyjne o planowaniu zestawów dodatków'
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Przy planowaniu kolejnego zakupu wróć do pierwszej obserwacji' },
            { type: 'reference', footnoteId: 'seasonal-ledger', label: '1' },
            { type: 'text', text: ' i porównaj ją z aktualnym rytmem tygodnia.' }
          ]
        },
        {
          type: 'footnote',
          id: 'seasonal-ledger',
          label: '1',
          content:
            'Ledger sezonowy może być zwykłą notatką: data, zestaw, częstotliwość użycia i jedna obserwacja o wygodzie.'
        }
      ],
      en: [
        { type: 'heading-1', text: 'A spring reset for everyday accessories' },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'A useful shopping ritual starts with calm selection. Instead of buying more, buy '
            },
            { type: 'bold', text: 'with intent' },
            { type: 'text', text: ', leaving room for ' },
            { type: 'italic', text: 'repeat use' },
            { type: 'text', text: ', ' },
            { type: 'underline', text: 'clear quality signals' },
            { type: 'text', text: ' and ' },
            { type: 'strikethrough', text: 'noisy impulses' },
            { type: 'text', text: ' replaced by a short decision list.' }
          ]
        },
        { type: 'heading-2', text: 'Where selection should begin' },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Write down three jobs for the accessory: everyday function, material, and care routine. A quick '
            },
            { type: 'inline-code', text: 'cost-per-wear' },
            { type: 'text', text: ' note also helps, alongside the ' },
            { type: 'link', text: 'product card', href: '/en/products/bonbeauty-gift-card' },
            { type: 'text', text: '.' }
          ]
        },
        {
          type: 'unordered-list',
          items: [
            [{ type: 'text', text: 'one base material for the full week' }],
            [{ type: 'text', text: 'one shape that works with jacket and bag' }],
            [{ type: 'text', text: 'one care decision saved next to the order' }]
          ]
        },
        {
          type: 'blockquote',
          quote: 'An accessory should add rhythm to the day, not another micro-task.',
          citation: 'Karolina Markiewicz'
        },
        { type: 'heading-3', text: 'A quick audit before checkout' },
        {
          type: 'ordered-list',
          items: [
            [{ type: 'text', text: 'Check whether the color works with three outfits.' }],
            [{ type: 'text', text: 'Verify texture in daylight and evening light.' }],
            [{ type: 'text', text: 'Note how quickly the item returns to use after cleaning.' }]
          ]
        },
        {
          type: 'pull-quote',
          quote: 'The best accessories do not shout. They organize motion, pace, and decisions.',
          attribution: 'Editorial note'
        },
        { type: 'heading-4', text: 'What to log after the first week' },
        {
          type: 'inline-embed',
          title: 'Accessory ritual checklist',
          href: '/en/blog',
          description:
            'A short list of questions to save after the first week with a new accessory.'
        },
        {
          type: 'image',
          src: '/images/blog/post-2.jpg',
          alt: 'A leather bag and gold jewelry arranged on a light table',
          caption: 'Accessories work best when they stay in the same color temperature.'
        },
        {
          type: 'video',
          src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          poster: '/images/blog/post-3.jpg',
          title: 'A short review of accessory materials',
          caption: 'The video shows how light changes the feel of metal and leather.'
        },
        { type: 'divider' },
        {
          type: 'table',
          headers: ['Role', 'Quality signal', 'After one week'],
          rows: [
            ['Bag', 'structured silhouette', 'no handle abrasion'],
            ['Jewelry', 'secure clasp', 'no skin discoloration'],
            ['Scarf', 'soft edge finish', 'easy folding after washing']
          ],
          caption: 'A simple register of what actually works after first use.'
        },
        {
          type: 'embedded-iframe',
          src: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
          title: 'Editorial video on accessory planning'
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'When planning the next purchase, return to your first observation'
            },
            { type: 'reference', footnoteId: 'seasonal-ledger', label: '1' },
            { type: 'text', text: ' and compare it with the actual rhythm of the week.' }
          ]
        },
        {
          type: 'footnote',
          id: 'seasonal-ledger',
          label: '1',
          content:
            'The seasonal ledger can stay simple: date, outfit, frequency of use, and one comfort observation.'
        }
      ],
      ua: [],
      de: []
    }
  },
  {
    slug: 'quiet-layers-before-work',
    publishedAt: '2026-03-08T08:15:00.000Z',
    readTimeMinutes: 5,
    image: '/images/blog/post-2.jpg',
    category: copy('Editorial'),
    title: {
      pl: 'Ciche warstwy przed wyjściem do pracy',
      en: 'Quiet layers before the workday starts',
      ua: 'Тихі шари перед початком робочого дня',
      de: 'Ruhige Layer vor dem Arbeitstag'
    },
    excerpt: {
      pl: 'Krótki przewodnik po teksturach, które budują spokój zamiast wizualnego hałasu.',
      en: 'A short guide to textures that create calm instead of visual noise.',
      ua: 'Короткий гід по текстурам, що створюють спокій замість візуального шуму.',
      de: 'Ein kurzer Leitfaden zu Texturen, die Ruhe statt visuellen Lärm erzeugen.'
    },
    author: AUTHORS.marketEditor,
    tags: [
      { slug: 'editorial', label: copy('Editorial') },
      {
        slug: 'textures',
        label: { pl: 'Tekstury', en: 'Textures', ua: 'Текстури', de: 'Texturen' }
      }
    ]
  },
  {
    slug: 'bathroom-shelf-edit',
    publishedAt: '2026-03-02T07:40:00.000Z',
    readTimeMinutes: 6,
    image: '/images/blog/post-3.jpg',
    category: copy('Rituals'),
    title: {
      pl: 'Bathroom shelf edit na 10 minut',
      en: 'A 10-minute bathroom shelf edit',
      ua: '10-хвилинний редизайн полиці у ванній',
      de: 'Ein 10-Minuten-Edit für das Badregal'
    },
    excerpt: {
      pl: 'Jak uporządkować pielęgnację tak, aby poranna sekwencja była krótsza i czytelniejsza.',
      en: 'How to organize your care routine so the morning sequence gets shorter and clearer.',
      ua: 'Як упорядкувати догляд так, щоб ранкова послідовність стала коротшою і зрозумілішою.',
      de: 'Wie man die Pflege so organisiert, dass die Morgenroutine kürzer und klarer wird.'
    },
    author: AUTHORS.editorialLead,
    tags: [
      { slug: 'rituals', label: { pl: 'Rytuały', en: 'Rituals', ua: 'Ритуали', de: 'Rituale' } },
      { slug: 'care', label: { pl: 'Pielęgnacja', en: 'Care', ua: 'Догляд', de: 'Pflege' } }
    ]
  },
  {
    slug: 'desk-reset-friday',
    publishedAt: '2026-02-26T10:20:00.000Z',
    readTimeMinutes: 4,
    image: '/images/blog/post-1.jpg',
    category: copy('Routine'),
    title: {
      pl: 'Friday desk reset przed weekendem',
      en: 'A Friday desk reset before the weekend',
      ua: 'Пʼятничний desk reset перед вихідними',
      de: 'Desk Reset am Freitag vor dem Wochenende'
    },
    excerpt: {
      pl: 'Pięć ruchów, które przenoszą porządek z biurka do domowego rytmu.',
      en: 'Five moves that transfer order from the desk into your home rhythm.',
      ua: 'Пʼять кроків, що переносять порядок зі столу у домашній ритм.',
      de: 'Fünf Schritte, die Ordnung vom Schreibtisch in den Alltag übertragen.'
    },
    author: AUTHORS.marketEditor,
    tags: [
      { slug: 'routine', label: { pl: 'Rutyna', en: 'Routine', ua: 'Рутина', de: 'Routine' } },
      {
        slug: 'workspace',
        label: { pl: 'Przestrzeń', en: 'Workspace', ua: 'Простір', de: 'Workspace' }
      }
    ]
  },
  {
    slug: 'signature-scent-notes',
    publishedAt: '2026-02-18T12:00:00.000Z',
    readTimeMinutes: 7,
    image: '/images/blog/post-2.jpg',
    category: copy('Fragrance'),
    title: {
      pl: 'Jak prowadzić notatki do signature scent',
      en: 'How to keep notes for a signature scent',
      ua: 'Як вести нотатки для signature scent',
      de: 'Wie man Notizen für einen Signature-Duft führt'
    },
    excerpt: {
      pl: 'Metoda trzech skojarzeń do testowania zapachu bez przeciążania pamięci.',
      en: 'A three-association method for testing fragrance without overloading memory.',
      ua: 'Метод трьох асоціацій для тестування аромату без перевантаження пам’яті.',
      de: 'Eine Drei-Assoziationen-Methode zum Testen von Duft ohne Gedächtnisüberlastung.'
    },
    author: AUTHORS.editorialLead,
    tags: [
      { slug: 'fragrance', label: { pl: 'Zapach', en: 'Fragrance', ua: 'Аромат', de: 'Duft' } },
      { slug: 'rituals', label: { pl: 'Rytuały', en: 'Rituals', ua: 'Ритуали', de: 'Rituale' } }
    ]
  },
  {
    slug: 'weekend-bag-checklist',
    publishedAt: '2026-02-11T06:50:00.000Z',
    readTimeMinutes: 5,
    image: '/images/blog/post-3.jpg',
    category: copy('Travel'),
    title: {
      pl: 'Weekend bag checklist bez przeładowania',
      en: 'A weekend bag checklist without overpacking',
      ua: 'Weekend bag checklist без перевантаження',
      de: 'Wochenendtaschen-Checkliste ohne Überpacken'
    },
    excerpt: {
      pl: 'Jedna lista dla kosmetyczki, dodatków i rzeczy awaryjnych, która nie psuje tempa wyjazdu.',
      en: 'One list for beauty, accessories, and contingencies that does not slow the trip down.',
      ua: 'Один список для косметики, аксесуарів і запасного плану, що не гальмує поїздку.',
      de: 'Eine Liste für Beauty, Accessoires und Notfälle, die die Reise nicht ausbremst.'
    },
    author: AUTHORS.marketEditor,
    tags: [
      { slug: 'travel', label: { pl: 'Podróż', en: 'Travel', ua: 'Подорож', de: 'Reise' } },
      {
        slug: 'accessories',
        label: { pl: 'Akcesoria', en: 'Accessories', ua: 'Аксесуари', de: 'Accessoires' }
      }
    ]
  },
  {
    slug: 'mirror-check-before-event',
    publishedAt: '2026-02-04T09:45:00.000Z',
    readTimeMinutes: 4,
    image: '/images/blog/post-1.jpg',
    category: copy('Editorial'),
    title: {
      pl: 'Mirror check przed wieczornym wyjściem',
      en: 'A mirror check before an evening event',
      ua: 'Mirror check перед вечірнім виходом',
      de: 'Mirror Check vor dem Abendtermin'
    },
    excerpt: {
      pl: 'Trzy pytania, które pomagają domknąć look bez dokładania zbędnych elementów.',
      en: 'Three questions that help close a look without adding unnecessary pieces.',
      ua: 'Три питання, які допомагають завершити образ без зайвих елементів.',
      de: 'Drei Fragen, die einen Look schließen, ohne unnötige Teile hinzuzufügen.'
    },
    author: AUTHORS.editorialLead,
    tags: [
      { slug: 'editorial', label: copy('Editorial') },
      { slug: 'occasion', label: { pl: 'Okazje', en: 'Occasions', ua: 'Події', de: 'Anlässe' } }
    ]
  },
  {
    slug: 'countertop-evening-reset',
    publishedAt: '2026-01-28T18:20:00.000Z',
    readTimeMinutes: 3,
    image: '/images/blog/post-2.jpg',
    category: copy('Routine'),
    title: {
      pl: 'Countertop reset po wieczornej pielęgnacji',
      en: 'A countertop reset after evening care',
      ua: 'Countertop reset після вечірнього догляду',
      de: 'Countertop Reset nach der Abendpflege'
    },
    excerpt: {
      pl: 'Mały porządek, który sprawia, że poranek zaczyna się bez dodatkowych decyzji.',
      en: 'A small tidy-up that lets the morning begin without extra decisions.',
      ua: 'Невелике впорядкування, після якого ранок починається без зайвих рішень.',
      de: 'Ein kleines Aufräumen, das den Morgen ohne Zusatzentscheidungen starten lässt.'
    },
    author: AUTHORS.marketEditor,
    tags: [
      { slug: 'routine', label: { pl: 'Rutyna', en: 'Routine', ua: 'Рутина', de: 'Routine' } },
      { slug: 'care', label: { pl: 'Pielęgnacja', en: 'Care', ua: 'Догляд', de: 'Pflege' } }
    ]
  }
];

function resolveLocalizedCopy(copySet: LocalizedCopy, locale: BlogLocale) {
  return copySet[locale] || copySet.pl;
}

function resolveAuthor(author: FixtureSeed['author'], locale: BlogLocale): BlogAuthor {
  return {
    name: author.name,
    role: resolveLocalizedCopy(author.role, locale),
    bio: resolveLocalizedCopy(author.bio, locale),
    avatar: author.avatar ?? null,
    profileUrl: author.profileUrl ?? null,
    socialUrl: author.socialUrl ?? null,
    socialLabel: author.socialLabel ?? null
  };
}

function resolveTags(tags: FixtureSeed['tags'], locale: BlogLocale): BlogTag[] {
  return tags.map(tag => ({
    slug: tag.slug,
    label: resolveLocalizedCopy(tag.label, locale)
  }));
}

function resolveContent(seed: FixtureSeed, locale: BlogLocale): BlogRichTextNode[] {
  const content = seed.content?.[locale];
  if (content && content.length > 0) {
    return content;
  }

  return seed.content?.en || seed.content?.pl || [];
}

export function getFixtureBlogCards(locale: BlogLocale): BlogPostCard[] {
  return FIXTURE_POSTS.map(seed => ({
    id: seed.slug,
    slug: seed.slug,
    title: resolveLocalizedCopy(seed.title, locale),
    excerpt: resolveLocalizedCopy(seed.excerpt, locale),
    image: seed.image,
    imageAlt: resolveLocalizedCopy(seed.title, locale),
    category: resolveLocalizedCopy(seed.category, locale),
    href: `/blog/${seed.slug}`,
    tags: resolveTags(seed.tags, locale),
    author: resolveAuthor(seed.author, locale),
    readTimeMinutes: seed.readTimeMinutes,
    publishedAt: seed.publishedAt
  }));
}

export function getFixtureBlogPost(locale: BlogLocale, slug: string): BlogPostDetail | null {
  const seed = FIXTURE_POSTS.find(entry => entry.slug === slug);
  if (!seed) {
    return null;
  }

  const cards = getFixtureBlogCards(locale);
  const card = cards.find(entry => entry.slug === slug);
  if (!card) {
    return null;
  }

  return {
    ...card,
    heroImage: seed.image,
    heroImageAlt: card.imageAlt,
    updatedAt: seed.updatedAt ?? null,
    content: resolveContent(seed, locale),
    relatedPosts: cards.filter(entry => entry.slug !== slug).slice(0, 3)
  };
}
