import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { buildOrThrow, makeTempDir, readFixtureContent, readOut } from "./helpers/build.mjs";
import { anchors, classes, innerOf, tags, textOf } from "./helpers/html.mjs";

const GITHUB_URL = "https://github.com/takurot/poteto-skills";
const PAGES = [
  { locale: "en", file: "index.html", path: "/" },
  { locale: "ja", file: "ja/index.html", path: "/ja/" },
];

const section = (html, id) => innerOf(html, "section", (attrs) => attrs.id === id);
const withClass = (html, tag, name) => tags(html, tag).filter((attrs) => classes(attrs).includes(name));

describe("page sections (SPEC §3)", () => {
  const outDir = makeTempDir(after);
  before(() => buildOrThrow({ outDir }));

  for (const page of PAGES) {
    describe(page.file, () => {
      const content = readFixtureContent(page.locale);
      const other = PAGES.find((candidate) => candidate.locale !== page.locale);
      let html;
      before(() => {
        html = readOut(outDir, page.file);
      });

      test("landmarks: one header, nav, main and footer", () => {
        for (const name of ["header", "nav", "main", "footer"]) {
          assert.equal(tags(html, name).length, 1, `one <${name}>`);
        }
      });

      test("0 Header: wordmark links home; a labelled nav holds the language switch and GitHub as Ghost buttons", () => {
        const header = innerOf(html, "header");
        assert.deepEqual(anchors(header)[0], { href: page.path, text: content.header.wordmark });
        assert.deepEqual(
          tags(header, "nav").map((attrs) => attrs["aria-label"]),
          [content.header.navLabel],
        );
        const nav = innerOf(header, "nav");
        assert.deepEqual(anchors(nav), [
          { href: other.path, text: content.header.languageSwitchLabel },
          { href: GITHUB_URL, text: content.header.githubLabel },
        ]);
        assert.ok(
          tags(nav, "a").every((attrs) => classes(attrs).includes("btn-ghost")),
          "nav links are Ghost buttons",
        );
      });

      test("1 Hero: overline, the h1 that carries the red underline, one-sentence lead, Primary CTA", () => {
        const hero = section(html, "hero");
        assert.deepEqual(textOf(hero, "p")[0], content.hero.overline);
        assert.equal(withClass(hero, "p", "overline").length, 1);
        assert.deepEqual(textOf(hero, "h1"), [content.hero.heading]);
        assert.deepEqual(
          tags(hero, "h1").map(classes),
          [["hero-title"]],
        );
        assert.equal(withClass(hero, "p", "lead").length, 1);
        assert.ok(textOf(hero, "p").includes(content.hero.lead));
        const cta = withClass(hero, "a", "btn-primary");
        assert.deepEqual(
          cta.map((attrs) => attrs.href),
          [GITHUB_URL],
        );
      });

      test("2 Numbers: a headed section with the four values as a ruled list", () => {
        const numbers = section(html, "numbers");
        assert.deepEqual(textOf(numbers, "h2"), [content.numbers.heading]);
        assert.equal(withClass(numbers, "ul", "stats").length, 1);
        assert.deepEqual(
          textOf(numbers, "li"),
          content.numbers.items.map(({ value, label }) => `${value} ${label}`),
        );
      });
    });
  }
});
