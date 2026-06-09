export type SellerLineItemMetadata = {
  selected_seller_id: string;
  selected_seller_name: string;
  selected_seller_handle?: string;
};

export type VendorOfferProjectionMetadata = {
  desc?: string | null;
  media?: unknown[] | null;
  custom_duration?: number | null;
  notes?: string | null;
};

export const buildSellerLineItemMetadata = ({
  selectedSellerId,
  selectedSellerName,
  selectedSellerHandle,
}: {
  selectedSellerId?: string | null;
  selectedSellerName?: string | null;
  selectedSellerHandle?: string | null;
}): SellerLineItemMetadata | undefined => {
  if (!selectedSellerId || !selectedSellerName) {
    return undefined;
  }

  return {
    selected_seller_id: selectedSellerId,
    selected_seller_name: selectedSellerName,
    ...(selectedSellerHandle ? { selected_seller_handle: selectedSellerHandle } : {}),
  };
};

export const isVendorOfferProjectionInactive = (
  projection?: VendorOfferProjectionMetadata | null,
): boolean => {
  if (!projection) {
    return true;
  }

  return (
    projection.desc == null &&
    projection.media == null &&
    projection.custom_duration == null &&
    projection.notes == null
  );
};
