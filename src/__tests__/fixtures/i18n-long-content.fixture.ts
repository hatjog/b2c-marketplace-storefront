export const longContentFixture = {
  voucher:
    'Voucher BonBeauty na kompleksowy rytuał odnowy skóry twarzy, szyi i dekoltu z konsultacją kosmetologiczną oraz zaleceniami pozabiegowymi',
  service_name:
    'Personalizowany zabieg regenerująco-rozświetlający z masażem transbukalnym, maską algową i terapią światłem LED',
  salon_name:
    'BonBeauty Atelier Kosmetologii Zaawansowanej i Holistycznych Rytuałów Pielęgnacyjnych Warszawa Powiśle',
  price: '199 999,99 zł / miesiąc',
  date: 'poniedziałek, 29 września 2026, godzina 18:45',
  validation_message:
    'Wpisana wartość jest za długa albo zawiera znaki, których nie możemy bezpiecznie zapisać. Skróć tekst i spróbuj ponownie.',
  welcome_heading:
    'Witaj Aleksandro-Konstancjo',
  legal_title:
    'Szczegółowe zasady realizacji, odstąpienia od umowy i kontaktu z pomocą BonBeauty',
} as const;

export type LongContentFixtureKey = keyof typeof longContentFixture;
