import { BannerSection } from '@/components/sections';

export type BannerSectionBlock = {
  heading?: string | null;
  subheading?: string | null;
};

export function BannerBlock({ section }: { section: BannerSectionBlock }) {
  return <BannerSection key={section.heading ?? section.subheading ?? 'banner'} />;
}
