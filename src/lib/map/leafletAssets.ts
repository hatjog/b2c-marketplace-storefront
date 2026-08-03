// SSOT for bundled Leaflet marker assets — see story 4.3 + TF-65 (no CDN).
//
// `leafletAssets` carries the full icon shape (URLs + geometry) used dla
// jawnych instancji `new L.Icon(leafletAssets)` (Story 4.2 / 4.6).
// `leafletIconUrls` to URL-only subset uzywany w `L.Icon.Default.mergeOptions(...)`,
// zeby nie wmuszac globalnie geometrii na Default prototype — chroni przed
// nadpisaniem przyszlych Leaflet defaults (tooltipAnchor itp.) i zmniejsza
// ryzyko ordering w stories z `parallel_with`.
import type * as Leaflet from 'leaflet';

export const leafletAssets = {
  iconUrl: '/leaflet-assets/marker-icon.png',
  iconRetinaUrl: '/leaflet-assets/marker-icon-2x.png',
  shadowUrl: '/leaflet-assets/marker-shadow.png',
  iconSize: [25, 41] as [number, number],
  iconAnchor: [12, 41] as [number, number],
  popupAnchor: [1, -34] as [number, number],
  shadowSize: [41, 41] as [number, number]
} as const;

export const leafletIconUrls = {
  iconUrl: leafletAssets.iconUrl,
  iconRetinaUrl: leafletAssets.iconRetinaUrl,
  shadowUrl: leafletAssets.shadowUrl
} as const;

export function getDefaultMarkerIcon(L: typeof Leaflet) {
  return new L.Icon(leafletAssets);
}
