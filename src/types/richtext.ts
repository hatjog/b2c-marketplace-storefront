export type NonEmptyString = string & { readonly __brand: 'NonEmptyString' };

export type RichTextDocument = RichTextNode[];

export type RichTextNode =
  | RichTextParagraphNode
  | RichTextHeadingNode
  | RichTextListNode
  | RichTextListItemNode
  | RichTextQuoteNode
  | RichTextHorizontalRuleNode
  | RichTextImageNode
  | RichTextEmbedNode;

export type RichTextNodeType = RichTextNode['type'] | RichTextInlineMarkNode['type'];

export type RichTextInlineNode = RichTextTextNode | RichTextInlineMarkNode;

export type RichTextInlineMarkNode =
  | RichTextBoldNode
  | RichTextItalicNode
  | RichTextCodeNode
  | RichTextLinkNode;

export type RichTextTextNode = {
  text: string;
};

export type RichTextParagraphNode = {
  type: 'paragraph';
  children: RichTextInlineNode[];
};

export type RichTextHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type RichTextHeadingNode = {
  type: `heading-h${RichTextHeadingLevel}`;
  children: RichTextInlineNode[];
};

export type RichTextBoldNode = {
  type: 'bold';
  text: string;
};

export type RichTextItalicNode = {
  type: 'italic';
  text: string;
};

export type RichTextCodeNode = {
  type: 'code';
  text: string;
};

export type RichTextLinkNode = {
  type: 'link';
  href: string;
  text: string;
  external?: boolean;
  ariaLabel?: string;
};

export type RichTextListNode = {
  type: 'list-ordered' | 'list-unordered';
  children: RichTextListItemNode[];
};

export type RichTextListItemNode = {
  type: 'listitem';
  children: RichTextInlineNode[];
};

export type RichTextQuoteNode = {
  type: 'quote';
  children: RichTextInlineNode[];
  citation?: string;
};

export type RichTextHorizontalRuleNode = {
  type: 'hr';
};

export type RichTextImageNode = {
  type: 'image';
  src: string;
  alt: NonEmptyString;
  width?: number;
  height?: number;
  caption?: string;
};

export type RichTextEmbedProvider = 'youtube' | 'vimeo' | 'spotify';

export type RichTextEmbedNode = {
  type: 'embed';
  provider: RichTextEmbedProvider;
  src: string;
  title: NonEmptyString;
};
