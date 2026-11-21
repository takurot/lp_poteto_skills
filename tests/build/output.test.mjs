import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import {
  TEST_SITE_URL,
  buildOrThrow,
  hashTree,
  makeTempDir,
  readFixtureContent,
  readOut,
  repoRoot,
  runBuild,
  writeContentDir,
} from "./helpers/build.mjs";
import { anchors, linksByRel, metaContent, tags, textOf } from "./helpers/html.mjs";

const GITHUB_URL = "https://github.com/takurot/poteto-skills";
const PAGES = [
  { locale: "en", file: "index.html", url: `${TEST_SITE_URL}/` },
  { locale: "ja", file: "ja/index.html", url: `${TEST_SITE_URL}/ja/` },
];
const EXPECTED_ALTERNATES = [
  { hreflang: "en", href: `${TEST_SITE_URL}/` },
  { hreflang: "ja", href: `${TEST_SITE_URL}/ja/` },
  { hreflang: "x-default", href: `${TEST_SITE_URL}/` },
];

function assertDocumentShell(html, lang) {
  assert.match(html, /^<!doctype html>\n/i, "starts with the HTML5 doctype");
  assert.deepEqual(
    tags(html, "html").map((attrs) => attrs.lang),
    [lang],
    "one <html> element with the page language",
  );
  assert.equal(tags(html, "head").length, 1, "exactly one <head>");
  assert.equal(tags(html, "body").length, 1, "exactly one <body>");
  assert.ok(html.indexOf("</head>") < html.search(/<body[\s>]/), "<body> comes after </head>");
  assert.deepEqual(
    tags(html, "meta").filter((attrs) => "charset" in attrs).map((attrs) => attrs.charset.toLowerCase()),
    ["utf-8"],
    "one utf-8 charset declaration",
  );
  assert.match(metaContent(html, "viewport"), /width=device-width/);
  assert.deepEqual(
    linksByRel(html, "stylesheet").map((attrs) => attrs.href),
    ["/style.css"],
    "links the shared stylesheet",
  );
}

describe("built locale pages", () => {
  const outDir = makeTempDir(after);
  before(() => {
    buildOrThrow({ outDir });
  });

  for (const page of PAGES) {
    describe(page.file, () => {
      const content = readFixtureContent(page.locale);
      let html;
      before(() => {
        html = readOut(outDir, page.file);
      });

      test("G1/F1: document shell, language, title and description", () => {
        assertDocumentShell(html, page.locale);
        assert.deepEqual(textOf(html, "title"), [content.meta.title]);
        assert.equal(metaContent(html, "description"), content.meta.description);
      });

      test("F2: absolute canonical and hreflang alternates for every locale", () => {
        assert.deepEqual(
          linksByRel(html, "canonical").map((attrs) => attrs.href),
          [page.url],
        );
        const alternates = linksByRel(html, "alternate").map(({ hreflang, href }) => ({ hreflang, href }));
        assert.deepEqual(alternates, EXPECTED_ALTERNATES);
      });

      test("F6: Open Graph and Twitter Card tags with absolute URLs", () => {
        assert.equal(metaContent(html, "og:title"), content.meta.og.title);
        assert.equal(metaContent(html, "og:description"), content.meta.og.description);
        assert.equal(metaContent(html, "og:url"), page.url);
        assert.equal(metaContent(html, "og:image"), `${TEST_SITE_URL}/og.png`);
        assert.equal(metaContent(html, "og:type"), "website");
        assert.equal(metaContent(html, "twitter:card"), "summary_large_image");
      });

      test("F3: the hero CTA links to the GitHub repository", () => {
        const cta = anchors(html).filter((anchor) => anchor.text === content.hero.ctaLabel);
        assert.deepEqual(
          cta.map((anchor) => anchor.href),
          [GITHUB_URL],
        );
      });

      test("F1: language switch links to the other locale", () => {
        const other = PAGES.find((candidate) => candidate.locale !== page.locale);
        const otherPath = new URL(other.url).pathname;
        const switchLinks = tags(html, "a").filter((attrs) => attrs.href === otherPath && attrs.hreflang === other.locale);
        assert.equal(switchLinks.length, 1, `one <a href="${otherPath}" hreflang="${other.locale}">`);
      });

      test("renders the hero heading as the only <h1>", () => {
        assert.deepEqual(textOf(html, "h1"), [content.hero.heading]);
      });
    });
  }

  test("G7: build/404.html is written directly, not as 404/index.html", () => {
    assert.ok(fs.existsSync(path.join(outDir, "404.html")), "build/404.html exists");
    assert.ok(!fs.existsSync(path.join(outDir, "404")), "no build/404/ directory");
    const html = readOut(outDir, "404.html");
    assertDocumentShell(html, "en");
    const en = readFixtureContent("en");
    assert.deepEqual(textOf(html, "title"), [en.notFound.title]);
  });

  test("F5: the 404 page has one h1, both languages' message, and a single Primary link home", () => {
    const html = readOut(outDir, "404.html");
    const [en, ja] = ["en", "ja"].map(readFixtureContent);
    assert.deepEqual(textOf(html, "h1"), [en.notFound.title]);
    assert.equal(tags(html, "main").length, 1);
    const links = tags(html, "a");
    assert.equal(links.length, 1, "exactly one link");
    assert.equal(links[0].href, "/");
    assert.ok(links[0].class.split(" ").includes("btn-primary"));
    const [link] = anchors(html);
    assert.ok(link.text.includes(en.notFound.linkLabel) && link.text.includes(ja.notFound.linkLabel), "the link is labelled in both languages");
    const jaBlock = tags(html, "p").filter((attrs) => attrs.lang === "ja");
    assert.equal(jaBlock.length, 1, "the Japanese message is marked lang=ja");
    assert.ok(textOf(html, "p").some((text) => text.includes(ja.notFound.title) && text.includes(ja.notFound.message)));
    assert.doesNotMatch(html, /<script/i, "the 404 page needs no script");
  });
});

describe("build configuration", () => {
  test("a trailing slash in SITE_URL does not produce a double slash", (t) => {
    const outDir = makeTempDir(t.after.bind(t));
    buildOrThrow({ outDir, siteUrl: `${TEST_SITE_URL}/` });
    const html = readOut(outDir, "ja/index.html");
    assert.deepEqual(
      linksByRel(html, "canonical").map((attrs) => attrs.href),
      [`${TEST_SITE_URL}/ja/`],
    );
  });

  test("an OUT_DIR that would delete a build input fails the build", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const contentDir = writeContentDir(path.join(workDir, "content"), { en: readFixtureContent("en"), ja: readFixtureContent("ja") });
    const before = hashTree(workDir);
    const result = runBuild({ contentDir, outDir: workDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OUT_DIR/);
    assert.deepEqual(hashTree(workDir), before, "content directory left intact");
  });

  test("an OUT_DIR inside the repository but outside build/ and temp/ fails the build", (t) => {
    const outDir = path.join(repoRoot, "site", "out-dir-guard-probe");
    t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
    const result = runBuild({ outDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OUT_DIR/);
    assert.ok(!fs.existsSync(outDir), "output directory was created");
  });

  test("an OUT_DIR inside STATIC_DIR fails the build", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const staticDir = path.join(workDir, "static");
    fs.mkdirSync(staticDir);
    fs.writeFileSync(path.join(staticDir, "robots.txt"), "User-agent: *\n");
    const outDir = path.join(staticDir, "out");
    const result = runBuild({ outDir, staticDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OUT_DIR/);
    assert.ok(!fs.existsSync(outDir), "output directory was created");
  });

  test("a missing STATIC_DIR fails with a readable message, not a stack trace", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const result = runBuild({ outDir: path.join(workDir, "out"), staticDir: path.join(workDir, "no-such-static") });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no-such-static/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  });

  test("a SITE_URL that is not an absolute http(s) URL fails the build", (t) => {
    const outDir = makeTempDir(t.after.bind(t));
    fs.writeFileSync(path.join(outDir, "index.html"), "previous build");
    const before = hashTree(outDir);
    const result = runBuild({ outDir, siteUrl: "not a url" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SITE_URL/);
    assert.deepEqual(hashTree(outDir), before, "existing build output is left untouched");
  });
});
