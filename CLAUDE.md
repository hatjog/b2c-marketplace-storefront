# Storefront — Next.js App Router

## Stack lokalny
- Sprawdzaj faktyczne wersje w `package.json`; nie traktuj tego pliku jako SSOT wersji.
- Next.js App Router, React, TypeScript, Tailwind 3.
- Testy jednostkowe używają skryptu `test` z `package.json`.
- i18n: locales `[locale]/(main)/...` — **2 active in v1.6.0: `pl` (default), `en`**. UA/DE deferred to v1.7.0+ (story `v160-cleanup-7-locale-honesty`). `messages/` ships only `pl.json` + `en.json`; `SUPPORTED_LOCALES` in `src/i18n/routing.ts` is the SSOT.

## Struktura
- `src/app/[locale]/(main)/` — pages (categories, products, sellers, cart, user, blog, collections, order)
- `src/components/` — cells / molecules / organisms / sections
- `src/data/` — data fetching (server-side)
- `src/hooks/` — client hooks
- `src/lib/helpers/` — czyste utils
- `src/i18n/` — translations
- `src/types/` — typy domenowe

## Pułapki
- **Barrel exports leak server modules into client bundles.** Edytując `index.ts` w komponentach trace pełen import chain — nie ciągnij `node:*` ani modułów backendowych do client components.
- Komponenty client muszą mieć `"use client"` na top. Czyste presentational → server-side default.
- Tailwind 3: sprawdzaj `tailwind.config.*`, PostCSS config i `globals.css` przed zmianą klas lub theme.
- **Leaflet marker assets** są bundlowane lokalnie pod `public/leaflet-assets/` (TF-65 — supply-chain + GDPR third-party IP exposure). NIE wprowadzaj URL-i do CDN trzeciej strony (`unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`) dla ikon Leaflet — paths SSOT to `src/components/cells/SellerMap/leafletAssets.ts`. CSP `img-src` w `src/lib/security/csp.ts` ma `https:` wildcard; bundling lokalny jest preconditioned future tighten-pass do `'self' data: blob:` + explicit tile origins.

## Testy
- `cd GP/storefront && pnpm test` albo węższy wariant zgodny ze skryptami w `package.json`.
