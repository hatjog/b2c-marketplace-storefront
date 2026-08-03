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
    <div className="bb-card-muted flex h-full items-center gap-3">
      <CalendarIcon size={16} />
      <span className="label-md text-primary">{text}</span>
    </div>
  );
}
