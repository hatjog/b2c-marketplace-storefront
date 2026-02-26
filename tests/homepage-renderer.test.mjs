import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
};

test("HomepageRenderer: empty/null sections -> null", () => {
  const source = read("src/components/blocks/HomepageRenderer.tsx");

  assert.match(source, /sections\?:\s*unknown\[]\s*\|\s*null/);
  assert.match(source, /if\s*\(\s*!Array\.isArray\(sections\)\s*\|\|\s*sections\.length\s*===\s*0\s*\)\s*\{\s*\n\s*return null/);
});

test("HomepageRenderer: renders only enabled===true in original order", () => {
  const source = read("src/components/blocks/HomepageRenderer.tsx");

  assert.match(source, /sections\.filter\(/);
  assert.match(source, /section\.enabled\s*===\s*true/);
  assert.match(source, /enabledSections\.map\(/);

  // Order preservation: no sort/ordering logic before map.
  assert.doesNotMatch(source, /enabledSections\.sort\(/);
});

test("HomepageRenderer: unknown blockType does not crash (logs + returns null)", () => {
  const source = read("src/components/blocks/HomepageRenderer.tsx");

  assert.match(source, /default:\s*[\s\S]*console\.error\(/);
  assert.match(source, /default:\s*[\s\S]*return null/);
});

test("HomepageRenderer: supports expected blockType mapping", () => {
  const source = read("src/components/blocks/HomepageRenderer.tsx");

  for (const blockType of [
    "hero",
    "products_carousel",
    "categories_grid",
    "banner",
    "style_section",
    "blog_section",
  ]) {
    assert.match(source, new RegExp(`case\\s+\"${blockType}\"`));
  }
});

test("HeroBlock: maps buttons url -> path and filters invalid entries", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  assert.match(source, /if\s*\(!button\?\.label\s*\|\|\s*!button\.url\)/);
  assert.match(source, /path:\s*button\.url/);
});

test("HeroBlock: uses section data (heading/paragraph/image/buttons)", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  assert.match(source, /const heading = section\.heading \?\? \"\"/);
  assert.match(source, /const paragraph = section\.paragraph \?\? \"\"/);
  assert.match(source, /const imageUrl = getImageUrl\(section\.image\)/);
  assert.match(source, /const buttons = mapButtons\(section\.buttons\)/);
});

test("HeroBlock: when image available, renders Hero section (which uses next/image)", () => {
  const heroBlock = read("src/components/blocks/HeroBlock.tsx");
  const heroSection = read("src/components/sections/Hero/Hero.tsx");

  assert.match(heroBlock, /import \{ Hero \} from \"@\/components\/sections\"/);
  assert.match(heroBlock, /if \(imageUrl\) \{/);
  assert.match(heroBlock, /<Hero[\s\S]*image=\{imageUrl\}/);

  assert.match(heroSection, /import Image from \"next\/image\"/);
  assert.match(heroSection, /<Image/);
});

test("HeroBlock: missing image does not crash and logs error", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  assert.match(source, /if \(section\.image == null\) \{/);
  assert.match(source, /console\.error\(\"\[homepage\] hero image is missing or invalid\"/);

  // Defensive: HeroBlock does not directly render next/image in fallback.
  assert.doesNotMatch(source, /from \"next\/image\"/);
  assert.doesNotMatch(source, /<Image/);
});
