export const getPercentageDiff = (original: number, calculated: number) => {
  if (!original) return '0';
  const diff = original - calculated;
  const decrease = (diff / original) * 100;

  return decrease.toFixed();
};
