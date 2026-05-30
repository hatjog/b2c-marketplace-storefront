# Storefront — Next.js App Router

## Stack lokalny
- Sprawdzaj faktyczne wersje w `package.json`; nie traktuj tego pliku jako SSOT wersji.
- Next.js App Router, React, TypeScript, Tailwind 3.
- Testy jednostkowe używają skryptu `test` z `package.json`.
- i18n: locales `[locale]/(main)/...` — **4 active in v1.8.0+: `pl` (default), `en`, `ua`, `de`** (per D-55 locale enum). `SUPPORTED_LOCALES` in `src/i18n/routing.ts` is the SSOT; `messages/{pl,en,ua,de}.json` ship together. Runtime convention uses `ua` (storefront); legal source files on disk use `master.uk.md` per F-NEW-S3 — see `src/lib/legal/fetchLegalDocument.ts` for the mapping.

## Struktura
- `src/app/[locale]/(main)/` — pages (categories, products, sellers, cart, user, blog, collections, order, legal docs)
- `src/components/` — cells / molecules / organisms / sections / templates
- `src/data/` — data fetching (server-side)
- `src/hooks/` — client hooks
- `src/lib/` — czyste utils (m.in. `src/lib/legal/` dla fetchLegalDocument + renderLegalMarkdown)
- `src/i18n/` — translations
- `src/types/` — typy domenowe

## Pułapki
- **Barrel exports leak server modules into client bundles.** Edytując `index.ts` w komponentach trace pełen import chain — nie ciągnij `node:*` ani modułów backendowych do client components.
- Komponenty client muszą mieć `"use client"` na top. Czyste presentational → server-side default.
- Tailwind 3: sprawdzaj `tailwind.config.*`, PostCSS config i `globals.css` przed zmianą klas lub theme.
- **Leaflet marker assets** są bundlowane lokalnie pod `public/leaflet-assets/` (TF-65 — supply-chain + GDPR third-party IP exposure). NIE wprowadzaj URL-i do CDN trzeciej strony (`unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`) dla ikon Leaflet — paths SSOT to `src/lib/map/leafletAssets.ts` (Story 4.3 + TF-65). CSP `img-src` w `src/lib/security/csp.ts` ma `https:` wildcard; bundling lokalny jest preconditioned future tighten-pass do `'self' data: blob:` + explicit tile origins.
- **Legal docs** używają fetchLegalDocument(marketId, slug, locale) z `gp-ops/markets/<market>/legal/portal/<doc>/master[.locale].md` (F-NEW-A4 fail-closed). LegalDocLayout (NIE legacy LegalPageLayout placeholder) renderuje wszystkie 5 trust signals (last-updated / version / draft watermark / fail-closed / provenance) per Story 7.9 AC9 + validate_legal_signals_trust_invariants. Mapping locale `ua` → plik `master.uk.md` per F-NEW-S3.

## Testy
- `cd GP/storefront && pnpm test` albo węższy wariant zgodny ze skryptami w `package.json`.
