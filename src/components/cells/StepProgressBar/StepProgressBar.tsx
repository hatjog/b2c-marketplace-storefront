import { cn } from '@/lib/utils';

export const StepProgressBar = ({
  steps,
  currentStep
}: {
  steps: string[];
  currentStep: number;
}) => {
  const length = steps.length || 0;

  return (
    <div className={`grid grid-cols-${length} h-16`}>
      {steps.map((step, index) => (
        <div
          key={step}
          className="relative"
        >
          <p
            className={cn(
              'label-md text-center text-primary',
              index <= currentStep ? '!font-bold' : '!font-normal'
            )}
          >
            {step}
          </p>
          <div className="absolute bottom-2 left-0 flex w-full items-center justify-center">
            <div
              className={cn(
                'absolute left-0 w-1/2 border-y',
                index <= currentStep ? 'border-primary' : ''
              )}
            />
            <div
              className={cn(
                'absolute left-1/2 w-1/2 border-y',
                index + 1 <= currentStep ? 'border-primary' : '',
                currentStep === steps.length - 1 ? 'border-primary' : ''
              )}
            />
            <div
              className={cn(
                'z-10 mx-auto h-2 w-2 rounded-full border-2 bg-tertiary',
                index <= currentStep ? 'border-primary bg-tertiary' : 'bg-secondary'
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
