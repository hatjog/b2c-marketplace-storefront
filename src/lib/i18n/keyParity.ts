export type MessageLeaf = string | number | boolean | null;
export type MessageNode = MessageLeaf | { [key: string]: MessageNode } | MessageNode[];
export type MessageCatalog = { [key: string]: MessageNode };

export interface LocaleCatalog {
  locale: string;
  messages: MessageCatalog;
}

export interface MissingLocaleKey {
  locale: string;
  key: string;
}

export interface KeyParityReport {
  locales: string[];
  keyCount: number;
  missing: MissingLocaleKey[];
}

export function flattenMessageKeys(messages: MessageCatalog): string[] {
  const keys: string[] = [];

  function visit(node: MessageNode, prefix: string): void {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [segment, child] of Object.entries(node)) {
        if (segment === '_review' && prefix === '') continue;
        const next = prefix ? `${prefix}.${segment}` : segment;
        visit(child, next);
      }
      return;
    }

    if (prefix) {
      keys.push(prefix);
    }
  }

  visit(messages, '');
  return keys.sort();
}

export function compareMessageKeyParity(catalogs: LocaleCatalog[]): KeyParityReport {
  const keysByLocale = new Map<string, Set<string>>();
  const allKeys = new Set<string>();

  for (const catalog of catalogs) {
    const keys = new Set(flattenMessageKeys(catalog.messages));
    keysByLocale.set(catalog.locale, keys);

    for (const key of keys) {
      allKeys.add(key);
    }
  }

  const sortedAllKeys = [...allKeys].sort();
  const missing: MissingLocaleKey[] = [];

  for (const catalog of catalogs) {
    const localeKeys = keysByLocale.get(catalog.locale) ?? new Set<string>();
    for (const key of sortedAllKeys) {
      if (!localeKeys.has(key)) {
        missing.push({ locale: catalog.locale, key });
      }
    }
  }

  return {
    locales: catalogs.map(catalog => catalog.locale),
    keyCount: sortedAllKeys.length,
    missing
  };
}

export function formatKeyParityReport(report: KeyParityReport): string {
  if (report.missing.length === 0) {
    return `i18n key parity OK: ${report.locales.join(', ')} share ${report.keyCount} keys`;
  }

  const lines = [
    `i18n key parity failed: ${report.missing.length} missing locale keys across ${report.locales.join(', ')}`,
  ];

  for (const item of report.missing) {
    lines.push(`- ${item.locale}: ${item.key}`);
  }

  return lines.join('\n');
}

