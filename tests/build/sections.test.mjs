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

      // Each command is a <pre><code id> followed by a copy button that names it via aria-describedby.
      function assertCommandBlocks(markup, commands) {
        const codes = [...markup.matchAll(/<pre tabindex="0"><code id="([^"]+)">([\s\S]*?)<\/code><\/pre>/g)].map(([, id, text]) => ({
          id,
          text: textOf(`<x>${text}</x>`, "x")[0],
        }));
        assert.deepEqual(
          codes.map((code) => code.text),
          commands,
          "every command is a code block, in order",
        );
        const buttons = [...markup.matchAll(/<button(\s[^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrText, text]) => ({
          attrs: tags(`<button${attrText}>`, "button")[0],
          text,
        }));
        assert.equal(buttons.length, codes.length, "one copy button per command");
        buttons.forEach(({ attrs, text }, index) => {
          assert.equal(attrs.type, "button");
          assert.ok("hidden" in attrs, "hidden until copy.js shows it (F4)");
          assert.deepEqual(classes(attrs), ["btn", "btn-secondary", "btn-sm", "copy"]);
          assert.equal(attrs["aria-describedby"], codes[index].id, "names the command it copies");
          assert.equal(attrs["data-copied"], content.copy.copiedLabel);
          assert.equal(text, content.copy.buttonLabel);
        });
      }

      test("3 Install: clone and install commands, then labelled option examples, each copyable", () => {
        const install = section(html, "install");
        assert.deepEqual(textOf(install, "h2"), [content.install.heading]);
        assertCommandBlocks(install, [...content.install.commands, ...content.install.examples.map((example) => example.command)]);
        assert.deepEqual(
          withClass(install, "p", "note").length,
          content.install.examples.length,
        );
        const paragraphs = textOf(install, "p");
        for (const text of [content.install.intro, ...content.install.examples.map((example) => example.label), content.install.defaultSetNote]) {
          assert.ok(paragraphs.includes(text), text);
        }
      });

      test("4 Codex plugins: commands, plugin names as a labelled list, codex-hooks kept apart", () => {
        const codex = section(html, "codex");
        assert.deepEqual(textOf(codex, "h2"), [content.codex.heading]);
        assertCommandBlocks(codex, content.codex.commands);
        const [list] = withClass(codex, "ul", "chips");
        const labelId = list["aria-labelledby"];
        const label = innerOf(codex, "p", (attrs) => attrs.id === labelId);
        assert.equal(label, content.codex.pluginsLabel);
        assert.deepEqual(textOf(innerOf(codex, "ul", (attrs) => classes(attrs).includes("chips")), "li"), content.codex.plugins);
        assert.ok(textOf(codex, "p").includes(content.codex.codexHooksNote));
      });

      test("F4/CSP: copy.js is the only script, loaded from the same origin; no inline script, style or handlers", () => {
        assert.deepEqual(tags(html, "script"), [{ src: "/copy.js", defer: "" }]);
        assert.doesNotMatch(html, /<script(?:\s[^>]*)?>[^<]+<\/script>/, "no inline script body");
        assert.doesNotMatch(html, /\sstyle=/i, "no style attributes");
        assert.doesNotMatch(html, /<style[\s>]/i, "no <style> elements");
        assert.doesNotMatch(html, /\son[a-z]+=/i, "no inline event handlers");
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
