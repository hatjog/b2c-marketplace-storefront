export type SellerMapMode = 'list' | 'detail' | 'mini' | 'landing';

export type SellerMapAspect = 'responsive' | 'compact';

export interface SellerMapModeConfig {
  mode: SellerMapMode;
  aspect: SellerMapAspect;
  defaultZoom: number;
  maxAutoZoom: number;
  scrollWheelZoom: boolean;
  dragging: boolean;
  zoomControl: boolean;
  showDeepLink: boolean;
  lazyMount: boolean;
}

export const SELLER_MAP_MODES: Record<SellerMapMode, SellerMapModeConfig> = {
  list: {
    mode: 'list',
    aspect: 'responsive',
    defaultZoom: 12,
    maxAutoZoom: 14,
    scrollWheelZoom: true,
    dragging: true,
    zoomControl: true,
    showDeepLink: true,
    lazyMount: false
  },
  detail: {
    mode: 'detail',
    aspect: 'responsive',
    defaultZoom: 14,
    maxAutoZoom: 14,
    scrollWheelZoom: true,
    dragging: true,
    zoomControl: true,
    showDeepLink: true,
    lazyMount: false
  },
  mini: {
    mode: 'mini',
    aspect: 'compact',
    defaultZoom: 14,
    maxAutoZoom: 14,
    scrollWheelZoom: false,
    dragging: true,
    zoomControl: false,
    showDeepLink: true,
    lazyMount: false
  },
  landing: {
    mode: 'landing',
    aspect: 'responsive',
    defaultZoom: 11,
    maxAutoZoom: 14,
    scrollWheelZoom: false,
    dragging: true,
    zoomControl: true,
    showDeepLink: true,
    lazyMount: true
  }
} as const;

export function getSellerMapModeConfig(mode: SellerMapMode): SellerMapModeConfig {
  return SELLER_MAP_MODES[mode];
}
