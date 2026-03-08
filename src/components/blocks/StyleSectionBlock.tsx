import React from 'react';

import { ShopByStyleSection } from '@/components/sections/ShopByStyle/ShopByStyleSection';

import {
  getStyleSectionData,
  type StyleSectionBlock as StyleSectionPayloadBlock,
} from './homepage-utils';

export function StyleSectionBlock({ section }: { section: StyleSectionPayloadBlock }) {
  const data = getStyleSectionData(section, '/images/placeholder.svg');

  if (!data) {
    return null;
  }

  return <ShopByStyleSection {...data} />;
}
