const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function stripHtml(html: string): string {
  const stripped = html.replace(/<[^>]*>/g, '');
  return stripped.replace(/&(?:[a-z]+|#\d+);/gi, (entity) => {
    if (entity in NAMED_ENTITIES) return NAMED_ENTITIES[entity];
    const numericMatch = entity.match(/^&#(\d+);$/);
    if (numericMatch) return String.fromCharCode(parseInt(numericMatch[1], 10));
    return entity;
  });
}
