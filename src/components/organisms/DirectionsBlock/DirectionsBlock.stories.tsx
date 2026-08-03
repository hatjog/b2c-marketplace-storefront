import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import { DirectionsBlock } from './DirectionsBlock';

/**
 * Story v160-4-5 — DirectionsBlock organism Storybook fixtures (T8, AC1).
 *
 * 2 stories per AC1:
 *  - WithCoords    → full state: address + mini map + 2 deeplink buttons.
 *  - WithoutCoords → fallback state: address + "no coords" notice + search-query deeplinks.
 *
 * NOTE: stories import the inner non-dynamic `DirectionsBlock` z
 * `./DirectionsBlock` directly (NIE z barrel) bo Storybook canvas is already
 * client-only — no SSR concern. Real app page consumes the `dynamic` wrapper
 * via barrel `index.ts`.
 */

const messages = {
  seller: {
    detail: {
      directions_title: 'Jak dojechać',
      directions_open_google: 'Otwórz w Google Maps',
      directions_open_apple: 'Otwórz w Apple Maps',
      directions_no_coords:
        'Współrzędne salonu nie są dostępne — kliknij przycisk poniżej, aby wyszukać adres w mapach.',
      directions_external_notice: 'Otwierając mapy zewnętrzne, opuszczasz BonBeauty.'
    },
    list: {
      map: {
        aria_map: 'Mapa salonu',
        aria_marker: '{name}',
        popup_address: 'Adres niedostępny',
        popup_view_details: 'Zobacz szczegóły'
      }
    }
  }
};

const meta: Meta<typeof DirectionsBlock> = {
  title: 'Organisms/DirectionsBlock',
  component: DirectionsBlock,
  parameters: {
    layout: 'padded'
  },
  decorators: [
    Story => (
      <NextIntlClientProvider locale="pl" messages={messages}>
        <div className="max-w-2xl">
          <Story />
        </div>
      </NextIntlClientProvider>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof DirectionsBlock>;

export const WithCoords: Story = {
  args: {
    seller: {
      name: 'Salon Test',
      handle: 'salon-test',
      address: 'ul. Marszałkowska 1, 00-001 Warszawa',
      lat: 52.2297,
      lng: 21.0122
    },
    locale: 'pl'
  }
};

export const WithoutCoords: Story = {
  args: {
    seller: {
      name: 'Salon Test',
      handle: 'salon-test',
      address: 'ul. Marszałkowska 1, 00-001 Warszawa',
      lat: null,
      lng: null
    },
    locale: 'pl'
  }
};
