import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/i18n/routing';
import {
  MARKET_LOCALES_SCHEMA_KEYS,
  type MarketLocalesSchemaKey
} from '@/lib/market-locales';
import type { MarketLocalesRuntimeBlock } from '@/lib/runtime-market-config';

/**
 * Story 1.1 v1.14.0 AC4 — drift-test parity (allowed-keys == schema properties):
 * the storefront `MarketRuntimeConfig.locales` type and the platform locale
 * superset are tested against THE SAME JSON-schema the Python validator uses
 * (`specs/contracts/config/schemas/market-runtime-config.v1.schema.json`).
 * If either side drifts (keys or enum), this test fails.
 *
 * The schema lives in the GP monorepo two levels above the storefront
 * submodule — in a standalone storefront checkout the suite skips (the parity
 * is then still enforced monorepo-side by _grow/tools/test_validate_market_locales.py).
 */

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../specs/contracts/config/schemas/market-runtime-config.v1.schema.json'
);

const schemaAvailable = fs.existsSync(SCHEMA_PATH);

// Compile-time parity: every schema key exists on the runtime type…
const _schemaKeysCoveredByType: readonly (keyof MarketLocalesRuntimeBlock)[] =
  MARKET_LOCALES_SCHEMA_KEYS;
void _schemaKeysCoveredByType;
// …and the runtime type declares no key outside the schema key list.
type ExtraTypeKeys = Exclude<keyof MarketLocalesRuntimeBlock, MarketLocalesSchemaKey>;
const _noExtraTypeKeys: ExtraTypeKeys extends never ? true : never = true;
void _noExtraTypeKeys;

describe.skipIf(!schemaAvailable)('market-runtime-config.v1 locales schema parity (AC4)', () => {
  const schema = schemaAvailable
    ? JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'))
    : null;
  const localesSchema = schema?.properties?.locales;

  it('schema property keys == MARKET_LOCALES_SCHEMA_KEYS (allowed-keys parity)', () => {
    expect(Object.keys(localesSchema.properties).sort()).toEqual(
      [...MARKET_LOCALES_SCHEMA_KEYS].sort()
    );
  });

  it('schema locale enum == SUPPORTED_LOCALES platform superset (ADR-150-4)', () => {
    expect(localesSchema.properties.default.enum).toEqual([...SUPPORTED_LOCALES]);
    expect(localesSchema.properties.supported.items.enum).toEqual([...SUPPORTED_LOCALES]);
    expect(localesSchema.properties.fallback_chain.items.enum).toEqual([...SUPPORTED_LOCALES]);
  });

  it('schema keeps the contract the resolver enforces at runtime', () => {
    expect(localesSchema.additionalProperties).toBe(false);
    expect([...localesSchema.required].sort()).toEqual(['default', 'supported']);
  });
});
