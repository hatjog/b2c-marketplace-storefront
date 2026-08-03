# Leaflet marker assets — lokalny bundling (TF-65)

Te trzy PNG-i (`marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`)
sa bit-for-bit kopia upstream `leaflet@1.9.4/dist/images/*` (BSD-2-Clause,
`LICENSE` w tym katalogu).

## Dlaczego lokalnie

- **Supply-chain (TF-65):** zaden third-party CDN nie jest queryowany przy
  renderze mapy — assety serwowane same-origin pod `/leaflet-assets/...`.
- **CSP:** ulatwia przyszle tighten `img-src 'self' data: blob:` + explicit
  tile origins (CSP §`src/lib/security/csp.ts`).
- **GDPR / IP exposure:** brak leaku IP uzytkownika do third-party na kazdy
  render mapy.

## SSOT scieżek

Konstanty URL + geometria ikony zyja w
`src/lib/map/leafletAssets.ts` (Story 4.3). Komponenty (np. `SellerMap.tsx`)
importuja `leafletIconUrls` dla `L.Icon.Default.mergeOptions(...)` oraz
`leafletAssets` / `getDefaultMarkerIcon(L)` dla jawnych instancji markera.

## Update procedure

1. Bump `leaflet` w `package.json` storefrontu.
2. Skopiuj `node_modules/leaflet/dist/images/{marker-icon,marker-icon-2x,marker-shadow}.png`
   do `public/leaflet-assets/`.
3. Sprawdz sha256 (`shasum -a 256 public/leaflet-assets/*.png`) i porownaj
   z upstream w evidence releaseu.
4. Uruchom `SellerMap.assets.test.ts` (vitest) — gate na CDN URL musi pozostac
   GREEN.
5. **NIE** wprowadzaj URL-i CDN-owych dla Leaflet ikon — gate w testach +
   grep gate w sprint statusu odrzuca PR.

## License

`LICENSE` w tym katalogu zawiera BSD-2-Clause Leaflet plus header TF-65.
