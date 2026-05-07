/**
 * TF-65 — Leaflet default marker asset paths (local bundling).
 *
 * Single source of truth for the three default Leaflet marker images
 * served from the storefront's `public/leaflet-assets/` folder. Used
 * by `SellerMap.tsx` to call `L.Icon.Default.mergeOptions` and by
 * `SellerMap.assets.test.ts` to runtime-assert the merged defaults.
 *
 * Keeping these constants here (instead of inline in `SellerMap.tsx`)
 * lets unit tests import them without pulling react-leaflet, which
 * accesses `window` at module init and breaks node-environment tests.
 *
 * Contract: paths MUST resolve under same-origin (`'self'`). NEVER
 * point these at a third-party CDN — see TF-65 rationale in
 * `public/leaflet-assets/README.md`.
 */
export const LEAFLET_ICON_URL = '/leaflet-assets/marker-icon.png' as const;
export const LEAFLET_ICON_RETINA_URL =
  '/leaflet-assets/marker-icon-2x.png' as const;
export const LEAFLET_SHADOW_URL = '/leaflet-assets/marker-shadow.png' as const;

export const LEAFLET_DEFAULT_ICON_OPTIONS = {
  iconRetinaUrl: LEAFLET_ICON_RETINA_URL,
  iconUrl: LEAFLET_ICON_URL,
  shadowUrl: LEAFLET_SHADOW_URL,
} as const;
