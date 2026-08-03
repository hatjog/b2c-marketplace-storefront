'use client';

import type { HttpTypes } from '@medusajs/types';

import { CategoryDropdownContainer } from './CategoryDropdownContainer';
import { CategoryDropdownContent } from './CategoryDropdownContent';
import { ChildCategories } from './ChildCategories';

interface CategoryDropdownMenuProps {
  category: HttpTypes.StoreProductCategory;
  isVisible: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
}

export const CategoryDropdownMenu = ({
  category,
  isVisible,
  onMouseEnter,
  onMouseLeave,
  onLinkClick
}: CategoryDropdownMenuProps) => {
  const childCategories = category.category_children || [];

  if (childCategories.length === 0) {
    return null;
  }

  return (
    <CategoryDropdownContainer
      isVisible={isVisible}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CategoryDropdownContent>
        <div className="grid h-full max-h-[22.5rem] grid-cols-1 overflow-y-auto">
          <section className="rounded-sm border p-6">
            <ChildCategories
              title={category.name}
              categories={childCategories}
              onLinkClick={onLinkClick}
            />
          </section>
        </div>
      </CategoryDropdownContent>
    </CategoryDropdownContainer>
  );
};
