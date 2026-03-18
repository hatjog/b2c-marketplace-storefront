import { getTranslations } from 'next-intl/server';

import { ProductPageAccordion } from '@/components/molecules';

export const ProductPageDetails = async ({ details }: { details: string }) => {
  if (!details) return null;

  const t = await getTranslations('products');

  return (
    <ProductPageAccordion
      heading={t('description_heading')}
      defaultOpen={true}
      data-testid="product-details-section"
    >
      <div
        className="product-details"
        dangerouslySetInnerHTML={{
          __html: details
        }}
        data-testid="product-details-content"
      />
    </ProductPageAccordion>
  );
};
