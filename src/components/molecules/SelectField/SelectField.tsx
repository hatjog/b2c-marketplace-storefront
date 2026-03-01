'use client';

import { useEffect, useRef, useState } from 'react';

import clsx from 'clsx';

import { CollapseIcon, TickThinIcon } from '@/icons';
import { cn } from '@/lib/utils';

export const SelectField = ({
  options,
  className = '',
  selected,
  selectOption,
  placeholder = ''
}: {
  options: {
    value?: string;
    label?: string;
    hidden?: boolean;
  }[];
  placeholder?: string;
  className?: string;
  selected?: string | number | readonly string[];
  selectOption?: (value: string) => void;
}) => {
  const [selectedOption, setSelectedOption] = useState(
    options.find(({ value }) => value === selected)?.label || options[0].label
  );
  const [open, setOpen] = useState(false);

  const selectRef = useRef(null);

  useEffect(() => {
    window.addEventListener('click', e => {
      if (selectRef.current && selectRef.current !== e.target) setOpen(false);
    });

    return window.removeEventListener('click', () => null);
  }, []);

  const selectOptionHandler = (label?: string, value?: string) => {
    setSelectedOption(label);
    if (selectOption && value) selectOption(value);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div
        ref={selectRef}
        className={cn(
          'label-md relative flex h-12 cursor-pointer items-center rounded-sm border bg-component-secondary px-3 py-2',
          open && 'border-primary',
          className
        )}
        onClick={() => setOpen(!open)}
      >
        {selectedOption || placeholder}
        <CollapseIcon
          className={clsx('absolute right-3 transition', {
            'rotate-180': open
          })}
          size={20}
        />
      </div>
      {open && (
        <ul className="absolute top-[47px] z-10 w-full rounded-sm border border-primary bg-component-secondary">
          {options.map(
            ({ label, value, hidden }, index) =>
              !hidden && (
                <li
                  key={value}
                  className={cn(
                    'label-md relative px-3 py-2 hover:bg-component-secondary-hover',
                    index === 0 && 'rounded-t-sm',
                    index === options.length - 1 && 'rounded-b-sm'
                  )}
                  onClick={() => selectOptionHandler(label, value)}
                >
                  {label}
                  {label === selectedOption && (
                    <TickThinIcon
                      className="absolute right-2 top-[10px]"
                      size={20}
                    />
                  )}
                </li>
              )
          )}
        </ul>
      )}
    </div>
  );
};
