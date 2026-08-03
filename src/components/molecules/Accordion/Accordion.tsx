'use client';

import { useEffect, useRef, useState } from 'react';

import { Card } from '@/components/atoms';
import { CollapseIcon } from '@/icons';
import { cn } from '@/lib/utils';

export const Accordion = ({
  children,
  heading,
  defaultOpen = true
}: {
  children: React.ReactNode;
  heading: string;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (contentRef.current) {
        setHeight(contentRef.current.scrollHeight);
      }
    }, 100);
  }, [children]);

  const openHandler = () => {
    setIsOpen(!isOpen);
  };

  return (
    <Card>
      <div
        onClick={openHandler}
        className="flex cursor-pointer items-center justify-between px-2"
      >
        <h3 className="label-lg uppercase">{heading}</h3>
        <CollapseIcon
          size={20}
          className={cn('transition-all duration-300', isOpen && 'rotate-180')}
        />
      </div>
      <div
        className={cn('overflow-hidden transition-all duration-300')}
        style={{
          maxHeight: isOpen ? `${height}px` : '0px',
          opacity: isOpen ? 1 : 0,
          transition: 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out'
        }}
      >
        <div
          ref={contentRef}
          className="pt-4"
        >
          {children}
        </div>
      </div>
    </Card>
  );
};
