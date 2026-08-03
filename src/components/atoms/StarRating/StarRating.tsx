import { StarIcon } from '@/icons';

export const StarRating = ({
  rate,
  starSize = 20,
  disabled,
  'data-testid': dataTestId
}: {
  rate: number;
  starSize?: number;
  disabled?: boolean;
  'data-testid'?: string;
}) => {
  return (
    <div
      className="flex"
      data-testid={dataTestId ?? 'star-rating'}
    >
      {[...Array(5)].map((_, i) => {
        const starColor =
          i < Math.floor(rate)
            ? disabled
              ? 'rgba(var(--content-disabled))'
              : 'rgba(var(--content-primary))'
            : 'rgba(var(--content-action-on-primary))';
        return (
          <StarIcon
            size={starSize}
            key={i}
            color={starColor}
          />
        );
      })}
    </div>
  );
};
