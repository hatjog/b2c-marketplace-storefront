/**
 * Bramka anty-nawrotowa dla `images.remotePatterns` — Story 2.5 (v1.15.0,
 * FR-14c, AI-3.3, ADR-178 / ADR-159 §6).
 *
 * ══ Co jest tu bronione ══
 * Do v1.15.0 ostatnim wpisem `remotePatterns` był `{protocol:'https',
 * hostname:'**'}`. `/_next/image` pobiera zdalny zasób SERWEROWO, cache'uje go
 * i serwuje Z NASZEGO ORIGINU — wildcard oznaczał więc naraz powierzchnię
 * SSRF-podobną, darmowy hosting treści pod naszą domeną i darmowy CDN dla
 * dowolnego podmiotu. Story 2.5 go usunęła.
 *
 * ══ Czego ten plik NIE dowodzi (świadomie) ══
 * Poprawna treść `next.config.ts` NIE jest dowodem, że optymalizator odrzuca
 * hosty — NFR-1 nazywa „zabezpieczenie istnieje, ale jest martwe" dominującą
 * klasą defektów tego repo. Dowód wykonawczy (400 z `/_next/image` na
 * prod-buildzie + kontrola dodatnia 200) leży w `e2e/next-image-allowlist.spec.ts`
 * i jest tam WYKONYWANY, nie odczytywany.
 *
 * Ten plik pilnuje warstwy, której e2e nie umie zobaczyć tanio i szybko:
 * czy ktoś nie przywrócił przepustki na cały internet — czy to wprost
 * (`'**'`, `'*'`, `'*.*'`, brak `hostname`), czy bokiem (`unoptimized`,
 * własny `loader`/`loaderFile`, legacy `images.domains`,
 * `dangerouslyAllowSVG`). Biegnie w `pnpm test` (`test:node:default`), więc
 * odpala się na każdym przebiegu, nie tylko przy żywym stacku.
 *
 * RED-FIRST: przywróć wpis `{protocol:'https', hostname:'**'}` w
 * `next.config.ts` — pierwszy test poniżej musi zaczerwienieć.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const STOREFRONT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_CONFIG = path.join(STOREFRONT_ROOT, 'next.config.ts');

/**
 * Tekstowy parser `images.remotePatterns` — świadomie NIE importuje
 * `next.config.ts`. Ten moduł ciągnie `@sentry/nextjs`, `next-intl/plugin`
 * i cztery pliki wiadomości; import tylko po to, żeby przeczytać tablicę
 * hostów, zamieniłby szybką bramkę w zależność od całego bundla.
 *
 * Ten sam kształt parsuje `_grow/tools/validate_products_catalog.py`
 * (`parse_next_image_allowlist`) — po obu stronach repo. Jeśli tablica kiedyś
 * przestanie być literałem inline (zostanie wyniesiona do stałej albo przejdzie
 * na `new URL(...)` z Next 15.3), oba parsery przestaną cokolwiek znajdować.
 * Dlatego pusty wynik jest tu TWARDYM BŁĘDEM, nie „zero wpisów, czyli zero
 * wildcardów, czyli zielono".
 */
export function parseRemotePatterns(source) {
  const marker = /remotePatterns\s*:\s*\[/.exec(source);
  assert.ok(marker, 'nie znaleziono tablicy images.remotePatterns w next.config.ts');

  let depth = 1;
  let end = marker.index + marker[0].length;
  const start = end;
  while (end < source.length && depth > 0) {
    if (source[end] === '[') depth += 1;
    else if (source[end] === ']') depth -= 1;
    end += 1;
  }
  const body = source.slice(start, end - 1);

  // Komentarze zawierają dziś słowo `'**'` w opisie usuniętego wildcardu —
  // bez ich wycięcia bramka fałszywie zaczerwieniłaby się na własnej
  // dokumentacji.
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  return [...code.matchAll(/\{[^{}]*\}/g)].map((match) => {
    const obj = match[0];
    const pick = (key) => {
      const m = new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`).exec(obj);
      return m ? m[1] : null;
    };
    return {
      raw: obj,
      protocol: pick('protocol'),
      hostname: pick('hostname'),
      pathname: pick('pathname'),
      port: pick('port')
    };
  });
}

/**
 * „Rozwiązywalny do dowolnego hosta" — nie tylko dosłowne `'**'`.
 * next/image traktuje `**` jako span przez segmenty, a `*` jako jeden segment,
 * więc `'*'`, `'*.*'` i `'**.**'` też degenerują się do przepustki. Brakujący
 * lub pusty `hostname` jest tym samym: wpis bez hosta nie zawęża niczego.
 */
export function resolvesToAnyHost(pattern) {
  const hostname = pattern.hostname;
  if (hostname === null || hostname.trim() === '') return true;
  // Po usunięciu gwiazdek, kropek i spacji nie zostaje żaden dosłowny znak,
  // który musiałby się zgadzać ⇒ wzorzec pasuje do wszystkiego.
  return hostname.replace(/[*.\s]/g, '') === '';
}

const source = fs.readFileSync(NEXT_CONFIG, 'utf8');

test('remotePatterns nie zawiera wzorca rozwiązywalnego do „dowolny host"', () => {
  const patterns = parseRemotePatterns(source);
  assert.ok(
    patterns.length > 0,
    'sparsowano ZERO wpisów remotePatterns — parser rozjechał się ze składnią ' +
      'next.config.ts; to nie jest dowód braku wildcardu, tylko ślepa bramka'
  );

  const offenders = patterns.filter(resolvesToAnyHost);
  assert.deepEqual(
    offenders.map((p) => p.hostname),
    [],
    'wpis remotePatterns przepuszcza dowolny host — /_next/image pobiera zdalny ' +
      'zasób serwerowo i serwuje go z naszego originu (SSRF-podobna powierzchnia ' +
      '+ darmowy hosting treści pod naszą domeną). ADR-178 zamknął ten dług; ' +
      'jeśli potrzebujesz nowego originu, dodaj JAWNY host i uzasadnij go ' +
      'komentarzem o konsumencie'
  );
});

test('każdy wpis remotePatterns ma jawny protokół i host', () => {
  for (const pattern of parseRemotePatterns(source)) {
    assert.ok(
      pattern.protocol === 'https' || pattern.protocol === 'http',
      `wpis bez rozpoznanego protokołu: ${pattern.raw}`
    );
    assert.ok(pattern.hostname, `wpis bez hostname: ${pattern.raw}`);
  }
});

test('allowlisty nie obchodzi się bokiem (unoptimized / loader / domains / SVG)', () => {
  // AC2: zawężenie remotePatterns jest bez znaczenia, jeśli równolegle
  // otworzy się drugi kanał. `unoptimized` omija optymalizator w całości,
  // własny `loader`/`loaderFile` zastępuje jego politykę, legacy
  // `images.domains` to druga, luźniejsza lista, a `dangerouslyAllowSVG`
  // wpuszcza wykonywalny SVG spod naszego originu.
  for (const forbidden of ['unoptimized', 'loaderFile', 'dangerouslyAllowSVG', 'domains']) {
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    assert.equal(
      new RegExp(`\\b${forbidden}\\s*:`).test(withoutComments),
      false,
      `next.config.ts wprowadza '${forbidden}' — to obejście zawężonej allowlisty ` +
        'obrazów (Story 2.5 AC2 zakazuje go wprost); jeśli jest naprawdę potrzebne, ' +
        'wymaga ADR, nie cichej edycji'
    );
  }
});
