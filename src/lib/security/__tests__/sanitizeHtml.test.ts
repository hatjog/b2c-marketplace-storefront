// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeHtml, ALLOWED_URI_REGEXP, SANITIZE_VERSION } from '../sanitizeHtml';

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

  it('AC2 preserves https: and mailto: schemes in <a href>', () => {
    const httpsOut = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(httpsOut).toContain('href="https://example.com"');
    const mailtoOut = sanitizeHtml('<a href="mailto:test@example.com">x</a>');
    expect(mailtoOut).toContain('href="mailto:test@example.com"');
    // tel: is not in canonical ALLOWED_URI_REGEXP (cleanup-15b: secure-by-default)
    // Use opts to add tel: at call site if needed for specific use cases.
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

describe('sanitizeHtml — Story v160-cleanup-4 bypass fixtures (CRIT-7.3 + HIGH-4.1)', () => {
  // ─── AC5(a): entity-encoded XSS ───────────────────────────────────────────
  it('strips entity-encoded <script> tag (CRIT-7.3)', () => {
    const out = sanitizeHtml('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips entity-encoded onerror attribute (CRIT-7.3)', () => {
    const out = sanitizeHtml('&lt;img src=x onerror="alert(1)"&gt;');
    expect(out).not.toContain('alert(1)');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  // ─── AC5(b): mXSS HTML comment bypass ─────────────────────────────────────
  it('strips HTML comments — mXSS prevention (CRIT-7.3)', () => {
    const out = sanitizeHtml('<!--<script>alert(1)//--><img src=x onerror=alert(1)>');
    expect(out).not.toContain('<!--');
    expect(out).not.toContain('-->');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips IE conditional comments (CRIT-7.3)', () => {
    const out = sanitizeHtml('<!--[if lt IE 9]><script>alert(1)</script><![endif]-->');
    expect(out).not.toContain('<!--');
    expect(out.toLowerCase()).not.toContain('alert');
  });

  // ─── AC5(c): formaction on anchor ─────────────────────────────────────────
  it('strips formaction from <a> (CRIT-7.3)', () => {
    const out = sanitizeHtml('<a formaction="javascript:alert(1)" href="https://example.com">click</a>');
    expect(out.toLowerCase()).not.toContain('formaction');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('href="https://example.com"');
  });

  // ─── AC5(d): title= phishing + mixed-case javascript href ─────────────────
  it('strips title from <a> — URL-shadow phishing prevention (HIGH-4.1)', () => {
    const out = sanitizeHtml('<a title="https://evil.com" href="https://safe.com">click</a>');
    expect(out.toLowerCase()).not.toContain('title=');
  });

  it('neutralises javascript: href with mixed-case attributes (HIGH-4.1)', () => {
    const out = sanitizeHtml('<a TITLE="x" HREF="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out.toLowerCase()).not.toContain('title=');
  });

  // ─── AC6: ALLOWED_URI_REGEXP ───────────────────────────────────────────────
  it('ALLOWED_URI_REGEXP rejects javascript:', () => {
    expect(ALLOWED_URI_REGEXP.test('javascript:alert(1)')).toBe(false);
  });

  it('ALLOWED_URI_REGEXP rejects data:', () => {
    expect(ALLOWED_URI_REGEXP.test('data:text/html,payload')).toBe(false);
  });

  it('ALLOWED_URI_REGEXP rejects vbscript:', () => {
    expect(ALLOWED_URI_REGEXP.test('vbscript:msgbox(1)')).toBe(false);
  });

  it('ALLOWED_URI_REGEXP rejects file:', () => {
    expect(ALLOWED_URI_REGEXP.test('file:///etc/passwd')).toBe(false);
  });

  it('ALLOWED_URI_REGEXP allows https:', () => {
    expect(ALLOWED_URI_REGEXP.test('https://example.com')).toBe(true);
  });

  it('ALLOWED_URI_REGEXP allows mailto:', () => {
    expect(ALLOWED_URI_REGEXP.test('mailto:test@example.com')).toBe(true);
  });

  it('ALLOWED_URI_REGEXP allows slash-anchored relative paths and fragments', () => {
    expect(ALLOWED_URI_REGEXP.test('/relative/path')).toBe(true);
    expect(ALLOWED_URI_REGEXP.test('#anchor')).toBe(true);
    // schemeless paths without leading slash are rejected (cleanup-15b secure-by-default)
    expect(ALLOWED_URI_REGEXP.test('relative/path')).toBe(false);
  });

  // ─── SANITIZE_VERSION ─────────────────────────────────────────────────────
  it('SANITIZE_VERSION bumped to 15b-hardened', () => {
    expect(SANITIZE_VERSION).toContain('15b-hardened');
  });
});
