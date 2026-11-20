import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { LOCALES, hashTree, makeTempDir, readFixtureContent, runBuild, writeContentDir } from "./helpers/build.mjs";

function fixtureContents() {
  return Object.fromEntries(LOCALES.map((locale) => [locale, readFixtureContent(locale)]));
}

function withPreviousBuild(workDir) {
  const outDir = path.join(workDir, "out");
  fs.mkdirSync(path.join(outDir, "ja"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), "previous build");
  fs.writeFileSync(path.join(outDir, "ja/index.html"), "previous build ja");
  return outDir;
}

function assertRejected({ contentDir, workDir, stderrPatterns }) {
  const outDir = withPreviousBuild(workDir);
  const before = hashTree(outDir);
  const result = runBuild({ contentDir, outDir });
  assert.notEqual(result.status, 0, "build exits non-zero");
  for (const pattern of stderrPatterns) {
    assert.match(result.stderr, pattern);
  }
  assert.deepEqual(hashTree(outDir), before, "existing build output is left untouched");
  assert.ok(!fs.existsSync(`${outDir}.staging`), "staging directory was created");
}

const MUTATIONS = [
  {
    name: "a missing required key",
    mutate: (contents) => {
      delete contents.en.hero.heading;
    },
    stderrPatterns: [/en\.json\b.*hero\.heading.*missing/i],
  },
  {
    name: "an unknown key",
    mutate: (contents) => {
      contents.ja.hero.tagline = "not in the schema";
    },
    stderrPatterns: [/ja\.json\b.*hero\.tagline.*unknown/i],
  },
  {
    name: "a wrong type inside an array item",
    mutate: (contents) => {
      contents.en.numbers[0].value = 110;
    },
    stderrPatterns: [/en\.json\b.*numbers\[0\]\.value.*string/],
  },
  {
    name: "a missing nested object",
    mutate: (contents) => {
      delete contents.ja.meta.og;
    },
    stderrPatterns: [/ja\.json\b.*meta\.og.*missing/i],
  },
];

describe("G5: invalid content exits non-zero and writes nothing", () => {
  for (const { name, mutate, stderrPatterns } of MUTATIONS) {
    test(name, (t) => {
      const workDir = makeTempDir(t.after.bind(t));
      const contents = fixtureContents();
      mutate(contents);
      const contentDir = writeContentDir(path.join(workDir, "content"), contents);
      assertRejected({ contentDir, workDir, stderrPatterns });
    });
  }

  test("malformed JSON", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const contentDir = writeContentDir(path.join(workDir, "content"), fixtureContents());
    fs.writeFileSync(path.join(contentDir, "en.json"), '{ "meta": ');
    assertRejected({ contentDir, workDir, stderrPatterns: [/en\.json/] });
  });

  test("a missing locale file", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const contentDir = writeContentDir(path.join(workDir, "content"), { en: readFixtureContent("en") });
    assertRejected({ contentDir, workDir, stderrPatterns: [/ja\.json/] });
  });

  test("does not create the output directory when it did not exist", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const contents = fixtureContents();
    delete contents.en.footer;
    const contentDir = writeContentDir(path.join(workDir, "content"), contents);
    const outDir = path.join(workDir, "never-created");
    const result = runBuild({ contentDir, outDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /footer/);
    assert.ok(!fs.existsSync(outDir), "output directory was created");
    assert.ok(!fs.existsSync(`${outDir}.staging`), "staging directory was created");
  });
});
