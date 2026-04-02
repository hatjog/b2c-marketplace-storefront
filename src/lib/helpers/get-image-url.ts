import { resolveMedusaBackendUrl } from '../env';

const LOCAL_MINIO_ORIGIN = 'http://localhost:9000/';

export const getImageUrl = (image: string) => {
  return image.replace(LOCAL_MINIO_ORIGIN, `${resolveMedusaBackendUrl()}/`);
};
