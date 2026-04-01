const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#160;': ' ',
};

export function stripHtml(html: string): string {
  const stripped = html.replace(/<[^>]*>/g, '');
  return stripped.replace(/&(?:[a-z]+|#\d+);/gi, (entity) => {
    const key = entity.toLowerCase();
    if (key in NAMED_ENTITIES) return NAMED_ENTITIES[key];
    const numericMatch = entity.match(/^&#(\d+);$/i);
    if (numericMatch) return String.fromCodePoint(parseInt(numericMatch[1], 10));
    return entity;
  });
}
