import type {
  NonEmptyString,
  RichTextDocument,
  RichTextEmbedProvider,
  RichTextInlineNode,
  RichTextNode,
  RichTextNodeType
} from '@/types/richtext';

const EMBED_HOST_ALLOWLIST: Record<RichTextEmbedProvider, ReadonlySet<string>> = {
  youtube: new Set(['www.youtube.com', 'youtube.com']),
  vimeo: new Set(['player.vimeo.com']),
  spotify: new Set(['open.spotify.com'])
};

// AC1 §20-node renderer: 18 dyskryminowane block/inline mark types + 2 leaf
// kategorie semantyczne (text, caption/citation) = 20 renderowanych wariantów.
// Patrz story §T1 — counting methodology amendment z 2026-05-27 (H-01 fix).
export const RICH_TEXT_NODE_TYPES = [
  'paragraph',
  'heading-h1',
  'heading-h2',
  'heading-h3',
  'heading-h4',
  'heading-h5',
  'heading-h6',
  'bold',
  'italic',
  'code',
  'link',
  'list-ordered',
  'list-unordered',
  'listitem',
  'quote',
  'hr',
  'image',
  'embed',
  'text',
  'caption'
] as const satisfies readonly RichTextNodeType[];

export function assertNonEmptyString(
  value: string,
  fieldName: string
): asserts value is NonEmptyString {
  if (!value.trim()) {
    throw new Error(`RichText ${fieldName} must be a non-empty string`);
  }
}

export function getPlainText(children: RichTextInlineNode[]) {
  return children.map(child => child.text).join('');
}

export function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('//');
}

export function isAllowedEmbedUrl(provider: RichTextEmbedProvider, src: string) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && EMBED_HOST_ALLOWLIST[provider].has(url.hostname);
  } catch {
    return false;
  }
}

export function collectRichTextNodeTypes(document: RichTextDocument) {
  const types = new Set<RichTextNodeType>();

  const collectInline = (children: RichTextInlineNode[]) => {
    for (const child of children) {
      if ('type' in child) {
        types.add(child.type);
      } else {
        types.add('text');
      }
    }
  };

  const collectNode = (node: RichTextNode) => {
    types.add(node.type);

    switch (node.type) {
      case 'paragraph':
      case 'heading-h1':
      case 'heading-h2':
      case 'heading-h3':
      case 'heading-h4':
      case 'heading-h5':
      case 'heading-h6':
      case 'quote':
      case 'listitem':
        collectInline(node.children);
        break;
      case 'list-ordered':
      case 'list-unordered':
        for (const item of node.children) {
          collectNode(item);
        }
        break;
      case 'image':
        if (node.caption) {
          types.add('caption');
        }
        break;
      case 'hr':
      case 'embed':
        break;
    }

    if (node.type === 'quote' && node.citation) {
      types.add('citation');
    }
  };

  for (const node of document) {
    collectNode(node);
  }

  return types;
}
