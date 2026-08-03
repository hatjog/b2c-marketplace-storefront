import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { NextIntlClientProvider } from 'next-intl';

import type { VendorOfferOption } from '@/types/product';

import { NoActiveVendorsFallback } from './NoActiveVendorsFallback';
import { SellerSelector } from './SellerSelector';
import { SellerSelectorErrorBoundary } from './SellerSelectorErrorBoundary';
import { SellerSelectorFallback } from './SellerSelectorFallback';

/**
 * Story 5.2 — SellerSelector cell PDP multi-vendor picker.
 *
 * Variants per AC7:
 *  - SingleSeller       → 1 offer (component still renders; PDP-side
 *                         conditional gates on length > 1 — placed here
 *                         purely to demonstrate non-degenerate render)
 *  - ThreeSellersDefault → 3 offers; lowest-price pre-selected with badge
 *  - FiveSellers         → 5 offers; default = cheapest, distance metadata
 *  - WithDefaultOverride → 3 offers; defaultSelectedSellerId = non-cheapest
 *  - OnSelectActionLogged → emits onSelect callback into actions panel
 */

const messages = {
  seller: {
    selector: {
      title: 'Wybierz salon',
      choose_button: 'Wybierz',
      price_from: 'od',
      distance_km: 'ok. {distance} km',
      lowest_price_label: 'Najniższa cena',
      closest_label: 'Najbliższy',
      geolocation_pending: 'Pobieramy Twoją lokalizację...',
      geolocation_denied: 'Brak dostępu do lokalizacji — pokazujemy najtańszy salon',
      privacy_notice: 'Twoja lokalizacja używana lokalnie, nie wysyłamy',
      error_message: 'Nie udało się załadować ofert sprzedawców',
      retry_button: 'Spróbuj ponownie',
      fallback_notice:
        'Wybór sprzedawcy chwilowo niedostępny — pokazujemy domyślnego sprzedawcę',
      circuit_open_message:
        'Tymczasowo używamy domyślnego sprzedawcy. Odśwież stronę za chwilę by spróbować ponownie.',
      no_active_vendors_title: 'Salon przygotowuje ofertę',
      no_active_vendors_message:
        'Sprzedawcy aktualizują dostępność. Zajrzyj wkrótce lub powiadomimy Cię gdy oferta będzie dostępna.',
      back_to_list_cta: 'Powrót do listy',
      notify_me_cta: 'Powiadom mnie',
    },
  },
};

// Story 5.3 — buyer in Warsaw centre (Pałac Kultury i Nauki).
const WARSAW_CENTRE = { lat: 52.2297, lng: 21.0122 };

// Story 5.3 — three Warsaw sellers with realistic lat/lng around the centre.
// Distances from WARSAW_CENTRE (Haversine):
//   seller-1 Mokotów  (52.1936, 21.0354)  ≈ 4.3 km
//   seller-2 Wola     (52.2347, 20.9614)  ≈ 3.5 km
//   seller-3 Praga    (52.2519, 21.0506)  ≈ 4.0 km
//   seller-5 Centrum  (52.2298, 21.0118)  ≈ 0.03 km (closest, <0.1 km display)
const sellersWithCoords: VendorOfferOption[] = [
  {
    seller_id: 'seller-1',
    seller_name: 'Salon Mokotów',
    price_pln: 149,
    seller_lat: 52.1936,
    seller_lng: 21.0354,
  },
  {
    seller_id: 'seller-2',
    seller_name: 'Salon Wola',
    price_pln: 129,
    seller_lat: 52.2347,
    seller_lng: 20.9614,
  },
  {
    seller_id: 'seller-3',
    seller_name: 'Salon Praga',
    price_pln: 169,
    seller_lat: 52.2519,
    seller_lng: 21.0506,
  },
];

const singleSeller: VendorOfferOption[] = [
  { seller_id: 'seller-1', seller_name: 'Salon Mokotów', price_pln: 149 },
];

const threeSellers: VendorOfferOption[] = [
  { seller_id: 'seller-1', seller_name: 'Salon Mokotów', price_pln: 149, distance_km: 2.5 },
  { seller_id: 'seller-2', seller_name: 'Salon Wola', price_pln: 129, distance_km: 4.1 },
  { seller_id: 'seller-3', seller_name: 'Salon Praga', price_pln: 169, distance_km: 6.8 },
];

const fiveSellers: VendorOfferOption[] = [
  { seller_id: 'seller-1', seller_name: 'Salon Mokotów', price_pln: 149, distance_km: 2.5 },
  { seller_id: 'seller-2', seller_name: 'Salon Wola', price_pln: 129, distance_km: 4.1 },
  { seller_id: 'seller-3', seller_name: 'Salon Praga', price_pln: 169, distance_km: 6.8 },
  { seller_id: 'seller-4', seller_name: 'Salon Bemowo', price_pln: 139, distance_km: 9.2 },
  { seller_id: 'seller-5', seller_name: 'Salon Centrum', price_pln: 159, distance_km: 1.4 },
];

const meta: Meta<typeof SellerSelector> = {
  title: 'Cells/SellerSelector',
  component: SellerSelector,
  tags: ['autodocs'],
  args: {
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="pl" messages={messages}>
        <div style={{ maxWidth: 480 }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SellerSelector>;

export const SingleSeller: Story = {
  name: 'Single seller',
  args: {
    sellers: singleSeller,
  },
  parameters: {
    docs: {
      description: {
        story:
          'One offer only. PDP gates on `vendor_offers.length > 1` so this state is rare in production; rendered here to verify safety of degenerate input.',
      },
    },
  },
};

export const ThreeSellersDefault: Story = {
  name: 'Three sellers (lowest pre-selected)',
  args: {
    sellers: threeSellers,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default selection = cheapest offer (Salon Wola, 129 zł). "Najniższa cena" badge marks the cheapest row regardless of current selection.',
      },
    },
  },
};

export const FiveSellers: Story = {
  name: 'Five sellers',
  args: {
    sellers: fiveSellers,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Five offers including distance metadata. Verifies vertical radio list scales without dropdown collapse (UX-DR19 MVP threshold).',
      },
    },
  },
};

export const WithDefaultOverride: Story = {
  name: 'Default override (non-cheapest)',
  args: {
    sellers: threeSellers,
    defaultSelectedSellerId: 'seller-3',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Caller pins initial selection to a specific seller_id. Lowest-price badge still marks the cheapest row even though it is not selected.',
      },
    },
  },
};

export const OnSelectActionLogged: Story = {
  name: 'onSelect action (callback verify)',
  args: {
    sellers: threeSellers,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Click any row or its CTA to emit seller_id into the Storybook Actions panel.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Story 5.3 — geolocation-aware fixtures
// ---------------------------------------------------------------------------

export const WithGeolocationGranted: Story = {
  name: 'Geolocation granted (closest pre-selected)',
  args: {
    sellers: sellersWithCoords,
    userLat: WARSAW_CENTRE.lat,
    userLng: WARSAW_CENTRE.lng,
    geolocationStatus: 'granted',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Buyer at Warsaw centre. Sort = Haversine distance ASC → Salon Centrum (≈0.03 km) is pre-selected and shows "Najbliższy" badge. The cheapest row (Salon Wola, 129 zł) keeps its "Najniższa cena" badge — both markers coexist on different rows so the buyer can override.',
      },
    },
  },
};

export const WithGeolocationDenied: Story = {
  name: 'Geolocation denied (lowest-price fallback)',
  args: {
    sellers: sellersWithCoords,
    geolocationStatus: 'denied',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Buyer rejected the browser prompt. No `userLat`/`userLng` → fallback to lowest-price (Salon Wola). Distance lines hidden, "Najbliższy" badge absent, denied messaging shown.',
      },
    },
  },
};

export const WithGeolocationPending: Story = {
  name: 'Geolocation pending (privacy notice visible)',
  args: {
    sellers: sellersWithCoords,
    geolocationStatus: 'pending',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Browser prompt active. Selector pre-renders with lowest-price fallback so the buyer is never blocked; privacy notice ("location used locally, not transmitted") is visible while waiting for the user response.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Story 5.4 — circuit breaker + error boundary fixtures
// ---------------------------------------------------------------------------

/**
 * Normal_State — baseline reference re-using Story 5.3 geolocation-granted
 * fixture; circuit breaker would be `closed`, error boundary inactive.
 * Documented here so reviewers see the happy path next to the new
 * Error_State / Circuit_Open_Fallback variants.
 */
export const Normal_State: Story = {
  name: 'Normal state (baseline; closed circuit)',
  args: {
    sellers: sellersWithCoords,
    userLat: WARSAW_CENTRE.lat,
    userLng: WARSAW_CENTRE.lng,
    geolocationStatus: 'granted',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Story 5.4 baseline: circuit breaker `closed`, no errors. Re-uses geolocation-granted fixture — the Error Boundary wraps SellerSelector transparently, so happy-path output matches Story 5.3.',
      },
    },
  },
};

// Tiny child component that throws on render — used solely to drive the
// error boundary in the Error_State story. Storybook will log the expected
// React internal warning; not a regression.
const ThrowingChild = () => {
  throw new Error('Simulated SellerSelector render failure (Story 5.4 fixture)');
};

/**
 * Error_State — forces a render-time error inside the boundary subtree.
 * Verifies AC1: getDerivedStateFromError flips state, default fallback UI
 * with retry CTA renders, retry button clears the boundary state.
 */
export const Error_State: Story = {
  name: 'Error state (boundary catches; retry visible)',
  render: () => (
    <NextIntlClientProvider locale="pl" messages={messages}>
      <div style={{ maxWidth: 480 }}>
        <SellerSelectorErrorBoundary>
          <ThrowingChild />
        </SellerSelectorErrorBoundary>
      </div>
    </NextIntlClientProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Boundary catches a render error from a child component. Default fallback UI with `seller.selector.error_message` and `seller.selector.retry_button` is shown. Click retry to reset boundary state (here child still throws — re-clicking re-mounts the failure). Storybook logs an expected React internal console.error.',
      },
    },
  },
};

/**
 * Circuit_Open_Fallback — renders the fallback notice that
 * SellerSelectorWithGeolocation uses when `breaker.state === 'open'`.
 * The selector subtree is intentionally absent — the parent ProductDetails
 * already renders the default Medusa product variant flow.
 */
export const Circuit_Open_Fallback: Story = {
  name: 'Circuit open (fallback notice; default seller delegation)',
  render: () => (
    <NextIntlClientProvider locale="pl" messages={messages}>
      <div style={{ maxWidth: 480 }}>
        <SellerSelectorFallback />
      </div>
    </NextIntlClientProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'After 3 failures within a 10s rolling window, useCircuitBreaker transitions to `open` for a 60s cooldown. SellerSelectorWithGeolocation renders SellerSelectorFallback (single role="status" notice) instead of the radio list. Parent ProductDetails handles the default Medusa variant flow below.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Story 5.6 — no active vendors empty-state fixture
// ---------------------------------------------------------------------------

/**
 * NoActiveVendors — renders the empty-state card that ProductDetails uses
 * when `MULTI_VENDOR_PRICING_ENABLED && vendor_offers.length === 0`.
 * Orthogonal to Story 5.4 error path (Circuit_Open_Fallback above): 5.4 =
 * backend hiccup; 5.6 = lifecycle vendor onboarding in-progress (no offers
 * available yet). Persona Marta-self gets transparent "Salon przygotowuje
 * ofertę" message + Back-to-list CTA + disabled Notify-me placeholder
 * (Phase B+ feature territory).
 */
export const NoActiveVendors: StoryObj<typeof NoActiveVendorsFallback> = {
  name: 'No active vendors (empty-state; vendor onboarding in progress)',
  render: (args) => (
    <NextIntlClientProvider locale="pl" messages={messages}>
      <div style={{ maxWidth: 480 }}>
        <NoActiveVendorsFallback {...args} />
      </div>
    </NextIntlClientProvider>
  ),
  args: {
    backHref: '/categories',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `vendor_offers === []` (query SUCCESS, brak active offers) ProductDetails renders this empty-state card zamiast mylącego default Medusa single-variant flow. Notify-me CTA jest disabled placeholder w v1.6.0 (future Phase B+ email subscription pipeline).',
      },
    },
  },
};
