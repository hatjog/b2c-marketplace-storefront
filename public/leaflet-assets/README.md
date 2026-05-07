# Leaflet Assets

These static assets are bundled from `leaflet@1.9.4` (BSD-2-Clause license).

## Files

- `marker-icon.png` — default Leaflet marker icon (25x41 px, 1466 bytes,
  sha256 `574c3a5cca85f4114085b6841596d62f00d7c892c7b03f28cbfa301deb1dc437`)
- `marker-icon-2x.png` — retina default marker icon (50x82 px, 2464 bytes,
  sha256 `00179c4c1ee830d3a108412ae0d294f55776cfeb085c60129a39aa6fc4ae2528`)
- `marker-shadow.png` — default marker shadow (41x41 px, 618 bytes,
  sha256 `264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da`)
- `LICENSE` — BSD-2-Clause license (Volodymyr Agafonkin, CloudMade)

## Why bundled locally (TF-65)

Previously, `SellerMap.tsx` hard-coded URLs to
`https://unpkg.com/leaflet@1.9.4/dist/images/...`. This caused three
security/privacy issues:

1. **Supply-chain risk** — third-party CDN asset injection if leaflet@1.9.4
   on npm/unpkg is compromised; no SRI hash protection for images.
2. **CSP-tightening blocker** — the storefront CSP `img-src` directive is
   currently `'self' https: blob: data:`, which permits any HTTPS origin
   (including unpkg.com) via the wildcard. Bundling locally is the
   precondition for a future tighten-pass that drops the `https:` wildcard
   in favour of `'self' data: blob:` plus an explicit allowlist for tile
   servers (e.g. `*.basemaps.cartocdn.com`). Bundling here does NOT itself
   tighten CSP — it removes one of the obstacles to doing so.
3. **GDPR third-party IP exposure** — every map render sent the user's
   browser IP to Cloudflare/unpkg edge logs without a DPA or consent gate.

Bundling locally (Next.js `public/` -> served as `'self'`) eliminates the
supply-chain and IP-exposure risks immediately.

## License attribution

See `LICENSE` (BSD-2-Clause). Copyright (c) 2010-2023 Volodymyr Agafonkin,
CloudMade. Redistribution permitted with copyright notice preserved.
