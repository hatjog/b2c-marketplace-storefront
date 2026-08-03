import { RichTextRenderer } from '@/components/rich-text';
import type { BlogRichTextNode } from '@/types/blog';

export function BlogRichText({
  content,
  slug,
  disallowedEmbedLabel,
  inlineEmbedLabel
}: {
  content: BlogRichTextNode[];
  slug: string;
  disallowedEmbedLabel: string;
  inlineEmbedLabel: string;
}) {
  return (
    <div data-testid="blog-post-richtext">
      <RichTextRenderer
        slug={slug}
        content={content}
        disallowedEmbedLabel={disallowedEmbedLabel}
        inlineEmbedLabel={inlineEmbedLabel}
      />
    </div>
  );
}