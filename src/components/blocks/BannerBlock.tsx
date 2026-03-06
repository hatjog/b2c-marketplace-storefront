import React from 'react';

import { BannerSection } from '@/components/sections/BannerSection/BannerSection';

import {
  getBannerSectionData,
  type BannerSectionBlock,
} from './homepage-utils';

export function BannerBlock({ section }: { section: BannerSectionBlock }) {
  const data = getBannerSectionData(section);

  if (!data) {
    return null;
  }

  return <BannerSection {...data} />;
}
