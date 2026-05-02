// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml — Story v160-4-7 anti-Booksy whitelist', () => {
  it('AC5(a) preserves allowed formatting tags (<p>, <strong>)', () => {
    const out = sanitizeHtml('<p>Hello <strong>world</strong></p>');
    expect(out).toContain('<p>');
    expect(out).toContain('<strong>world</strong>');
    expect(out).toContain('Hello');
  });

  it('AC5(b) strips <script> tag entirely', () => {
    const out = sanitizeHtml('<p>Safe</p><script>alert(1)</script>');
    expect(out).toContain('<p>Safe</p>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('AC5(c) strips inline event handler attributes (on*)', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">click me</p>');
    expect(out).toContain('<p>');
    expect(out).toContain('click me');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('AC5(d) blocks javascript: URLs in <a href>', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out).not.toContain('alert(1)');
  });

  it('AC5(e) strips <iframe> entirely', () => {
    const out = sanitizeHtml('<iframe src="https://evil.example.com"></iframe>');
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out.toLowerCase()).not.toContain('evil.example.com');
  });

  it('AC5(f) tolerates null / undefined / empty inputs without throwing', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('AC5(g) enforces rel="noopener noreferrer" on every <a> with href', () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('href="https://example.com"');
  });

  it('AC2 strips forbidden tags: object, embed, form, input, style, link, meta, base, svg, math', () => {
    const inputs = [
      '<object data="x.swf"></object>',
      '<embed src="x.swf">',
      '<form action="evil"><input name="x"></form>',
      '<style>body{display:none}</style>',
      '<link rel="stylesheet" href="evil.css">',
      '<meta http-equiv="refresh">',
      '<base href="https://evil.com">',
      '<svg><script>alert(1)</script></svg>',
      '<math><mtext>x</mtext></math>',
    ];
    for (const input of inputs) {
      const out = sanitizeHtml(input).toLowerCase();
      expect(out).not.toMatch(/<(object|embed|form|input|style|link|meta|base|svg|math)\b/);
    }
  });

  it('AC2 strips data: and vbscript: URI schemes in href', () => {
    const dataOut = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>').toLowerCase();
    expect(dataOut).not.toContain('data:text/html');
    const vbOut = sanitizeHtml('<a href="vbscript:msgbox(1)">x</a>').toLowerCase();
    expect(vbOut).not.toContain('vbscript:');
  });

  it('AC2 preserves http, https, mailto, tel schemes in <a href>', () => {
    const httpsOut = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(httpsOut).toContain('href="https://example.com"');
    const mailtoOut = sanitizeHtml('<a href="mailto:test@example.com">x</a>');
    expect(mailtoOut).toContain('href="mailto:test@example.com"');
    const telOut = sanitizeHtml('<a href="tel:+48123456789">x</a>');
    expect(telOut).toContain('href="tel:+48123456789"');
  });

  it('AC2 preserves nested allowed structure (lists + emphasis)', () => {
    const out = sanitizeHtml(
      '<ul><li><em>Massage</em></li><li><strong>Manicure</strong></li></ul>',
    );
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
    expect(out).toContain('<em>Massage</em>');
    expect(out).toContain('<strong>Manicure</strong>');
  });
});
