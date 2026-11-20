import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { buildOrThrow, makeTempDir, readOut, repoRoot } from "./helpers/build.mjs";
import { parseRules, readStyle } from "./helpers/css.mjs";
import { tags } from "./helpers/html.mjs";

const FONTS_DIR = path.join(repoRoot, "site/static/fonts");

// SPEC §7: exactly these faces, nothing else.
const FACES = [
  { family: "Archivo Black", weight: "400", file: "archivo-black-latin-400-normal.woff2", license: "OFL-ArchivoBlack.txt" },
  { family: "Work Sans", weight: "400", file: "work-sans-latin-400-normal.woff2", license: "OFL-WorkSans.txt" },
  { family: "Work Sans", weight: "500", file: "work-sans-latin-500-normal.woff2", license: "OFL-WorkSans.txt" },
  { family: "Work Sans", weight: "700", file: "work-sans-latin-700-normal.woff2", license: "OFL-WorkSans.txt" },
  { family: "Space Mono", weight: "400", file: "space-mono-latin-400-normal.woff2", license: "OFL-SpaceMono.txt" },
];
const FIRST_VIEW = ["/fonts/archivo-black-latin-400-normal.woff2", "/fonts/work-sans-latin-400-normal.woff2"];

describe("self-hosted fonts (SPEC §4, §7, F7)", () => {
  test("site/static/fonts holds exactly the five woff2 faces, each a real WOFF2 file", () => {
    const woff2 = fs.readdirSync(FONTS_DIR).filter((name) => name.endsWith(".woff2")).sort();
    assert.deepEqual(woff2, FACES.map((face) => face.file).sort());
    for (const { file } of FACES) {
      const bytes = fs.readFileSync(path.join(FONTS_DIR, file));
      assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", `${file} has the WOFF2 signature`);
    }
  });

  test("each family ships its SIL Open Font License text", () => {
    for (const license of new Set(FACES.map((face) => face.license))) {
      const text = fs.readFileSync(path.join(FONTS_DIR, license), "utf8");
      assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/, license);
    }
  });

  test("style.css declares one same-origin @font-face per face with font-display: swap", () => {
    const faces = parseRules(readStyle())
      .filter((rule) => rule.selectors[0] === "@font-face")
      .map((rule) => Object.fromEntries(rule.declarations.map(({ property, value }) => [property, value])));
    const summary = faces.map((face) => ({
      family: face["font-family"].replace(/["']/g, ""),
      weight: face["font-weight"],
      src: face.src,
      display: face["font-display"],
      style: face["font-style"],
    }));
    assert.deepEqual(
      summary,
      FACES.map(({ family, weight, file }) => ({
        family,
        weight,
        src: `url("/fonts/${file}") format("woff2")`,
        display: "swap",
        style: "normal",
      })),
    );
  });
});

describe("font preload", () => {
  const outDir = makeTempDir(after);
  before(() => buildOrThrow({ outDir }));

  for (const file of ["index.html", "ja/index.html"]) {
    test(`${file} preloads only the two first-view fonts, same-origin, with crossorigin`, () => {
      const preloads = tags(readOut(outDir, file), "link").filter((attrs) => attrs.rel === "preload");
      assert.deepEqual(
        preloads,
        FIRST_VIEW.map((href) => ({ rel: "preload", href, as: "font", type: "font/woff2", crossorigin: "" })),
      );
      for (const href of FIRST_VIEW) {
        assert.ok(fs.existsSync(path.join(repoRoot, "site/static", href)), `${href} exists in site/static`);
      }
    });
  }
});
