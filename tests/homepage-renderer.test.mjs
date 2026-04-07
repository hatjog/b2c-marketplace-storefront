import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Dynamic import required: static ESM linking runs before tsx transforms .ts files (Node 22)
const {
  getImageUrl,
  getBannerSectionData,
  getStyleSectionData,
  isSectionObject,
  mapButtons,
  normalizeStyleSectionItems,
} = await import("../src/components/blocks/homepage-utils.ts");
const { BannerBlock } = await import("../src/components/blocks/BannerBlock.tsx");
const { HeroBlock } = await import("../src/components/blocks/HeroBlock.tsx");
const { StyleSectionBlock } = await import("../src/components/blocks/StyleSectionBlock.tsx");
const { BannerSection } = await import("../src/components/sections/BannerSection/BannerSection.tsx");
const { ShopByStyleSection } = await import("../src/components/sections/ShopByStyle/ShopByStyleSection.tsx");

const root = process.cwd();

const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
};

const isElement = value => Boolean(value && typeof value === "object" && "props" in value);

const flattenChildren = children => {
  if (Array.isArray(children)) {
    return children.flatMap(flattenChildren);
  }

  return children == null ? [] : [children];
};

const collectPropValues = (node, propName) => {
  if (Array.isArray(node)) {
    return node.flatMap(item => collectPropValues(item, propName));
  }

  if (!isElement(node)) {
    return [];
  }

  const ownValue = node.props?.[propName] == null ? [] : [node.props[propName]];
  return ownValue.concat(collectPropValues(flattenChildren(node.props?.children), propName));
};

const collectText = node => {
  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (typeof node === "string") {
    return [node];
  }

  if (!isElement(node)) {
    return [];
  }

  return collectText(flattenChildren(node.props?.children));
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

test("HeroBlock: maps buttons url/path -> path and filters invalid entries", () => {
  // SOURCE-BASED: wiring/config check — mapButtons extracted to homepage-utils.ts per tech-spec
  const source = read("src/components/blocks/homepage-utils.ts");

  assert.match(source, /const href = button\?\.url \?\? button\?\.path/);
  assert.match(source, /if \(!button\?\.label \|\| !href\)/);
  assert.match(source, /path:\s*href/);
});

test("HeroBlock: uses section data (heading/paragraph/image/buttons)", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  assert.match(source, /const heading = section\.heading \?\? ['"]['"]/)
  assert.match(source, /const paragraph = section\.paragraph \?\? ['"]['"]/);
  assert.match(source, /const imageUrl = getImageUrl\(section\.image/);
  assert.match(source, /const buttons = mapButtons\(section\.buttons\)/);
});

test("HeroBlock: when image available, renders Hero section (which uses next/image)", () => {
  const heroBlock = read("src/components/blocks/HeroBlock.tsx");
  const heroSection = read("src/components/sections/Hero/Hero.tsx");

  assert.match(heroBlock, /import \{ Hero \} from ['"]@\/components\/sections\/Hero\/Hero['"]/);
  assert.match(heroBlock, /if \(imageUrl\) \{/);
  assert.match(heroBlock, /<Hero[\s\S]*image=\{imageUrl\}/);

  assert.match(heroSection, /import Image from ['"]next\/image['"]/);
  assert.match(heroSection, /<Image/);
});

test("HeroBlock: missing image uses fallback via getImageUrl", () => {
  const source = read("src/components/blocks/HeroBlock.tsx");

  // getImageUrl handles null image with a fallback path
  assert.match(source, /getImageUrl\(section\.image,\s*['"][^'"]+['"]/);

  // Defensive: HeroBlock does not directly render next/image in fallback.
  assert.doesNotMatch(source, /from ['"]next\/image['"]/);
  assert.doesNotMatch(source, /<Image/);
});

// Task 3 — data-driven blocks and null guards

test("BannerBlock: maps payload data to BannerSection props at runtime", () => {
  const element = BannerBlock({
    section: {
      heading: "Featured collection",
      subheading: "Curated picks for spring",
      label: "Explore collection",
      cta_link: "/collections/spring",
      image: { url: "https://cdn.example.com/banner.jpg" },
    },
  });

  assert.ok(element);
  assert.equal(element.type, BannerSection);
  assert.equal(element.props.heading, "Featured collection");
  assert.equal(element.props.subheading, "Curated picks for spring");
  assert.equal(element.props.label, "Explore collection");
  assert.equal(element.props.ctaLink, "/collections/spring");
  assert.equal(element.props.imageUrl, "https://cdn.example.com/banner.jpg");
});

test("BannerBlock: returns null when CTA data is missing", () => {
  const element = BannerBlock({
    section: {
      heading: "Featured collection",
      subheading: "Curated picks for spring",
      label: "",
      cta_link: "/collections/spring",
    },
  });

  assert.equal(element, null);
});

test("StyleSectionBlock: maps payload items to ShopByStyleSection props at runtime", () => {
  const element = StyleSectionBlock({
    section: {
      heading: "Shop by style",
      items: [
        { label: "Minimal edit", link: "/collections?style=minimal" },
        {
          label: "Weekend layers",
          link: "/collections?style=weekend",
          image: { url: "https://cdn.example.com/style.jpg" },
        },
      ],
    },
  });

  assert.ok(element);
  assert.equal(element.type, ShopByStyleSection);
  assert.equal(element.props.heading, "Shop by style");
  assert.equal(element.props.items.length, 2);
  assert.deepStrictEqual(element.props.items[0], {
    href: "/collections?style=minimal",
    imageUrl: "/images/placeholder.svg",
    label: "Minimal edit",
  });
  assert.deepStrictEqual(element.props.items[1], {
    href: "/collections?style=weekend",
    imageUrl: "https://cdn.example.com/style.jpg",
    label: "Weekend layers",
  });
});

test("StyleSectionBlock: returns null when there are no valid items", () => {
  const element = StyleSectionBlock({
    section: {
      heading: "Shop by style",
      items: [{ label: "Missing link" }],
    },
  });

  assert.equal(element, null);
});

test("HeroBlock: renders fallback image when all content fields are empty but fallback exists", () => {
  const element = HeroBlock({
    section: {
      heading: "",
      paragraph: "",
      image: null,
      buttons: [],
    },
  });

  // With hardcoded fallback image, HeroBlock still renders (graceful degradation)
  assert.ok(element, "HeroBlock should render with fallback image even when content is empty");
});

test("BannerSection: renders payload label, href and image props", () => {
  const element = BannerSection({
    heading: "Featured collection",
    subheading: "Curated picks for spring",
    imageUrl: "https://cdn.example.com/banner.jpg",
    label: "Explore collection",
    ctaLink: "/collections/spring",
  });

  const texts = collectText(element);
  const hrefs = collectPropValues(element, "href");
  const srcs = collectPropValues(element, "src");

  assert.ok(texts.includes("Featured collection"));
  assert.ok(texts.includes("Curated picks for spring"));
  assert.ok(texts.includes("Explore collection"));
  assert.ok(hrefs.includes("/collections/spring"));
  assert.ok(srcs.includes("https://cdn.example.com/banner.jpg"));
});

test("ShopByStyleSection: renders runtime items instead of hardcoded styles", async () => {
  const element = await ShopByStyleSection({
    heading: "Shop by style",
    items: [
      { href: "/collections?style=minimal", imageUrl: null, label: "Minimal edit" },
      {
        href: "/collections?style=weekend",
        imageUrl: "https://cdn.example.com/style.jpg",
        label: "Weekend layers",
      },
    ],
  });

  const texts = collectText(element);
  const hrefs = collectPropValues(element, "href");
  const srcs = collectPropValues(element, "src");

  assert.ok(texts.includes("Shop by style"));
  assert.ok(texts.includes("Minimal edit"));
  assert.ok(texts.includes("Weekend layers"));
  assert.ok(hrefs.includes("/collections?style=minimal"));
  assert.ok(hrefs.includes("/collections?style=weekend"));
  assert.ok(srcs.includes("https://cdn.example.com/style.jpg"));
  assert.ok(!texts.includes("LUXURY"));
});

// Task 4 — regression: dynamic blocks return null on empty data

test("ProductsCarouselBlock: returns null when products array is empty", () => {
  const source = read("src/components/blocks/ProductsCarouselBlock.tsx");
  assert.match(source, /if\s*\(products\.length\s*===\s*0\)\s*\{\s*\n\s*return null/);
});

test("CategoriesGridBlock: renders HomeCategories even when fetched categories array is empty", () => {
  const source = read("src/components/blocks/CategoriesGridBlock.tsx");
  assert.match(source, /<HomeCategories/);
  assert.doesNotMatch(source, /if\s*\(categories\.length\s*===\s*0\)\s*\{\s*\n\s*return null/);
});

test("BlogSectionBlock: renders BlogSection even when fetched posts array is empty", () => {
  const source = read("src/components/blocks/BlogSectionBlock.tsx");
  assert.match(source, /<BlogSection/);
  assert.doesNotMatch(source, /if\s*\(posts\.length\s*===\s*0\)\s*\{\s*\n\s*return null/);
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

  test("mapButtons: legacy path field is accepted for backward compatibility", () => {
    const result = mapButtons([{ label: "Shop", path: "/shop" }]);
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

  test("getBannerSectionData: returns null when CTA metadata is incomplete", () => {
    assert.equal(
      getBannerSectionData({
        heading: "Featured collection",
        subheading: "Curated picks",
        label: "",
        cta_link: "/collections",
      }),
      null,
    );
  });

  test("getBannerSectionData: maps image, text and CTA from payload", () => {
    assert.deepStrictEqual(
      getBannerSectionData({
        heading: "Featured collection",
        subheading: "Curated picks",
        image: { url: "https://cdn.example.com/banner.jpg" },
        label: "Explore collection",
        cta_link: "/collections",
      }),
      {
        heading: "Featured collection",
        subheading: "Curated picks",
        imageUrl: "https://cdn.example.com/banner.jpg",
        label: "Explore collection",
        ctaLink: "/collections",
      },
    );
  });

  test("normalizeStyleSectionItems: filters invalid items and keeps payload image urls", () => {
    assert.deepStrictEqual(
      normalizeStyleSectionItems([
        { label: "Minimal edit", link: "/collections?style=minimal" },
        { label: "", link: "/collections?style=broken" },
        {
          label: "Weekend layers",
          link: "/collections?style=weekend",
          image: { url: "https://cdn.example.com/style.jpg" },
        },
      ]),
      [
        {
          href: "/collections?style=minimal",
          imageUrl: null,
          label: "Minimal edit",
        },
        {
          href: "/collections?style=weekend",
          imageUrl: "https://cdn.example.com/style.jpg",
          label: "Weekend layers",
        },
      ],
    );
  });

  test("getStyleSectionData: returns null when no valid runtime items remain", () => {
    assert.equal(
      getStyleSectionData({
        heading: "Shop by style",
        items: [{ label: "Broken item", link: null }],
      }),
      null,
    );
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
