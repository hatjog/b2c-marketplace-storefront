import type { PayloadLocale } from '@/lib/blog-locale';
import type { SupportedLocale } from '@/i18n/routing';

export type BlogLocale = SupportedLocale;

export type BlogTag = {
  slug: string;
  label: string;
};

export type BlogAuthor = {
  name: string;
  role: string;
  bio: string;
  avatar?: string | null;
  profileUrl?: string | null;
  socialUrl?: string | null;
  socialLabel?: string | null;
};

export type BlogInlineText = {
  type: 'text';
  text: string;
};

export type BlogInlineLink = {
  type: 'link';
  text: string;
  href: string;
  external?: boolean;
};

export type BlogInlineMark = {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'inline-code';
  text: string;
};

export type BlogInlineReference = {
  type: 'reference';
  footnoteId: string;
  label: string;
};

export type BlogInlineNode = BlogInlineLink | BlogInlineMark | BlogInlineReference | BlogInlineText;

export type BlogParagraphNode = {
  type: 'paragraph';
  content: BlogInlineNode[];
};

export type BlogHeadingNode = {
  type: 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4';
  text: string;
};

export type BlogListNode = {
  type: 'ordered-list' | 'unordered-list';
  items: BlogInlineNode[][];
};

export type BlogBlockquoteNode = {
  type: 'blockquote';
  quote: string;
  citation?: string;
};

export type BlogPullQuoteNode = {
  type: 'pull-quote';
  quote: string;
  attribution?: string;
};

export type BlogInlineEmbedNode = {
  type: 'inline-embed';
  title: string;
  href: string;
  description: string;
};

export type BlogImageNode = {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
};

export type BlogVideoNode = {
  type: 'video';
  src: string;
  title: string;
  poster?: string;
  caption?: string;
};

export type BlogDividerNode = {
  type: 'divider';
};

export type BlogTableNode = {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
};

export type BlogIframeNode = {
  type: 'embedded-iframe';
  src: string;
  title: string;
};

export type BlogFootnoteNode = {
  type: 'footnote';
  id: string;
  label: string;
  content: string;
};

export type BlogRichTextNode =
  | BlogBlockquoteNode
  | BlogDividerNode
  | BlogFootnoteNode
  | BlogHeadingNode
  | BlogIframeNode
  | BlogImageNode
  | BlogInlineEmbedNode
  | BlogListNode
  | BlogParagraphNode
  | BlogPullQuoteNode
  | BlogTableNode
  | BlogVideoNode;

export type TocEntry = {
  id: string;
  label: string;
  level: 2 | 3 | 4;
};

export type BlogPostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  category: string;
  href: string;
  tags: BlogTag[];
  author: BlogAuthor;
  readTimeMinutes: number;
  publishedAt: string | null;
  /**
   * QD-I18N-04 / CAP-4 — set when the card's copy comes from
   * `market.locales.default` instead of the requested locale. Non-null means the
   * surface MUST show a fallback notice and mark the fragment with `lang`;
   * it must never be rendered as if it were a translation.
   */
  contentFallbackLocale?: PayloadLocale | null;
};

export type BlogPost = BlogPostCard;

export type BlogPostDetail = BlogPostCard & {
  heroImage: string;
  heroImageAlt: string;
  updatedAt?: string | null;
  content: BlogRichTextNode[];
  relatedPosts: BlogPostCard[];
};

export type BlogIndexData = {
  posts: BlogPostCard[];
  availableTags: BlogTag[];
  selectedTag: string | null;
};
