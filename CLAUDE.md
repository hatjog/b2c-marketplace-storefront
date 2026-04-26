# Storefront — Next.js 16 + React 19 + Tailwind 4

## Stack lokalny
- Next.js 16 (App Router), React 19, TypeScript 5 strict, Tailwind 4
- Vitest dla unit testów
- i18n: locales `[locale]/(main)/...` (pl, en, ua, de)

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
- Tailwind 4: nowe `@theme` syntax i CSS-first config. Stare `tailwind.config.js` może być nieaktualne — sprawdź `globals.css`.

## Testy
- `cd GP/storefront && npx vitest run <plik>` lub `node --test <plik>` (per `bmad-code-review-fix-runner` rules).
