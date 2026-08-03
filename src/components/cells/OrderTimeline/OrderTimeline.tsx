// OrderTimeline.tsx
import { cn } from '@/lib/utils';

type OrderStatus = 'received' | 'preparing' | 'shipped' | 'delivered';

interface OrderTimelineProps {
  currentStatus: OrderStatus;
}

export const OrderTimeline = ({ currentStatus }: OrderTimelineProps) => {
  const statuses: OrderStatus[] = ['received', 'preparing', 'shipped', 'delivered'];
  const currentIndex = statuses.findIndex(status => status === currentStatus);

  return (
    <div className="w-full pb-4 pt-6">
      <div className="relative flex items-center justify-around">
        {/* Base line */}
        <div className="absolute left-0 right-0 h-0.5 bg-[var(--color-neutral-50)]" />

        {/* Progress line */}
        <div
          className="absolute left-0 h-0.5 bg-[var(--bg-action)] transition-all duration-300"
          style={{
            width:
              currentIndex >= 0 ? `calc(${(currentIndex / statuses.length) * 100}% + 105px)` : '0%'
          }}
        />

        {/* Status points */}
        {statuses.map((status, index) => {
          const isActive = index <= currentIndex;

          return (
            <div
              key={status}
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: `calc(${(index / statuses.length) * 100}% + 70px)`
              }}
            >
              <span
                className={cn(
                  'heading-xs -translate-y-4 whitespace-nowrap uppercase text-primary',
                  isActive ? 'text-[var(--bg-action)]' : 'text-[var(--color-neutral-50)]'
                )}
              >
                {status}
              </span>
              <div
                className={cn(
                  'size-2.5 -translate-y-2.5 rounded-full transition-colors duration-300',
                  isActive ? 'bg-[var(--bg-action)]' : 'bg-[var(--color-neutral-50)]'
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
