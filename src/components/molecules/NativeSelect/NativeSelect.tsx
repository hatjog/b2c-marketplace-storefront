import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type SelectHTMLAttributes
} from 'react';

import { ChevronUpDown } from '@medusajs/icons';
import { clx } from '@medusajs/ui';

export type NativeSelectProps = {
  placeholder?: string;
  errors?: Record<string, unknown>;
  touched?: Record<string, unknown>;
} & SelectHTMLAttributes<HTMLSelectElement>;

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  // `placeholder` intentionally has NO default literal — see CountrySelect:
  // a default parameter reaches the DOM exactly like a written attribute, so a
  // literal default is an untranslated string the i18n guard used to miss.
  ({ placeholder, defaultValue, className, children, ...props }, ref) => {
    const innerRef = useRef<HTMLSelectElement>(null);
    const [isPlaceholder, setIsPlaceholder] = useState(false);

    useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
      ref,
      () => innerRef.current
    );

    useEffect(() => {
      if (innerRef.current && innerRef.current.value === '') {
        setIsPlaceholder(true);
      } else {
        setIsPlaceholder(false);
      }
    }, [innerRef.current?.value]);

    return (
      <div>
        <div
          onFocus={() => innerRef.current?.focus()}
          onBlur={() => innerRef.current?.blur()}
          className={clx(
            'text-base-regular border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-field-hover relative flex items-center rounded-lg border',
            className,
            {
              'text-ui-fg-muted': isPlaceholder
            }
          )}
        >
          <select
            ref={innerRef}
            defaultValue={defaultValue}
            {...props}
            className="flex-1 appearance-none border-none bg-transparent px-4 py-2.5 outline-none transition-colors duration-150"
          >
            <option
              disabled
              value=""
            >
              {placeholder}
            </option>
            {children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
            <ChevronUpDown />
          </span>
        </div>
      </div>
    );
  }
);

NativeSelect.displayName = 'NativeSelect';

export default NativeSelect;
