import type { HttpTypes } from '@medusajs/types';

import { CategoryNavbar, NavbarSearch } from '@/components/molecules';

export const Navbar = ({
  categories,
  parentCategories
}: {
  categories: HttpTypes.StoreProductCategory[];
  parentCategories: HttpTypes.StoreProductCategory[];
}) => {
  return (
    <div
      className="min-w-0 overflow-hidden flex flex-col justify-between gap-4 border px-4 py-4 md:gap-0 md:px-5 lg:flex-row"
      data-testid="navbar"
    >
      <div className="hidden min-w-0 w-full items-center justify-between gap-4 overflow-hidden lg:flex">
        <CategoryNavbar
          categories={categories}
          parentCategories={parentCategories}
        />
        <div
          className="ml-auto w-full max-w-[296px] shrink-0 pl-4"
          data-testid="navbar-search-desktop"
        >
          <NavbarSearch />
        </div>
      </div>
      <div
        className="w-full max-w-[296px] lg:hidden"
        data-testid="navbar-search-mobile"
      >
        <NavbarSearch className="max-w-[296px]" />
      </div>
    </div>
  );
};
