import sanitizeHtml from 'sanitize-html';

const ALLOWLIST: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4'],
  allowedAttributes: {
    'a': ['href', 'rel', 'target'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  transformTags: {
    'a': sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank',
    }),
  },
};

interface Props {
  html: string | null | undefined;
  className?: string;
}

export function SanitizedHTML({ html, className }: Props) {
  if (!html) return null;
  const clean = sanitizeHtml(html, ALLOWLIST);

  // eslint-disable-next-line no-restricted-syntax -- this is the ONE allowed use; sanitize-html has already cleaned the input
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
