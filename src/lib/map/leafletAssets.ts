// SSOT dla lokalnych assetow markerow Leaflet; story 4.3 + TF-65 (bez CDN).
export const leafletAssets = {
  iconUrl: '/leaflet-assets/marker-icon.png',
  iconRetinaUrl: '/leaflet-assets/marker-icon-2x.png',
  shadowUrl: '/leaflet-assets/marker-shadow.png',
  iconSize: [25, 41] as [number, number],
  iconAnchor: [12, 41] as [number, number],
  popupAnchor: [1, -34] as [number, number],
  shadowSize: [41, 41] as [number, number]
} as const;

export function getDefaultMarkerIcon(L: typeof import('leaflet')) {
  return new L.Icon(leafletAssets);
}
