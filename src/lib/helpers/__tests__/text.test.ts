import { describe, expect, it } from 'vitest';

import { stripHtml } from '../text';

describe('stripHtml', () => {
  // T3.2 — strips HTML tags
  it('strips <p> tags', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world');
  });

  it('strips <strong> tags', () => {
    expect(stripHtml('<strong>Bold</strong>')).toBe('Bold');
  });

  it('strips <a href="..."> tags', () => {
    expect(stripHtml('<a href="https://example.com">link</a>')).toBe('link');
  });

  it('strips self-closing tags', () => {
    expect(stripHtml('Line one<br/>Line two')).toBe('Line oneLine two');
  });

  // T3.3 — named entities
  it('decodes &amp;', () => {
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('decodes &nbsp;', () => {
    expect(stripHtml('Hello&nbsp;World')).toBe('Hello World');
  });

  it('decodes &lt; and &gt;', () => {
    expect(stripHtml('&lt;div&gt;')).toBe('<div>');
  });

  it('decodes &quot;', () => {
    expect(stripHtml('She said &quot;hello&quot;')).toBe('She said "hello"');
  });

  it('decodes &#39;', () => {
    expect(stripHtml("It&#39;s fine")).toBe("It's fine");
  });

  it('decodes &apos;', () => {
    expect(stripHtml("Don&apos;t")).toBe("Don't");
  });

  // T3.4 — numeric entities
  it('decodes &#160; (non-breaking space) as regular space', () => {
    expect(stripHtml('Hello&#160;World')).toBe('Hello World');
  });

  it('decodes &#38; (ampersand)', () => {
    expect(stripHtml('A&#38;B')).toBe('A&B');
  });

  // T3.5 — edge cases
  it('returns empty string unchanged', () => {
    expect(stripHtml('')).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(stripHtml('Just plain text')).toBe('Just plain text');
  });

  it('handles mixed HTML tags and entities', () => {
    expect(stripHtml('<p>Hello &amp; <strong>World</strong></p>')).toBe('Hello & World');
  });
});

// T3.6 — stripHtml called with the same input getBlogDescription would receive
describe('stripHtml — T3.6 mixed tag+entity (getBlogDescription contract)', () => {
  it('strips <em> and decodes &amp; from excerpt', () => {
    // getBlogDescription wraps stripHtml; server-only import prevents direct test here —
    // testing the pure function with representative getBlogDescription input instead.
    const result = stripHtml('<em>Fresh</em> &amp; Natural');
    expect(result).toBe('Fresh & Natural');
  });
});
