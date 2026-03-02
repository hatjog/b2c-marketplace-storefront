import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Dynamic import required: static ESM linking runs before tsx transforms .ts files (Node 22)
const { getImageUrl, isSectionObject, mapButtons } = await import("../src/components/blocks/homepage-utils.ts");

const root = process.cwd();

const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
};

// SOURCE-BASED: wiring/config check — intentional per tech-spec
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
    assert.match(source, new RegExp(`case\\s+['"]${blockType}['"]`));
  }
});

test("HeroBlock: maps buttons url -> path and filters invalid entries", () => {
  // SOURCE-BASED: wiring/config check — mapButtons extracted to homepage-utils.ts per tech-spec
  const source = read("src/components/blocks/homepage-utils.ts");

  assert.match(source, /if\s*\(!button\?\.label\s*\|\|\s*!button\.url\)/);
  assert.match(source, /path:\s*button\.url/);
});

test("HeroBlock: uses section data (heading/paragraph/image/buttons)", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  assert.match(source, /const heading = section\.heading \?\? ['"]['"]/)
  assert.match(source, /const paragraph = section\.paragraph \?\? ['"]['"]/);
  assert.match(source, /const imageUrl = getImageUrl\(section\.image\)/);
  assert.match(source, /const buttons = mapButtons\(section\.buttons\)/);
});

test("HeroBlock: when image available, renders Hero section (which uses next/image)", () => {
  const heroBlock = read("src/components/blocks/HeroBlock.tsx");
  const heroSection = read("src/components/sections/Hero/Hero.tsx");

  assert.match(heroBlock, /import \{ Hero \} from ['"]@\/components\/sections['"]/);
  assert.match(heroBlock, /if \(imageUrl\) \{/);
  assert.match(heroBlock, /<Hero[\s\S]*image=\{imageUrl\}/);

  assert.match(heroSection, /import Image from ['"]next\/image['"]/);
  assert.match(heroSection, /<Image/);
});

test("HeroBlock: missing image does not crash and logs error", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  assert.match(source, /if \(section\.image == null\) \{/);
  assert.match(source, /console\.error\(['"\[homepage\] hero image is missing or invalid['"]/);

  // Defensive: HeroBlock does not directly render next/image in fallback.
  assert.doesNotMatch(source, /from ['"]next\/image['"]/);
  assert.doesNotMatch(source, /<Image/);
});

// RUNTIME: business logic tests — pure functions from homepage-utils.ts
describe("homepage-utils runtime", () => {
  // getImageUrl
  test("getImageUrl: null/undefined input -> null", () => {
    assert.strictEqual(getImageUrl(null), null);
    assert.strictEqual(getImageUrl(undefined), null);
  });

  test("getImageUrl: string input -> returns string", () => {
    assert.strictEqual(getImageUrl("http://example.com/img.jpg"), "http://example.com/img.jpg");
  });

  test("getImageUrl: object with url property -> returns url", () => {
    assert.strictEqual(getImageUrl({ url: "http://example.com/img.jpg" }), "http://example.com/img.jpg");
  });

  test("getImageUrl: object without url or null url -> null", () => {
    assert.strictEqual(getImageUrl({}), null);
    assert.strictEqual(getImageUrl({ url: null }), null);
  });

  // mapButtons
  test("mapButtons: null/undefined -> empty array", () => {
    assert.deepStrictEqual(mapButtons(null), []);
    assert.deepStrictEqual(mapButtons(undefined), []);
  });

  test("mapButtons: empty array -> empty array", () => {
    assert.deepStrictEqual(mapButtons([]), []);
  });

  test("mapButtons: valid entries -> mapped to {label, path}", () => {
    const result = mapButtons([{ label: "Shop", url: "/shop", variant: "primary" }]);
    assert.deepStrictEqual(result, [{ label: "Shop", path: "/shop" }]);
  });

  test("mapButtons: entries with missing label or url filtered out", () => {
    assert.deepStrictEqual(mapButtons([{ label: null, url: "/x" }]), []);
    assert.deepStrictEqual(mapButtons([{ label: "btn", url: null }]), []);
  });

  test("mapButtons: mixed valid/invalid -> only valid returned", () => {
    const buttons = [
      { label: "Valid", url: "/valid" },
      { label: null, url: "/invalid" },
    ];
    assert.deepStrictEqual(mapButtons(buttons), [{ label: "Valid", path: "/valid" }]);
  });

  // isSectionObject
  test("isSectionObject: null -> false", () => {
    assert.strictEqual(isSectionObject(null), false);
  });

  test("isSectionObject: primitive -> false", () => {
    assert.strictEqual(isSectionObject("string"), false);
    assert.strictEqual(isSectionObject(42), false);
  });

  test("isSectionObject: plain object -> true", () => {
    assert.strictEqual(isSectionObject({ blockType: "hero" }), true);
    assert.strictEqual(isSectionObject({}), true);
  });
});
