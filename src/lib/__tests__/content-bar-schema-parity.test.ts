import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/i18n/routing';
import { readContentBarFlag, type ContentBarMeasurement } from '@/lib/helpers/metadata-utils';

/**
 * Story 1.4 v1.14.0 AC1 — drift-test kształtu po stronie KONSUMENTA.
 *
 * Storefront i backend czytają/piszą ten sam kształt
 * `metadata.gp.content_bar`, ale mieszkają w dwóch submodułach, więc jedynym
 * wspólnym punktem jest JSON-schema w `specs/contracts/`. Ten test wiąże
 * konsumenta ze schematem; producenta wiąże
 * `GP/backend/packages/api/src/scripts/__tests__/content-bar-schema-contract.unit.spec.ts`.
 *
 * Wzorzec (skip-if-schema-unavailable) skopiowany z
 * `market-locales-schema-parity.test.ts`: w standalone checkoucie storefrontu
 * schematu nie ma, więc suite się pomija — parity jest wtedy nadal
 * egzekwowane monorepo-side po stronie backendu.
 */

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../specs/contracts/config/schemas/content-bar.v1.schema.json'
);

const schemaAvailable = fs.existsSync(SCHEMA_PATH);

// Compile-time parity: typ pomiaru w storefroncie ma dokładnie pola `words`+`bar`.
type MeasurementKey = keyof ContentBarMeasurement;
const _measurementKeys: readonly MeasurementKey[] = ['words', 'bar'] as const;
type ExtraMeasurementKeys = Exclude<MeasurementKey, 'words' | 'bar'>;
const _noExtraMeasurementKeys: ExtraMeasurementKeys extends never ? true : never = true;
void _measurementKeys;
void _noExtraMeasurementKeys;

describe.skipIf(!schemaAvailable)('content-bar.v1 schema parity (AC1, konsument)', () => {
  const schema = schemaAvailable ? JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) : null;

  it('klucze schematu == SUPPORTED_LOCALES (slugi routingu, NIE BCP 47)', () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    // Slug, nie kod BCP 47 — `uk-UA` po stronie gp-ops mapuje się na `ua`.
    expect(Object.keys(schema.properties)).not.toContain('uk-UA');
  });

  it('kształt pomiaru: wymagane `words` (int >= 0) i `bar` (bool), zamknięty', () => {
    const measurement = schema.$defs.measurement;
    expect([...measurement.required].sort()).toEqual(['bar', 'words']);
    expect(Object.keys(measurement.properties).sort()).toEqual(['bar', 'words']);
    expect(measurement.properties.words).toMatchObject({ type: 'integer', minimum: 0 });
    expect(measurement.properties.bar).toMatchObject({ type: 'boolean' });
    expect(measurement.additionalProperties).toBe(false);
  });

  it('additionalProperties: false na obu poziomach', () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.$defs.measurement.additionalProperties).toBe(false);
  });

  it('schemat opisuje KSZTAŁT, nie progi — żadnego 80/40 (AD-4)', () => {
    const serialized = JSON.stringify(schema.properties) + JSON.stringify(schema.$defs);
    expect(serialized).not.toMatch(/\b(80|40)\b/);
  });

  it('konsument akceptuje dokładnie to, co schemat dopuszcza', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const metadata = { gp: { content_bar: { [locale]: { words: 120, bar: true } } } };
      expect(readContentBarFlag(metadata, locale)).toBe(true);
    }
  });

  it('x-key-semantics: brak wpisu dla sluga == brak mapy (ścieżka legacy EE-1), NIE `bar: false`', () => {
    // Review 1-4-F4: zdanie z kontraktu ma być testowane, nie tylko napisane.
    // Mapa istnieje, ale nie ma wpisu dla żądanego sluga ⇒ `undefined` (legacy),
    // czyli to samo co brak całej mapy — a NIE odrzucenie jak przy `bar: false`.
    const partialMap = { gp: { content_bar: { pl: { words: 120, bar: true } } } };
    expect(readContentBarFlag(partialMap, 'ua')).toBeUndefined();
    expect(readContentBarFlag({ gp: {} }, 'ua')).toBeUndefined();
    expect(readContentBarFlag({ gp: { content_bar: { ua: { words: 5, bar: false } } } }, 'ua')).toBe(false);

    const semantics: string = schema['x-key-semantics'] ?? '';
    expect(semantics).toContain('nieodróżnialny od braku mapy');
    expect(semantics).not.toContain('to samo co `bar: false`');
  });
});
