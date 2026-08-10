import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

/**
 * Story 3.1 (v1.15.0), AC1/AC3 — adresy DOCELOWE w `next.config.ts` musza isc za
 * nosnikiem, a nie byc wpisane literalnie.
 *
 * Dlaczego ten test istnieje: do 2026-08-10 allowlista `next/image` miala literalny
 * `hostname: 'localhost'` pod komentarzem nazywajacym ja „env-driven origin". Po
 * podniesieniu stacka pod adresem LAN (`GP_STOREFRONT_BASE_HOST` — dokladnie ta
 * konfiguracja, ktorej wymaga sesja bramkowa Epiku 6 na telefonie) `next/image`
 * odrzucal KAZDY obraz z backendu i portalu, a `/pl` zwracalo HTTP 500.
 *
 * Inwentaryzacja AC2 opisuje te wpisy jako „sparametryzowane". Test mierzy, ze
 * naprawde sa — opis bez pomiaru jest tym samym, czym byl tamten komentarz.
 */

const source = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');

const ENV_KEYS = [
  'MEDUSA_BACKEND_URL',
  'NEXT_PUBLIC_MEDUSA_BACKEND_URL',
  'PAYLOAD_API_URL',
  'NEXT_PUBLIC_BASE_URL'
];

/** Wycina i wykonuje pojedynczy blok `const <name> = (() => { … })();` z configu. */
const evaluate = (name, env) => {
  const start = source.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `blok ${name} zniknal z next.config.ts`);
  const end = source.indexOf('})();', start) + '})();'.length;
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;

  const saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, env);
  try {
    // eslint-disable-next-line no-eval
    return eval(`${js}; ${name}`);
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
};

test('allowlista next/image bez zmiennych zachowuje sie jak przed parametryzacja', () => {
  assert.deepEqual(evaluate('localBackendImageOrigins', {}), [
    { protocol: 'http', hostname: 'localhost' }
  ]);
});

test('allowlista next/image podaza za adresem LAN i NIE gubi localhosta', () => {
  const origins = evaluate('localBackendImageOrigins', {
    MEDUSA_BACKEND_URL: 'http://192.168.100.89:9002',
    PAYLOAD_API_URL: 'http://192.168.100.89:9003'
  });
  const hostnames = origins.map(entry => entry.hostname);
  // Kontrola dodatnia: bez tego wpisu `/pl` zwraca 500 na kazdej stronie z obrazem.
  assert.ok(hostnames.includes('192.168.100.89'), 'brak hosta LAN w allowliscie');
  // Kontrola przeciw ZAWEZENIU (ta sama klasa co LOW-8 dla CORS): wlaczenie LAN nie
  // moze usunac originu, ktory dzialal wczesniej.
  assert.ok(hostnames.includes('localhost'), 'localhost zniknal po wlaczeniu LAN');
});

test('allowlista next/image nie poszerza sie o wartosc nie-URL ani o wildcard', () => {
  assert.deepEqual(evaluate('localBackendImageOrigins', { MEDUSA_BACKEND_URL: 'nie-jest-urlem' }), [
    { protocol: 'http', hostname: 'localhost' }
  ]);
  // Zwezenie ze Story 2.5 / ADR-179: zaden wpis nie moze byc wildcardem.
  const origins = evaluate('localBackendImageOrigins', {
    MEDUSA_BACKEND_URL: 'http://192.168.100.89:9002'
  });
  for (const entry of origins) {
    assert.ok(!entry.hostname.includes('*'), `wildcard w allowliscie: ${entry.hostname}`);
  }
});

test('redirect gp-dashboard podaza za nosnikiem, a bez zmiennych zostaje na localhost', () => {
  assert.equal(evaluate('gpDashboardOrigin', {}), 'http://localhost:3000');
  assert.equal(
    evaluate('gpDashboardOrigin', { NEXT_PUBLIC_BASE_URL: 'http://192.168.100.89:3002' }),
    'http://192.168.100.89:3000'
  );
  assert.equal(evaluate('gpDashboardOrigin', { NEXT_PUBLIC_BASE_URL: 'nie-url' }), 'http://localhost:3000');
});

test('w next.config.ts nie ma juz literalnego hosta docelowego poza fallbackami nosnika', () => {
  const offenders = source
    .split('\n')
    .map((line, index) => [index + 1, line.replace(/\r$/, '')])
    .filter(([, line]) => /localhost/.test(line))
    .filter(([, line]) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
    .filter(([, line]) => !/return 'http:\/\/localhost:3000';/.test(line))
    .filter(([, line]) => !/^\s*'http:\/\/localhost'$/.test(line));
  assert.deepEqual(offenders, [], `literalny adres docelowy w next.config.ts: ${JSON.stringify(offenders)}`);
});
