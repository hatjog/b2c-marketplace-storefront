/**
 * Story 4.4 / FR-D.2 / D-104 — MapTiler API key consumer (storefront).
 *
 * v1.10.0..v1.15.0 amendment (softened secrets window): klucz czytany z
 * `process.env.MAPTILER_API_KEY` (provisioned via `.env.local`). Docelowo
 * (post v1.15.0 + Pillar J reactivation) ten moduł zostanie podmieniony na
 * adapter GCP Secret Manager class `map_signing` (365d rotation, resource
 * name `projects/<gcp-project>/secrets/maptiler-api-key` per architecture
 * D-100/D-104) gated przez flagę `SECRETS_GCP_ADAPTER_ACTIVE`.
 *
 * Konsumer runtime tile loadingu (`SellerMap.tsx`) wywoła `getMapTilerApiKey()`
 * dopiero po follow-up story, w której `TileLayer.url` przełącza się z
 * CartoDB Voyager na MapTiler endpoint. Do tego czasu wywołanie jest
 * dostępne, ale niewywoływane — to celowy stan (env contract czeka na
 * consumer hook).
 *
 * Fail-fast: brak klucza w środowisku gdy konsumer faktycznie go wywoła
 * (nie przy module load, żeby nie blokować buildów / SSR-ów które MapTilera
 * nie używają).
 *
 * TODO post-Pillar-J: zastąpić `process.env` lookupem przez storefrontowy
 * `gcp-adapter` z klasą `map_signing`.
 */
export function getMapTilerApiKey(): string {
  const key = process.env.MAPTILER_API_KEY;
  if (!key || key === '__SET_LOCAL_PER_ENV_DO_NOT_COMMIT__') {
    throw new Error(
      'MAPTILER_API_KEY is not provisioned. Set it in `.env.local` per Story 4.4 / ADR-085 (v1.10.0..v1.15.0 softened window). Docelowo: GCP Secret Manager class `map_signing` post v1.15.0.'
    );
  }
  return key;
}
