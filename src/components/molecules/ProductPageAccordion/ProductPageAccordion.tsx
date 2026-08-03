'use client';

import { useEffect, useRef, useState } from 'react';

import { Card } from '@/components/atoms';
import { MinusThinIcon } from '@/icons';
import { cn } from '@/lib/utils';

export const ProductPageAccordion = ({
  children,
  heading,
  defaultOpen = true
}: {
  children: React.ReactNode;
  heading: string;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(defaultOpen ? '100%' : 0);

  const accordionRef = useRef(null);

  useEffect(() => {
    if (accordionRef.current) setContentHeight(accordionRef.current['scrollHeight'] || 0);
  }, []);

  const openHandler = () => {
    setOpen(!open);
  };
  return (
    <Card>
      <div
        onClick={openHandler}
        className="flex cursor-pointer items-center justify-between px-2 py-4"
      >
        <h3 className="label-lg uppercase">{heading}</h3>
        <div className="relative">
          <MinusThinIcon
            className={cn(
              'absolute left-0 top-0 transition-all duration-300',
              !open && 'rotate-90'
            )}
          />
          <MinusThinIcon />
        </div>
      </div>
      <div
        ref={accordionRef}
        className={cn('h-full overflow-hidden px-2 transition-all duration-300')}
        style={{ maxHeight: open ? contentHeight : 0 }}
      >
        <div className="py-2">{children}</div>
      </div>
    </Card>
  );
};
