'use client';

import { useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface CategoryDropdownContainerProps {
  children: ReactNode;
  isVisible: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const CategoryDropdownContainer = ({
  children,
  isVisible: _isVisible,
  onMouseEnter,
  onMouseLeave
}: CategoryDropdownContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Invisible 'bridge' to prevent dropdown from closing */}
      <div
        className="pointer-events-auto fixed left-0 right-0 z-40"
        style={{
          top: 'var(--navbar-height, 120px)',
          // Gap height
          height: '10rem'
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      <div
        ref={containerRef}
        className={cn(
          'fixed left-0 right-0 z-50 mx-auto h-full max-h-[25rem] w-full bg-primary transition-all duration-300 ease-in-out'
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          top: 'var(--navbar-height, 160px)'
        }}
      >
        <div className="h-full max-h-[25rem] max-w-[1440px] bg-primary px-5">{children}</div>
      </div>
    </>
  );
};
