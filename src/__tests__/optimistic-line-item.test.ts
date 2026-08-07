import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  OPTIMISTIC_LINE_ITEM_ID_PREFIX,
  buildOptimisticLineItemId,
} from '@/lib/helpers/optimistic-line-item';
import type { StoreCartLineItemOptimisticUpdate } from '@/types/cart';

describe('buildOptimisticLineItemId', () => {
  it('jest deterministyczne — ta sama tożsamość między renderami', () => {
    expect(buildOptimisticLineItemId('variant_01')).toBe(
      buildOptimisticLineItemId('variant_01')
    );
  });

  it('daje rozłączne id dla różnych wariantów (brak kolizji kluczy React)', () => {
    const ids = ['variant_01', 'variant_02', 'variant_03'].map(buildOptimisticLineItemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nigdy nie produkuje samego prefiksu — pusty variantId jest błędem', () => {
    expect(buildOptimisticLineItemId('variant_01').length).toBeGreaterThan(
      OPTIMISTIC_LINE_ITEM_ID_PREFIX.length
    );
    // Bez tego rzutu każda pozycja z pustym variantId dostałaby id
    // `optimistic-` → duplikaty kluczy React.
    expect(() => buildOptimisticLineItemId('')).toThrow();
    expect(() => buildOptimisticLineItemId('   ')).toThrow();
  });

  it('nie koliduje z prawdziwym line item id z Medusy', () => {
    expect('item_01JABCDEF'.startsWith(OPTIMISTIC_LINE_ITEM_ID_PREFIX)).toBe(false);
    expect(buildOptimisticLineItemId('variant_01')).not.toBe('item_01JABCDEF');
  });

  it('prefiks nie wymaga escapowania w selektorach CSS (trafia do data-testid)', () => {
    // `data-testid="mini-cart-item-<id>"` bywa celem selektorów Playwrighta —
    // dwukropek/kropka/spacja zmusiłyby do escapowania.
    expect(OPTIMISTIC_LINE_ITEM_ID_PREFIX).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('jedyne miejsce budowy pozycji optymistycznej faktycznie woła builder', () => {
  // TO JEST bramka na realnie uruchamianej ścieżce (`pnpm test`).
  // Asercja typu poniżej NIE jest bramką automatyczną: next.config.ts ma
  // `typescript.ignoreBuildErrors: true`, w package.json nie ma skryptu
  // `typecheck`, a _grow/gate-registry.yaml nie rejestruje bramki `tsc`.
  // Bez tego testu usunięcie `id:` z ProductDetailsHeader przechodzi na zielono.
  const PDP_SOURCE = readFileSync(
    resolve(__dirname, '../components/cells/ProductDetailsHeader/ProductDetailsHeader.tsx'),
    'utf8'
  );

  it('ProductDetailsHeader importuje buildOptimisticLineItemId', () => {
    expect(PDP_SOURCE).toMatch(
      /import\s*\{\s*buildOptimisticLineItemId\s*\}\s*from\s*'@\/lib\/helpers\/optimistic-line-item'/
    );
  });

  it('literał storeCartLineItem nadaje id przez builder', () => {
    expect(PDP_SOURCE).toMatch(/id:\s*buildOptimisticLineItemId\(\s*variantId\s*\)/);
  });

  it('nie obchodzi kontraktu rzutowaniem as StoreCartLineItemOptimisticUpdate', () => {
    expect(PDP_SOURCE).not.toMatch(/as\s+StoreCartLineItemOptimisticUpdate/);
  });
});

describe('kontrakt typu StoreCartLineItemOptimisticUpdate', () => {
  it('wymaga id — asercja kompilacyjna, nie runtime', () => {
    // Dodatkowa (NIE jedyna) siatka: łapie rozluźnienie `id` dopiero przy
    // ręcznym `pnpm exec tsc --noEmit` — patrz komentarz w bloku powyżej.
    // @ts-expect-error — pozycja optymistyczna bez `id` musi być błędem typu
    const withoutId: StoreCartLineItemOptimisticUpdate = {
      variant_id: 'variant_01',
      quantity: 1,
      subtotal: 1000,
      total: 1230,
      tax_total: 230,
    };

    const withId: StoreCartLineItemOptimisticUpdate = {
      id: buildOptimisticLineItemId('variant_01'),
      variant_id: 'variant_01',
      quantity: 1,
      subtotal: 1000,
      total: 1230,
      tax_total: 230,
    };

    expect(withoutId.variant_id).toBe('variant_01');
    expect(withId.id).toBe('optimistic-variant_01');
  });
});
