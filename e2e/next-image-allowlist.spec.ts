/**
 * Kontrola negatywna i dodatnia allowlisty `/_next/image` — Story 2.5
 * (v1.15.0, FR-14c, AI-3.3, ADR-178).
 *
 * ══ Dlaczego to musi być e2e na prod-buildzie ══
 * `next.config.ts` z poprawną treścią NIE jest dowodem, że optymalizator
 * odrzuca hosty — NFR-1 nazywa „zabezpieczenie istnieje, ale jest martwe"
 * dominującą klasą defektów tego repo, a `next dev` i `next build`/`next start`
 * różnią się w obsłudze `remotePatterns` i w komunikatach błędów. Bramką jest
 * więc ŻĄDANIE, nie odczyt konfiguracji.
 *
 * Statyczną warstwę (czy ktoś nie przywrócił wildcardu / nie obszedł go przez
 * `unoptimized`) pilnuje szybki `tests/next-image-allowlist.test.mjs` w
 * `pnpm test`. Ten plik dokłada jedyną rzecz, której tamten nie umie: dowód
 * WYKONAWCZY.
 *
 * ══ Co jest asertowane ══
 *  1. KONTROLA NEGATYWNA: host spoza allowlisty → 400 z komunikatem
 *     `"url" parameter is not allowed`. Samo „nie 200" NIE wystarcza:
 *     nieosiągalny host też daje nie-200 (500/400 „isn't a valid image"), więc
 *     test, który akceptuje dowolny błąd, przechodziłby też po usunięciu całej
 *     allowlisty. Host negatywny jest DOSTĘPNY i zwraca prawdziwy obraz przy
 *     bezpośrednim pobraniu — różnica 200/400 jest wtedy różnicą POLITYKI,
 *     nie sieci. Ta różnica jest tu mierzona jawnie: test najpierw pobiera ten
 *     obraz BEZPOŚREDNIO i pomija się (nie zieleni!), gdy host jest nieosiągalny.
 *  2. KONTROLA DODATNIA: KAŻDY host z allowlisty → 200 + `content-type: image/*`.
 *     Allowlista, przez którą nic nie przechodzi, nie jest zawężeniem, tylko
 *     awarią. Lista jest PARSOWANA z `next.config.ts`, nie hardkodowana —
 *     hardkod rozjechałby się z konfiguracją przy pierwszej edycji i cicho
 *     przestał cokolwiek pokrywać.
 *
 * Hosty `http://localhost` (uploady Medusy / media Payloada) są w kontroli
 * dodatniej pomijane, gdy lokalny backend nie działa — i jest to raportowane
 * jako pominięcie z nazwaniem hosta, nigdy jako cicha zieleń.
 *
 * Tags: @security @v1150-story-2-5 @needs-stack
 *
 * Uruchomienie (środowisko podniesione per checklist — playwright.config.ts
 * świadomie nie ma `webServer`):
 *   cd GP/storefront && pnpm build && pnpm start -p 8000
 *   cd GP/storefront && pnpm test:e2e -- e2e/next-image-allowlist.spec.ts
 */

import fs from "node:fs"
import path from "node:path"

import { test, expect } from "@playwright/test"

type RemotePattern = {
  protocol: string | null
  hostname: string | null
  pathname: string | null
}

/**
 * Ten sam tekstowy parser co w `tests/next-image-allowlist.test.mjs` i w
 * `_grow/tools/validate_products_catalog.py::parse_next_image_allowlist`.
 * Świadomie nie importuje `next.config.ts` (ciągnie Sentry + next-intl +
 * cztery pliki wiadomości).
 */
function parseRemotePatterns(source: string): RemotePattern[] {
  const marker = /remotePatterns\s*:\s*\[/.exec(source)
  if (!marker) {
    throw new Error("nie znaleziono images.remotePatterns w next.config.ts")
  }
  let depth = 1
  let end = marker.index + marker[0].length
  const start = end
  while (end < source.length && depth > 0) {
    if (source[end] === "[") depth += 1
    else if (source[end] === "]") depth -= 1
    end += 1
  }
  const code = source
    .slice(start, end - 1)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")

  return [...code.matchAll(/\{[^{}]*\}/g)].map((match) => {
    const obj = match[0]
    const pick = (key: string) => {
      const m = new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`).exec(obj)
      return m ? m[1] : null
    }
    return {
      protocol: pick("protocol"),
      hostname: pick("hostname"),
      pathname: pick("pathname"),
    }
  })
}

/**
 * Jeden reprezentatywny, realnie istniejący obraz per host z allowlisty.
 * Kontrola dodatnia musi pobrać PRAWDZIWY plik — URL zmyślony dałby 400
 * „isn't a valid image" i wyglądałby jak odrzucenie przez politykę.
 */
const SAMPLE_IMAGE_BY_HOST: Record<string, string> = {
  "images.unsplash.com":
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80",
  "images.pexels.com":
    "https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&h=627&fit=crop&w=1200",
}

/**
 * Host DOSTĘPNY, zwracający prawdziwy obraz, i świadomie NIEOBECNY w
 * allowliście — nośnik kontroli negatywnej. Musi być osiągalny, żeby 400
 * dowodziło polityki, a nie awarii sieci.
 */
const OUT_OF_ALLOWLIST_IMAGE = "https://picsum.photos/200"

const nextImageUrl = (baseURL: string, remote: string, w = 640, q = 75) =>
  `${baseURL}/_next/image?url=${encodeURIComponent(remote)}&w=${w}&q=${q}`

const allowlist = parseRemotePatterns(
  fs.readFileSync(path.resolve(__dirname, "..", "next.config.ts"), "utf8")
)

test.describe("allowlista /_next/image (Story 2.5, ADR-178)", () => {
  test("allowlista jest niepusta i nie zawiera przepustki na dowolny host", () => {
    expect(
      allowlist.length,
      "sparsowano ZERO wpisów remotePatterns — parser rozjechał się ze składnią; " +
        "to nie dowód braku wildcardu, tylko ślepa bramka"
    ).toBeGreaterThan(0)

    const anyHost = allowlist.filter(
      (p) => !p.hostname || p.hostname.replace(/[*.\s]/g, "") === ""
    )
    expect(anyHost.map((p) => p.hostname)).toEqual([])
  })

  test("KONTROLA NEGATYWNA: host spoza allowlisty dostaje 400 'url parameter is not allowed'", async ({
    request,
    baseURL,
  }) => {
    const hostname = new URL(OUT_OF_ALLOWLIST_IMAGE).hostname
    expect(
      allowlist.map((p) => p.hostname),
      "host kontroli negatywnej trafił do allowlisty — test przestałby cokolwiek mierzyć"
    ).not.toContain(hostname)

    // Kontrola sieci: host MUSI oddawać prawdziwy obraz bezpośrednio.
    // Bez tego 400 poniżej mógłby znaczyć „host padł", a nie „polityka odrzuca".
    const direct = await request.get(OUT_OF_ALLOWLIST_IMAGE)
    test.skip(
      !direct.ok(),
      `host kontroli negatywnej (${hostname}) jest nieosiągalny (HTTP ${direct.status()}) — ` +
        "pomiar różnicy 200/400 byłby nierozstrzygalny; NIE jest to zieleń"
    )
    expect(direct.headers()["content-type"] ?? "").toMatch(/^image\//)

    const res = await request.get(nextImageUrl(baseURL!, OUT_OF_ALLOWLIST_IMAGE))
    const body = await res.text()

    expect(
      res.status(),
      `/_next/image przepuścił host spoza allowlisty (${hostname}) — optymalizator ` +
        "pobiera zdalny zasób SERWEROWO i serwuje go z naszego originu, więc to " +
        "powierzchnia SSRF-podobna + darmowy hosting treści pod naszą domeną. " +
        `Odpowiedź: HTTP ${res.status()}, ciało: ${body.slice(0, 200)}`
    ).toBe(400)

    // Komunikat jest częścią asercji: 400 „isn't a valid image" oznacza
    // „host przeszedł politykę, ale zasób nie był obrazem" — czyli allowlista
    // NIE zadziałała. Tylko ten komunikat dowodzi odrzucenia po originie.
    expect(
      body,
      "400 owszem, ale z innego powodu niż allowlista — host przeszedł przez politykę"
    ).toContain('"url" parameter is not allowed')
  })

  for (const pattern of allowlist) {
    const hostname = pattern.hostname!
    test(`KONTROLA DODATNIA: ${pattern.protocol}://${hostname} zwraca 200 image/*`, async ({
      request,
      baseURL,
    }) => {
      if (pattern.protocol === "http" && hostname === "localhost") {
        // Origin env-driven (MEDUSA_BACKEND_URL / PAYLOAD_API_URL). Bez żywego
        // backendu nie ma czego pobrać — pomijamy z NAZWANIEM hosta, żeby
        // pominięcie było widoczne w raporcie, a nie schowane w zieleni.
        test.skip(
          true,
          `${hostname}: origin env-driven (uploady Medusy :9002 / media Payloada :9003) — ` +
            "kontrola dodatnia wymaga żywego backendu, patrz pre-promote-smoke-checklist"
        )
        return
      }

      const sample = SAMPLE_IMAGE_BY_HOST[hostname]
      expect(
        sample,
        `brak przykładowego obrazu dla hosta '${hostname}' z allowlisty — dodaj go do ` +
          "SAMPLE_IMAGE_BY_HOST, inaczej nowy wpis w next.config.ts nie jest przez nic pokryty"
      ).toBeTruthy()

      const direct = await request.get(sample)
      test.skip(
        !direct.ok(),
        `${hostname} jest nieosiągalny (HTTP ${direct.status()}) — kontrola dodatnia ` +
          "nierozstrzygalna; NIE jest to zieleń"
      )

      const res = await request.get(nextImageUrl(baseURL!, sample))
      expect(
        res.status(),
        `host Z allowlisty (${hostname}) nie przeszedł przez /_next/image — allowlista, ` +
          `przez którą nic nie przechodzi, to awaria, nie zawężenie. Ciało: ${(
            await res.text()
          ).slice(0, 200)}`
      ).toBe(200)
      expect(res.headers()["content-type"] ?? "").toMatch(/^image\//)
    })
  }
})
