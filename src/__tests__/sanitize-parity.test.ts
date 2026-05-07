// @vitest-environment jsdom
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import sanitizeHtml from 'sanitize-html';
import { describe, it, expect } from 'vitest';

const { window } = new JSDOM('');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any);

// Parity config: no transformTags — tests allowlist behavior only.
// (Production SanitizedHTML.tsx adds rel/target via transformTags; DOMPurify has no equivalent.)
const SANITIZE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4'],
  allowedAttributes: {
    'a': ['href'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
};

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4'],
  ALLOWED_ATTR: ['href'],
};

function normalize(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

const testCorpus = [
  // 1. Plain text (passthrough)
  'Hello world',
  // 2. Allowed formatting tags
  '<p>Opis <strong>salonu</strong> z <em>usługami</em>.</p>',
  // 3. Anchor link with transformation
  '<p>Więcej na <a href="https://example.com">stronie</a>.</p>',
  // 4. Nested list
  '<ul><li>Masaż</li><li>Manicure</li></ul>',
  // 5. XSS payload — both must strip completely
  '<p>OK</p><script>alert("xss")</script><img src=x onerror="alert(1)" />',
];

describe('sanitize-html vs DOMPurify allowlist parity (AC3)', () => {
  it('produces identical output for all 5 corpus items', () => {
    for (const input of testCorpus) {
      const sanitizeHtmlOutput = normalize(sanitizeHtml(input, SANITIZE_HTML_OPTIONS));
      const domPurifyOutput = normalize(purify.sanitize(input, DOMPURIFY_CONFIG));
      expect(sanitizeHtmlOutput).toBe(domPurifyOutput);
    }
  });

  it('strips XSS payload: script tag and onerror attribute removed', () => {
    const xssInput = '<p>OK</p><script>alert("xss")</script><img src=x onerror="alert(1)" />';
    const sanitizeHtmlOutput = sanitizeHtml(xssInput, SANITIZE_HTML_OPTIONS);
    const domPurifyOutput = purify.sanitize(xssInput, DOMPURIFY_CONFIG);
    expect(sanitizeHtmlOutput).toBe('<p>OK</p>');
    expect(normalize(domPurifyOutput)).toBe('<p>OK</p>');
  });

  it('adds rel and target to anchor links (production SanitizedHTML config)', () => {
    const productionConfig: sanitizeHtml.IOptions = {
      allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4'],
      allowedAttributes: { 'a': ['href', 'rel', 'target'] },
      allowedSchemes: ['https', 'http', 'mailto', 'tel'],
      transformTags: {
        'a': (tagName: string, attribs: Record<string, string>) => {
          const isTelOrMailto = /^(tel|mailto):/.test(attribs.href ?? '');
          return {
            tagName,
            attribs: {
              ...attribs,
              rel: 'noopener noreferrer',
              ...(isTelOrMailto ? {} : { target: '_blank' }),
            },
          };
        },
      },
    };
    const out = sanitizeHtml('<a href="https://example.com">link</a>', productionConfig);
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it('does not add target="_blank" to tel: and mailto: links', () => {
    const productionConfig: sanitizeHtml.IOptions = {
      allowedTags: ['a'],
      allowedAttributes: { 'a': ['href', 'rel', 'target'] },
      allowedSchemes: ['https', 'http', 'mailto', 'tel'],
      transformTags: {
        'a': (tagName: string, attribs: Record<string, string>) => {
          const isTelOrMailto = /^(tel|mailto):/.test(attribs.href ?? '');
          return {
            tagName,
            attribs: {
              ...attribs,
              rel: 'noopener noreferrer',
              ...(isTelOrMailto ? {} : { target: '_blank' }),
            },
          };
        },
      },
    };
    const telOut = sanitizeHtml('<a href="tel:+48123456789">Call</a>', productionConfig);
    expect(telOut).toContain('rel="noopener noreferrer"');
    expect(telOut).not.toContain('target="_blank"');

    const mailtoOut = sanitizeHtml('<a href="mailto:test@example.com">Email</a>', productionConfig);
    expect(mailtoOut).not.toContain('target="_blank"');
  });
});
