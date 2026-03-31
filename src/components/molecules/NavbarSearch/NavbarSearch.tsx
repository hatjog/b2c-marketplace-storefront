'use client';

import { useState } from 'react';

import clsx from 'clsx';
import { redirect, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/atoms/Input/Input';
import { SearchIcon } from '@/icons';

interface Props {
  className?: string;
  submitPath?: string;
  searchParam?: string;
}

export const NavbarSearch = ({
  className,
  submitPath = '/categories',
  searchParam = 'query',
}: Props) => {
  const t = useTranslations('navigation');
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get(searchParam) || '');

  const handleSearch = () => {
    if (search) {
      redirect(`${submitPath}?${searchParam}=${search}`);
    } else {
      redirect(submitPath);
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
