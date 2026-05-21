import { getSellerByHandle } from '@/lib/data/seller';
import type { SellerProps } from '@/types/seller';

type SellerReviewFixture = {
  id: string;
  author: string;
  rating: number;
  serviceName: string;
  body: string;
  createdAt: string;
  verifiedVisit: boolean;
  sellerReply?: string | null;
};

type RawSellerReview = {
  id?: string | null;
  rating?: number | null;
  customer_note?: string | null;
  seller_note?: string | null;
  created_at?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

export type SellerReviewSortKey = 'newest' | 'highest' | 'lowest';

type SellerReviewOffer = {
  title?: string | null;
};

export type SellerReviewsSeller = {
  handle: string;
  name: string;
  displayName: string;
  imageUrl: string | null;
  city: string | null;
  district: string | null;
  offers: SellerReviewOffer[];
};

export type SellerReviewItem = {
  id: string;
  author: string;
  rating: number;
  serviceName: string;
  body: string;
  createdAt: string;
  verifiedVisit: boolean;
  sellerReply: string | null;
};

export type SellerReviewBreakdownRow = {
  rating: number;
  count: number;
  share: number;
};

export type SellerReviewsSurfaceData = {
  seller: SellerReviewsSeller;
  reviews: SellerReviewItem[];
  totalReviews: number;
  visibleReviews: SellerReviewItem[];
  averageRating: number | null;
  breakdown: SellerReviewBreakdownRow[];
  activeRating: number | null;
  sort: SellerReviewSortKey;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const FALLBACK_SERVICE_NAMES = [
  'Rytuał twarzy',
  'Manicure z pielęgnacją',
  'Masaż relaksacyjny',
  'Konsultacja pielęgnacyjna'
] as const;

const SELLER_REVIEW_FIXTURES: Record<string, SellerReviewFixture[]> = {
  'apteczna-pracownia-kasi': [
    {
      id: 'apr-1',
      author: 'Magda K.',
      rating: 5,
      serviceName: 'Kwas migdałowy z konsultacją',
      body: 'Plan zabiegowy został rozpisany bardzo konkretnie, bez nachalnej sprzedaży. Skóra była spokojniejsza już po pierwszej wizycie.',
      createdAt: '2026-04-19T09:30:00.000Z',
      verifiedVisit: true,
      sellerReply:
        'Dziękujemy. Przy kolejnej wizycie sprawdzimy, jak skóra reaguje na plan domowy i ewentualnie rozszerzymy terapię.'
    },
    {
      id: 'apr-2',
      author: 'Alicja N.',
      rating: 5,
      serviceName: 'Plan pielęgnacyjny 60 min',
      body: 'Najbardziej doceniam spokojne tłumaczenie, dlaczego odstawiono część kosmetyków i jak wprowadzić nowe produkty bez podrażnienia.',
      createdAt: '2026-03-28T14:10:00.000Z',
      verifiedVisit: true
    },
    {
      id: 'apr-3',
      author: 'Kasia R.',
      rating: 4,
      serviceName: 'Kuracja anti-redness',
      body: 'Efekt wyciszenia zaczerwienień był widoczny szybko. Jedyny minus to lekki poślizg względem godziny wizyty, ale sam zabieg bardzo dobry.',
      createdAt: '2026-02-14T18:05:00.000Z',
      verifiedVisit: true
    },
    {
      id: 'apr-4',
      author: 'Natalia B.',
      rating: 5,
      serviceName: 'Konsultacja kontrolna',
      body: 'Wróciłam po miesiącu i dostałam jasne wskazówki co kontynuować, a co zmienić. Bardzo merytoryczna rozmowa.',
      createdAt: '2026-01-07T11:15:00.000Z',
      verifiedVisit: true
    }
  ],
  'loft-beauty-powisle': [
    {
      id: 'lbp-1',
      author: 'Julia S.',
      rating: 5,
      serviceName: 'Rytuał SPA Powiśle',
      body: 'Miejsce jest bardzo dopracowane, a rytuał trwał dokładnie tyle, ile zapowiadano. Dobre tempo i wysoka kultura obsługi.',
      createdAt: '2026-05-02T16:20:00.000Z',
      verifiedVisit: true
    },
    {
      id: 'lbp-2',
      author: 'Ewa G.',
      rating: 4,
      serviceName: 'Masaż relaksacyjny 50 min',
      body: 'Bardzo dobry masaż i przyjemna strefa wejścia. Przydałaby się tylko odrobinę cichsza muzyka w końcówce zabiegu.',
      createdAt: '2026-04-04T13:45:00.000Z',
      verifiedVisit: true
    },
    {
      id: 'lbp-3',
      author: 'Marta C.',
      rating: 3,
      serviceName: 'Manicure japoński',
      body: 'Efekt był estetyczny, ale sam proces trwał dłużej niż zakładałam. Wrócę raczej na zabiegi spa niż szybkie wizyty manicure.',
      createdAt: '2026-03-09T08:40:00.000Z',
      verifiedVisit: true,
      sellerReply:
        'Dziękujemy za szczerą opinię. Zespół sprawdził już harmonogram dla krótszych usług, żeby skrócić czas oczekiwania.'
    }
  ],
  'belle-praga': [
    {
      id: 'bp-1',
      author: 'Ola M.',
      rating: 5,
      serviceName: 'Laminacja brwi z henną',
      body: 'Precyzyjna stylizacja i bardzo naturalny efekt. Dostałam też konkretne wskazówki, jak utrzymać kształt między wizytami.',
      createdAt: '2026-04-30T10:00:00.000Z',
      verifiedVisit: true
    },
    {
      id: 'bp-2',
      author: 'Patrycja W.',
      rating: 4,
      serviceName: 'Glow facial express',
      body: 'Dobry zabieg przed wydarzeniem, skóra wyglądała świeżo jeszcze kolejnego dnia. Gabinet jest niewielki, ale zadbany.',
      createdAt: '2026-03-21T17:30:00.000Z',
      verifiedVisit: true
    }
  ],
  'ogrod-zmyslow': [
    {
      id: 'oz-1',
      author: 'Joanna L.',
      rating: 5,
      serviceName: 'Rytuał gorących kamieni',
      body: 'To była jedna z tych wizyt, po których naprawdę schodzi napięcie z barków. Personel prowadzi spokojnie od wejścia do wyjścia.',
      createdAt: '2026-05-10T15:50:00.000Z',
      verifiedVisit: true
    },
    {
      id: 'oz-2',
      author: 'Karolina Z.',
      rating: 5,
      serviceName: 'Pakiet city spa 90 min',
      body: 'Najbardziej przekonała mnie prywatność i brak pośpiechu. To dobre miejsce na dłuższy rytuał, a nie tylko szybki zabieg.',
      createdAt: '2026-04-18T12:05:00.000Z',
      verifiedVisit: true,
      sellerReply:
        'Bardzo dziękujemy. Zależy nam, żeby każda wizyta miała spokojny rytm od pierwszej minuty.'
    }
  ],
  'salon-estetyka': []
};

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5
    ? Math.round(value)
    : null;
}

function buildAuthorName(review: RawSellerReview) {
  const firstName = normalizeString(review.customer?.first_name);
  const lastName = normalizeString(review.customer?.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || 'BonBeauty';
}

function buildReviewFromRaw(
  review: RawSellerReview,
  index: number,
  offers: SellerReviewOffer[]
): SellerReviewItem | null {
  const body = normalizeString(review.customer_note);
  const createdAt = normalizeString(review.created_at);
  const rating = normalizeRating(review.rating);

  if (!body || !createdAt || rating == null) {
    return null;
  }

  return {
    id: normalizeString(review.id) ?? `seller-review-${index + 1}`,
    author: buildAuthorName(review),
    rating,
    serviceName:
      offers[index % Math.max(offers.length, 1)]?.title ??
      FALLBACK_SERVICE_NAMES[index % FALLBACK_SERVICE_NAMES.length],
    body,
    createdAt,
    verifiedVisit: true,
    sellerReply: normalizeString(review.seller_note)
  };
}

function buildReviewFixture(review: SellerReviewFixture): SellerReviewItem {
  return {
    id: review.id,
    author: review.author,
    rating: review.rating,
    serviceName: review.serviceName,
    body: review.body,
    createdAt: review.createdAt,
    verifiedVisit: review.verifiedVisit,
    sellerReply: review.sellerReply ?? null
  };
}

function sortReviews(items: SellerReviewItem[], sort: SellerReviewSortKey): SellerReviewItem[] {
  return [...items].sort((left, right) => {
    if (sort === 'highest') {
      if (right.rating !== left.rating) return right.rating - left.rating;
    }

    if (sort === 'lowest') {
      if (left.rating !== right.rating) return left.rating - right.rating;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function buildReviewBreakdown(items: SellerReviewItem[]): SellerReviewBreakdownRow[] {
  const total = items.length;

  return [5, 4, 3, 2, 1].map(rating => {
    const count = items.filter(item => item.rating === rating).length;

    return {
      rating,
      count,
      share: total === 0 ? 0 : count / total
    };
  });
}

function paginateReviews(items: SellerReviewItem[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    visibleReviews: items.slice(offset, offset + pageSize),
    page: safePage,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1
  };
}

function mapSellerForReviewsSurface(seller: SellerProps): SellerReviewsSeller {
  return {
    handle: seller.handle,
    name: seller.name,
    displayName: seller.name,
    imageUrl: seller.photo || null,
    city: seller.city ?? null,
    district: seller.district ?? null,
    offers: (seller.products ?? []).map(product => ({ title: product.title }))
  };
}

function loadReviewSource(handle: string, sourceSeller: SellerProps, seller: SellerReviewsSeller) {
  if (Array.isArray(sourceSeller?.reviews)) {
    return (sourceSeller.reviews as RawSellerReview[])
      .map((review, index) => buildReviewFromRaw(review, index, seller.offers))
      .filter((review): review is SellerReviewItem => review !== null);
  }

  return (SELLER_REVIEW_FIXTURES[handle] ?? []).map(buildReviewFixture);
}

export async function getSellerReviewsSurfaceData({
  handle,
  locale,
  countryCode,
  currencyCode,
  sort = 'newest',
  rating,
  page = 1,
  pageSize = 6
}: {
  handle: string;
  locale: string;
  countryCode: string;
  currencyCode: string;
  sort?: SellerReviewSortKey;
  rating?: number | null;
  page?: number;
  pageSize?: number;
}): Promise<SellerReviewsSurfaceData | null> {
  void locale;
  void countryCode;
  void currencyCode;

  const sourceSeller = await getSellerByHandle(handle);

  if (!sourceSeller) {
    return null;
  }

  const seller = mapSellerForReviewsSurface(sourceSeller);
  const reviews = loadReviewSource(handle, sourceSeller, seller);
  const filteredReviews =
    rating && rating >= 1 && rating <= 5
      ? reviews.filter(review => review.rating === rating)
      : reviews;
  const sortedReviews = sortReviews(filteredReviews, sort);
  const {
    visibleReviews,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    page: safePage
  } = paginateReviews(sortedReviews, page, pageSize);

  return {
    seller,
    reviews,
    totalReviews: reviews.length,
    visibleReviews,
    averageRating:
      reviews.length > 0
        ? Number(
            (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
          )
        : null,
    breakdown: buildReviewBreakdown(reviews),
    activeRating: rating && rating >= 1 && rating <= 5 ? rating : null,
    sort,
    page: safePage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPreviousPage
  };
}

export function getSellerReviewsFixtureHandles() {
  return Object.keys(SELLER_REVIEW_FIXTURES);
}
