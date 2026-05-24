import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderLegalMarkdown } from '../legal/renderLegalMarkdown';

function render(md: string): string {
  const nodes = renderLegalMarkdown(md);
  // Wrap so renderToStaticMarkup accepts an array
  return renderToStaticMarkup(<>{nodes}</>);
}

describe('renderLegalMarkdown', () => {
  it('renders h1, h2, h3', () => {
    const html = render('# H1\n\n## H2\n\n### H3\n');
    expect(html).toContain('<h1');
    expect(html).toContain('>H1<');
    expect(html).toContain('<h2');
    expect(html).toContain('>H2<');
    expect(html).toContain('<h3');
    expect(html).toContain('>H3<');
  });

  it('renders paragraphs', () => {
    const html = render('First paragraph.\n\nSecond paragraph.\n');
    expect(html).toContain('First paragraph.');
    expect(html).toContain('Second paragraph.');
  });

  it('renders unordered lists', () => {
    const html = render('- one\n- two\n- three\n');
    expect(html).toContain('<ul');
    expect(html).toContain('>one<');
    expect(html).toContain('>two<');
    expect(html).toContain('>three<');
  });

  it('renders ordered lists', () => {
    const html = render('1. one\n2. two\n');
    expect(html).toContain('<ol');
    expect(html).toContain('>one<');
    expect(html).toContain('>two<');
  });

  it('renders bold inline', () => {
    const html = render('A **bold** word.\n');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders code inline', () => {
    const html = render('Use `npm install`.\n');
    expect(html).toContain('<code');
    expect(html).toContain('npm install');
  });

  it('renders fenced code blocks', () => {
    const html = render('```\nexport default fn;\n```\n');
    expect(html).toContain('<pre');
    expect(html).toContain('export default fn;');
  });

  it('renders blockquotes', () => {
    const html = render('> a quote line\n> second line\n');
    expect(html).toContain('<blockquote');
    expect(html).toContain('a quote line');
  });

  it('renders GFM tables', () => {
    const html = render(
      '| H1 | H2 |\n|---|---|\n| a | b |\n| c | d |\n'
    );
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('>H1<');
    expect(html).toContain('>a<');
    expect(html).toContain('>d<');
  });

  it('renders horizontal rule', () => {
    const html = render('Text\n\n---\n\nMore\n');
    expect(html).toContain('<hr');
  });

  it('is safe against script tags (raw text passthrough)', () => {
    // The renderer does not allow HTML — script tag should appear as text
    const html = render('<script>alert(1)</script>\n');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
