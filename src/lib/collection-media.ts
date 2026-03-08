import type { HttpTypes } from '@medusajs/types';

type StoreCollectionWithMetadata = HttpTypes.StoreCollection & {
  metadata?: Record<string, unknown> | null;
};

function getCollectionMetadata(collection: HttpTypes.StoreCollection | null | undefined) {
  const metadata = (collection as StoreCollectionWithMetadata | null | undefined)?.metadata;

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  return metadata;
}

export function getCollectionPhotoUrl(collection: HttpTypes.StoreCollection | null | undefined) {
  const metadata = getCollectionMetadata(collection);
  const directPhotoUrl = typeof metadata?.photo_url === 'string' ? metadata.photo_url.trim() : '';

  if (directPhotoUrl) {
    return directPhotoUrl;
  }

  const gpMetadata = metadata?.gp;
  if (!gpMetadata || typeof gpMetadata !== 'object' || Array.isArray(gpMetadata)) {
    return null;
  }

  const nestedPhotoUrl = typeof gpMetadata.photo_url === 'string' ? gpMetadata.photo_url.trim() : '';
  return nestedPhotoUrl || null;
}