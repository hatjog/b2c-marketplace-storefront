# Leaflet Assets

These static assets are bundled from `leaflet@1.9.4` (BSD-2-Clause license).

## Files

- `marker-icon.png` — default Leaflet marker icon (25×41px)
- `marker-icon-2x.png` — retina default marker icon (50×82px)
- `marker-shadow.png` — default marker shadow (41×41px)
- `LICENSE` — BSD-2-Clause license (Volodymyr Agafonkin, CloudMade)

## Why bundled locally (TF-65)

Previously, `SellerMap.tsx` hard-coded URLs to `https://unpkg.com/leaflet@1.9.4/dist/images/...`.
This caused three security/privacy issues:

1. **Supply-chain risk** — third-party CDN asset injection if leaflet@1.9.4 on npm/unpkg is
   compromised; no SRI hash protection for images.
2. **CSP relaxation** — `img-src` had to permit `https://unpkg.com`.
3. **GDPR third-party IP exposure** — every map render sent user IP to Cloudflare/unpkg logs
   without a DPA or consent gate.

Bundling locally (Next.js `public/` → served as `'self'`) eliminates all three risks.

## License attribution

See `LICENSE` (BSD-2-Clause). Copyright (c) 2010-2023 Volodymyr Agafonkin, CloudMade.
Redistribution permitted with copyright notice preserved.
