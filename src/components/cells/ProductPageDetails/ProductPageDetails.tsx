import { getTranslations } from 'next-intl/server';

import { ProductPageAccordion, SanitizedHTML } from '@/components/molecules';

export const ProductPageDetails = async ({ details }: { details: string }) => {
  if (!details) return null;

  const t = await getTranslations('products');

  return (
    <ProductPageAccordion
      heading={t('description_heading')}
      defaultOpen={true}
      data-testid="product-details-section"
    >
      <SanitizedHTML
        className="product-details"
        html={details}
      />
    </ProductPageAccordion>
  );
};
