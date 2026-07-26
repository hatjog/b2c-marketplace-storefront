import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { CONTENT_GATE_SCHEMA_KEYS, type ContentGateSchemaKey } from '@/lib/content-gate';
import type { MarketContentGateRuntimeBlock } from '@/lib/runtime-market-config';

/**
 * Story 1.4 v1.14.0 AC3 — parity allowed-keys == schema properties dla bloku
 * `content_gate` w `market-runtime-config.v1.schema.json`.
 *
 * Trzy strony nie mogą się rozjechać: typ TS (`MarketContentGateRuntimeBlock`),
 * schemat JSON i walidator Pythona (`validate_gp_runtime_config.py` waliduje
 * `market.yaml` przeciw TEMU SAMEMU schematowi, więc jest wiązany przez niego,
 * a nie przez własną listę kluczy).
 *
 * Wzorzec skopiowany z `market-locales-schema-parity.test.ts`.
 */

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../specs/contracts/config/schemas/market-runtime-config.v1.schema.json'
);

const schemaAvailable = fs.existsSync(SCHEMA_PATH);

// Compile-time parity: każdy klucz schematu istnieje na typie runtime…
const _schemaKeysCoveredByType: readonly (keyof MarketContentGateRuntimeBlock)[] =
  CONTENT_GATE_SCHEMA_KEYS;
void _schemaKeysCoveredByType;
// …i typ runtime nie deklaruje klucza spoza listy schematu.
type ExtraTypeKeys = Exclude<keyof MarketContentGateRuntimeBlock, ContentGateSchemaKey>;
const _noExtraTypeKeys: ExtraTypeKeys extends never ? true : never = true;
void _noExtraTypeKeys;

describe.skipIf(!schemaAvailable)('market-runtime-config.v1 content_gate schema parity (AC3)', () => {
  const schema = schemaAvailable ? JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) : null;
  const contentGateSchema = schema?.properties?.content_gate;

  it('blok `content_gate` istnieje w schemacie i jest opcjonalny', () => {
    expect(contentGateSchema).toBeDefined();
    expect(schema.required).not.toContain('content_gate');
  });

  it('schema property keys == CONTENT_GATE_SCHEMA_KEYS (allowed-keys parity)', () => {
    expect(Object.keys(contentGateSchema.properties).sort()).toEqual(
      [...CONTENT_GATE_SCHEMA_KEYS].sort()
    );
  });

  it('enum locale == SUPPORTED_LOCALES (D-55 / ADR-150-4)', () => {
    expect(contentGateSchema.properties.phase_2_locales.items.enum).toEqual([...SUPPORTED_LOCALES]);
  });

  it('kontrakt zamknięty: additionalProperties false, uniqueItems', () => {
    expect(contentGateSchema.additionalProperties).toBe(false);
    expect(contentGateSchema.properties.phase_2_locales.uniqueItems).toBe(true);
  });

  it('x-schema-version zbumpowany do 1.9 (additive minor)', () => {
    expect(schema['x-schema-version']).toBe('1.9');
  });
});
