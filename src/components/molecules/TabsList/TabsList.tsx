import { TabsTrigger } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';

export const TabsList = ({
  list,
  activeTab,
  'data-testid': dataTestId
}: {
  list: { label: string; link: string; value?: string }[];
  activeTab: string;
  'data-testid'?: string;
}) => {
  return (
    <div
      className="flex w-full gap-4"
      data-testid={dataTestId ?? 'tabs-list'}
    >
      {list.map(({ label, link, value }) => (
        <LocalizedClientLink
          key={value ?? label}
          href={link}
        >
          <TabsTrigger isActive={activeTab === (value ?? label.toLowerCase())}>{label}</TabsTrigger>
        </LocalizedClientLink>
      ))}
    </div>
  );
};
