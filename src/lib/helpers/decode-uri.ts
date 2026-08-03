export function safeDecodeURIComponent(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}