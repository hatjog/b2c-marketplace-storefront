import type { MetadataRoute } from 'next';

/**
 * Środowiskowa bramka publikacji storefrontu
 * (v1.15.0 Story 7.4 — FR-15, AD-24, AD-19, ADR-183 §2.5).
 *
 * Do v1.15.0 obie gałęzie tego pliku zwracały bezwarunkowe `allow: '/'` — także
 * wtedy, gdy storefront serwował profile badawcze (`city-beauty`, `kremidotyk`,
 * snapshot 2026-03-08). Teraz polityka WYNIKA ZE ŚRODOWISKA WDROŻENIA.
 *
 * Rozstrzyga `GP_DEPLOY_ENV` — zmienna SERWEROWA, celowo BEZ prefiksu
 * `NEXT_PUBLIC_`: `robots.ts` jest route handlerem, a wartość z prefiksem
 * wyciekłaby do bundla i dałaby się nadpisać z klienta.
 *
 * `NODE_ENV` jest tu ODRZUCONE świadomie: `next build` ustawia `production`
 * także dla buildów dev/test, więc bramka oparta na `NODE_ENV` wyglądałaby na
 * żywą i była martwa — storefront dev/test dostałby `allow: '/'`.
 *
 * Fail-closed (AD-19): brak zmiennej albo wartość spoza dziedziny → polityka
 * najbardziej restrykcyjna (`disallow: '/'`). Wybrano degradację, nie twardy
 * błąd builda — brakująca zmienna ma dawać nadmiarowe `noindex`, a nie awarię
 * wdrożenia niepublicznego (uzasadnienie: ADR-183 §2.5).
 *
 * `sitemap:` pozostaje dopisywany wtedy i tylko wtedy, gdy `NEXT_PUBLIC_BASE_URL`
 * jest ustawione — kontrakt sitemapy (Story 2.2) NIE jest tu zmieniany.
 */

/**
 * Polityka jest rozstrzygana PRZY ŻĄDANIU, nie przy buildzie.
 *
 * Bez tego Next prerenderuje `/robots.txt` statycznie i zapieka wartość
 * `GP_DEPLOY_ENV` z MASZYNY BUDUJĄCEJ. Wtedy ten sam artefakt wdrożony na
 * dev i na prod niósłby tę samą politykę, a zmienna ustawiona na środowisku
 * docelowym nie zmieniałaby nic — mechanizm wyglądałby na żywy i byłby martwy
 * (dokładnie ta klasa defektu, którą AC4 wyklucza przy `NODE_ENV`).
 * Zmierzone: przy prerenderze statycznym `.next/server/app/robots.txt.body`
 * powstaje raz, w czasie `next build`.
 */
export const dynamic = 'force-dynamic';

/** Dziedzina środowisk wdrożenia — ta sama co `GpEnv` w `gp-ops/cli/src/env-guard.ts`. */
export const DEPLOY_ENVS = ['dev', 'test', 'stage', 'prod'] as const;

export type DeployEnv = (typeof DEPLOY_ENVS)[number];

/** Jedyne środowisko, w którym storefront wolno indeksować. */
export const INDEXABLE_DEPLOY_ENV: DeployEnv = 'prod';

/**
 * Czy dla podanej wartości `GP_DEPLOY_ENV` wolno indeksować storefront.
 * Pure — testowalna wyczerpująco, bez procesu i bez builda.
 */
export function isIndexingAllowed(rawDeployEnv: string | undefined): boolean {
  if (typeof rawDeployEnv !== 'string') return false;
  const value = rawDeployEnv.trim().toLowerCase();
  if (!(DEPLOY_ENVS as readonly string[]).includes(value)) return false;
  return value === INDEXABLE_DEPLOY_ENV;
}

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const allowIndexing = isIndexingAllowed(process.env.GP_DEPLOY_ENV);

  const rules: MetadataRoute.Robots['rules'] = allowIndexing
    ? [{ userAgent: '*', allow: '/' }]
    : [{ userAgent: '*', disallow: '/' }];

  if (base) {
    return {
      rules,
      sitemap: `${base.replace(/\/$/, '')}/sitemap.xml`
    };
  }

  return { rules };
}
