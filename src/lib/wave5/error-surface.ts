export type NotFoundVariant = 'generic' | 'product' | 'seller';
export type RuntimeErrorVariant = 'server-error' | 'service-unavailable' | 'offline';

export interface TechnicalDetailsPayload {
  requestId: string;
  timestampIso: string;
  suggestedAction: string;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.trim();
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  return '';
}

function readDigest(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'digest' in error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === 'string' && digest.trim().length > 0 ? digest : undefined;
  }

  return undefined;
}

export function resolveRuntimeErrorVariant(
  error: unknown,
  options: { offline?: boolean; forcedVariant?: RuntimeErrorVariant | null } = {}
): RuntimeErrorVariant {
  if (options.forcedVariant) {
    return options.forcedVariant;
  }

  if (options.offline) {
    return 'offline';
  }

  const haystack = readMessage(error).toLowerCase();
  if (
    haystack.includes('503') ||
    haystack.includes('service unavailable') ||
    haystack.includes('temporarily unavailable')
  ) {
    return 'service-unavailable';
  }

  return 'server-error';
}

export function buildTechnicalDetails(
  error: unknown,
  suggestedAction: string,
  now: Date = new Date()
): TechnicalDetailsPayload {
  const digest = readDigest(error);
  const requestId =
    digest ??
    `req-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    requestId,
    timestampIso: now.toISOString(),
    suggestedAction,
  };
}
