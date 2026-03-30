import { CalendarIcon } from '@/icons';

type VoucherValidityInfoProps = {
  validityPeriod: string | null;
  defaultInfo: string | null;
};

export function VoucherValidityInfo({ validityPeriod, defaultInfo }: VoucherValidityInfoProps) {
  const text = validityPeriod || defaultInfo || null;

  if (!text) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded bg-primary px-3 py-2 text-primary-contrast">
      <CalendarIcon size={16} />
      <span>{text}</span>
    </div>
  );
}
