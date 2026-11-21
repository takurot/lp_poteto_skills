import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { schema, validate } from "../../site/content/schema.mjs";
import { LOCALES, fixtureContentDir, repoRoot } from "./helpers/build.mjs";

const SITE_CONTENT_DIR = path.join(repoRoot, "site/content");

function readContent(dir, locale) {
  return JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8"));
}

function keyPaths(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => keyPaths(item, `${prefix}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => {
      const childPath = prefix ? `${prefix}.${key}` : key;
      return [childPath, ...keyPaths(child, childPath)];
    });
  }
  return [];
}

describe("site content", () => {
  for (const locale of LOCALES) {
    test(`${locale}.json matches the schema`, () => {
      assert.deepEqual(validate(readContent(SITE_CONTENT_DIR, locale), schema), []);
    });
  }

  test("G3: en.json and ja.json have the same key set, recursively", () => {
    const [en, ja] = LOCALES.map((locale) => new Set(keyPaths(readContent(SITE_CONTENT_DIR, locale))));
    assert.deepEqual([...en].filter((key) => !ja.has(key)), [], "keys only in en.json");
    assert.deepEqual([...ja].filter((key) => !en.has(key)), [], "keys only in ja.json");
  });

  test("SPEC §2 numbers and the decided hero heading", () => {
    for (const locale of LOCALES) {
      const content = readContent(SITE_CONTENT_DIR, locale);
      assert.deepEqual(
        content.numbers.map((item) => item.value),
        ["110", "2", "22", "0.15.46"],
        `${locale} numbers`,
      );
      assert.equal(content.codex.plugins.length, 22, `${locale} lists 22 Codex plugins`);
      assert.ok(!content.codex.plugins.includes("codex-hooks"), "codex-hooks is not one of the 22");
      assert.equal(content.hero.heading, "pstack for Codex");
    }
  });

  for (const locale of LOCALES) {
    test(`test fixture ${locale}.json matches the schema`, () => {
      assert.deepEqual(validate(readContent(fixtureContentDir, locale), schema), []);
    });
  }
});

describe("validate()", () => {
  const sample = {
    t: "object",
    fields: {
      title: { t: "string", max: 5 },
      count: { t: "number" },
      tags: { t: "array", of: { t: "string" }, min: 1, max: 2 },
      rows: { t: "array", of: { t: "object", fields: { from: { t: "string" } } } },
    },
  };
  const valid = { title: "ok", count: 3, tags: ["a"], rows: [{ from: "x" }] };

  test("accepts a conforming value", () => {
    assert.deepEqual(validate(valid, sample), []);
  });

  test("reports missing and unknown keys with their paths", () => {
    const { title, ...withoutTitle } = valid;
    assert.deepEqual(validate({ ...withoutTitle, extra: 1 }, sample), ["title: missing key", "extra: unknown key"]);
  });

  test("reports wrong types, including null and arrays standing in for objects", () => {
    assert.deepEqual(validate({ ...valid, title: 5, count: "3", tags: "a", rows: [null] }, sample), [
      "title: expected string, got number",
      "count: expected number, got string",
      "tags: expected array, got string",
      "rows[0]: expected object, got null",
    ]);
    assert.deepEqual(validate([], sample), ["(root): expected object, got array"]);
  });

  test("rejects non-finite numbers", () => {
    assert.deepEqual(validate({ ...valid, count: Number.NaN }, sample), ["count: expected number, got NaN"]);
  });

  test("reports string length and array size limits", () => {
    assert.deepEqual(validate({ ...valid, title: "toolong", tags: [] }, sample), [
      "title: length 7 exceeds max 5",
      "tags: expected at least 1 items, got 0",
    ]);
    assert.deepEqual(validate({ ...valid, tags: ["a", "b", "c"] }, sample), ["tags: expected at most 2 items, got 3"]);
  });

  test("qualifies errors inside arrays of objects", () => {
    assert.deepEqual(validate({ ...valid, rows: [{ from: "x" }, { to: "y" }] }, sample), [
      "rows[1].from: missing key",
      "rows[1].to: unknown key",
    ]);
  });

  test("measures string length in code points", () => {
    assert.deepEqual(validate({ ...valid, title: "日本語です" }, sample), []);
    assert.deepEqual(validate({ ...valid, title: "😀😀😀😀😀" }, sample), []);
  });
});
