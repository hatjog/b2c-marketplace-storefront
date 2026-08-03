export type SellerDirectoryFixture = {
  handle: string;
  name: string;
  marketId: string;
  district: string | null;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  geo: {
    latitude: number;
    longitude: number;
  };
  categories: string[];
  yearsActive: number;
  treatmentsCount: number;
  ratingAverage: number;
  ratingCount: number;
  legal: {
    nip: string;
    regon: string;
    krs?: string | null;
  };
  openingHours: string[];
  openingHoursDisplay: Array<{ day: string; hours: string }>;
  about: string;
  policy: string;
  offers: Array<{
    title: string;
    slug: string;
    priceMinor: number;
  }>;
};

export const SELLER_DIRECTORY_FIXTURES: Record<string, SellerDirectoryFixture> = {
  'apteczna-pracownia-kasi': {
    handle: 'apteczna-pracownia-kasi',
    name: 'Apteczna Pracownia Kasi',
    marketId: 'bonbeauty',
    district: 'Praga-Południe',
    street: 'ul. Stalowa 33 lok. 5',
    city: 'Warszawa',
    postalCode: '03-426',
    country: 'PL',
    phone: '+48 22 818 25 49',
    geo: { latitude: 52.2556, longitude: 21.0508 },
    categories: ['Pielęgnacja twarzy', 'Kwasy', 'Konsultacje'],
    yearsActive: 5,
    treatmentsCount: 342,
    ratingAverage: 4.9,
    ratingCount: 124,
    legal: {
      nip: '5252876543',
      regon: '147258369',
      krs: '0000987654'
    },
    openingHours: ['Mo-Fr 10:00-19:00', 'Sa 10:00-15:00'],
    openingHoursDisplay: [
      { day: 'Pon-Pt', hours: '10:00-19:00' },
      { day: 'Sob', hours: '10:00-15:00' }
    ],
    about:
      'Salon skupia sie na pielegnacji twarzy i kuracjach kwasowych, laczac konsultacje z planem zabiegowym dopasowanym do wrazliwej skory.',
    policy:
      'Regulamin salonu: odwolanie wizyty bez kosztu do 24 godzin przed terminem. Spowodnij brak mozliwosci realizacji vouchera kontaktujac sie telefonicznie z salonem.',
    offers: [
      {
        title: 'Kwas migdalowy z konsultacja',
        slug: 'kwas-migdalowy-z-konsultacja',
        priceMinor: 22000
      },
      { title: 'Kuracja anti-redness', slug: 'kuracja-anti-redness', priceMinor: 26000 },
      { title: 'Plan pielegnacyjny 60 min', slug: 'plan-pielegnacyjny-60-min', priceMinor: 18000 }
    ]
  },
  'loft-beauty-powisle': {
    handle: 'loft-beauty-powisle',
    name: 'Loft Beauty Powiśle',
    marketId: 'bonbeauty',
    district: 'Powiśle',
    street: 'ul. Solec 18',
    city: 'Warszawa',
    postalCode: '00-410',
    country: 'PL',
    phone: '+48 22 411 18 18',
    geo: { latitude: 52.2332, longitude: 21.0402 },
    categories: ['Masaż', 'Manicure', 'SPA'],
    yearsActive: 8,
    treatmentsCount: 1240,
    ratingAverage: 4.7,
    ratingCount: 212,
    legal: {
      nip: '5253011122',
      regon: '365214789',
      krs: null
    },
    openingHours: ['Mo-Fr 09:00-20:00', 'Sa 09:00-16:00'],
    openingHoursDisplay: [
      { day: 'Pon-Pt', hours: '09:00-20:00' },
      { day: 'Sob', hours: '09:00-16:00' }
    ],
    about:
      'Loft Beauty Powiśle laczy manicure, masaze i strefe spa w spokojnym, loftowym wnętrzu przygotowanym pod szybkie wizyty po pracy i dluzsze rytualy weekendowe.',
    policy:
      'Regulamin salonu: prosimy o przyjscie 10 minut przed wizyta. Zmiana terminu do 12 godzin przed rozpoczeciem uslugi.',
    offers: [
      { title: 'Rytual SPA Powiśle', slug: 'rytual-spa-powisle', priceMinor: 32000 },
      { title: 'Manicure japonski', slug: 'manicure-japonski', priceMinor: 15000 },
      { title: 'Masaz relaksacyjny 50 min', slug: 'masaz-relaksacyjny-50-min', priceMinor: 24000 }
    ]
  },
  'belle-praga': {
    handle: 'belle-praga',
    name: 'Belle Praga',
    marketId: 'bonbeauty',
    district: 'Praga-Północ',
    street: 'ul. Targowa 15',
    city: 'Warszawa',
    postalCode: '03-728',
    country: 'PL',
    phone: '+48 22 440 15 15',
    geo: { latitude: 52.2527, longitude: 21.0378 },
    categories: ['Pielęgnacja twarzy', 'Brwi i rzęsy'],
    yearsActive: 3,
    treatmentsCount: 480,
    ratingAverage: 4.8,
    ratingCount: 96,
    legal: {
      nip: '1132987744',
      regon: '523456781',
      krs: null
    },
    openingHours: ['Mo-Fr 11:00-20:00', 'Sa 10:00-14:00'],
    openingHoursDisplay: [
      { day: 'Pon-Pt', hours: '11:00-20:00' },
      { day: 'Sob', hours: '10:00-14:00' }
    ],
    about:
      'Belle Praga specjalizuje sie w oprawie oka oraz szybkich zabiegach odswiezajacych dla klientek z Pragi i Śródmieścia.',
    policy:
      'Regulamin salonu: w dniu wizyty prosimy o rezygnacje z makijazu oka. Nieodwolana wizyta moze skutkowac utrata zadatku.',
    offers: [
      { title: 'Laminacja brwi z henna', slug: 'laminacja-brwi-z-henna', priceMinor: 14000 },
      { title: 'Glow facial express', slug: 'glow-facial-express', priceMinor: 17000 }
    ]
  },
  'ogrod-zmyslow': {
    handle: 'ogrod-zmyslow',
    name: 'Ogród Zmysłów',
    marketId: 'bonbeauty',
    district: 'Mokotów',
    street: 'ul. Madalińskiego 71',
    city: 'Warszawa',
    postalCode: '02-544',
    country: 'PL',
    phone: '+48 22 552 71 71',
    geo: { latitude: 52.1963, longitude: 21.0222 },
    categories: ['SPA', 'Masaż', 'Rytuały ciała'],
    yearsActive: 6,
    treatmentsCount: 920,
    ratingAverage: 4.9,
    ratingCount: 54,
    legal: {
      nip: '5213456678',
      regon: '147951753',
      krs: '0000876543'
    },
    openingHours: ['Mo-Fr 10:00-21:00', 'Sa-Su 10:00-18:00'],
    openingHoursDisplay: [
      { day: 'Pon-Pt', hours: '10:00-21:00' },
      { day: 'Sob-Nd', hours: '10:00-18:00' }
    ],
    about:
      'Ogród Zmysłów oferuje rytualy ciala i masaze w formule spokojnego city spa z naciskiem na prywatnosc i dluższy pobyt.',
    policy:
      'Regulamin salonu: prosimy o przyjscie 15 minut przed zabiegiem. Pakiety spa wymagaja potwierdzenia telefonicznego w dniu poprzedzajacym wizyte.',
    offers: [
      { title: 'Rytuał gorących kamieni', slug: 'rytual-goracych-kamieni', priceMinor: 29000 },
      { title: 'Pakiet city spa 90 min', slug: 'pakiet-city-spa-90-min', priceMinor: 39000 }
    ]
  },
  'salon-estetyka': {
    handle: 'salon-estetyka',
    name: 'Salon Estetyka',
    marketId: 'bonbeauty',
    district: 'Wola',
    street: 'ul. Wolska 88',
    city: 'Warszawa',
    postalCode: '01-134',
    country: 'PL',
    phone: '+48 22 488 88 88',
    geo: { latitude: 52.2319, longitude: 20.9631 },
    categories: ['Manicure', 'Pedicure', 'Brwi'],
    yearsActive: 4,
    treatmentsCount: 612,
    ratingAverage: 4.6,
    ratingCount: 178,
    legal: {
      nip: '5272881123',
      regon: '146852741',
      krs: null
    },
    openingHours: ['Mo-Fr 09:00-19:00', 'Sa 09:00-14:00'],
    openingHoursDisplay: [
      { day: 'Pon-Pt', hours: '09:00-19:00' },
      { day: 'Sob', hours: '09:00-14:00' }
    ],
    about:
      'Salon Estetyka prowadzi szybkie uslugi manicure i brow bar dla klientek, ktore chca zalatwic pielegnacje w jednym miejscu i bez zbędnego oczekiwania.',
    policy:
      'Regulamin salonu: opoznienie powyzej 15 minut moze skrocic usluge. Voucher mozna przepisac na inna osobe po kontakcie z recepcja.',
    offers: [
      { title: 'Manicure klasyczny', slug: 'manicure-klasyczny', priceMinor: 11000 },
      { title: 'Pedicure express', slug: 'pedicure-express', priceMinor: 15000 },
      { title: 'Stylizacja brwi', slug: 'stylizacja-brwi', priceMinor: 9000 }
    ]
  }
};