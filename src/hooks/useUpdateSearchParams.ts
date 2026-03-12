import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const useUpdateSearchParams = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const updateSearchParams = (field: string, value: string | null) => {
    const updatedSearchParams = new URLSearchParams(searchParams.toString());
    if (!value) {
      updatedSearchParams.delete(field);
    } else {
      updatedSearchParams.set(field, value);
    }

    // Reset to page 1 whenever any filter changes (except pagination itself)
    if (field !== 'page') {
      updatedSearchParams.delete('page');
    }

    router.push(`${pathname}?${updatedSearchParams}`, {
      scroll: false
    });
  };

  return updateSearchParams;
};

export default useUpdateSearchParams;
