'use client';

import { useState } from 'react';

import clsx from 'clsx';
import { redirect, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/atoms';
import { SearchIcon } from '@/icons';

interface Props {
  className?: string;
}

export const NavbarSearch = ({ className }: Props) => {
  const t = useTranslations('navigation');
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('query') || '');

  const handleSearch = () => {
    if (search) {
      redirect(`/categories?query=${search}`);
    } else {
      redirect(`/categories`);
    }
  };

  const submitHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <form
      className={clsx('w-full', className)}
      method="POST"
      onSubmit={submitHandler}
    >
      <Input
        icon={<SearchIcon />}
        onIconClick={handleSearch}
        iconAriaLabel={t('search_aria')}
        placeholder={t('search_placeholder')}
        value={search}
        changeValue={setSearch}
        type="search"
      />
      <input
        type="submit"
        className="hidden"
      />
    </form>
  );
};
