import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import path from "node:path";
import { LOCALES, buildOrThrow, listFiles, makeTempDir, readFixtureContent, readOut, writeContentDir } from "./helpers/build.mjs";

const RAW_MARKUP = '<i data-probe="1">';

// Replaces every string leaf with a unique probe holding markup, quotes and an entity-looking literal.
function probeStrings(value, label, probes) {
  if (typeof value === "string") {
    const probe = `PROBE[${label}] ${RAW_MARKUP}'&amp;"</i>`;
    probes.push({ label, probe });
    return probe;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => probeStrings(item, `${label}[${index}]`, probes));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, probeStrings(child, `${label}.${key}`, probes)]));
  }
  return value;
}

const ESCAPED = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "(?:&#39;|&#x27;|&apos;)" };

function escapedPattern(probe) {
  const pattern = [...probe]
    .map((char) => ESCAPED[char] ?? char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("");
  return new RegExp(pattern);
}

describe("G2: every content string is HTML-escaped in the output", () => {
  const probes = [];
  const workDir = makeTempDir(after);
  const outDir = path.join(workDir, "out");
  let html;

  before(() => {
    const contents = Object.fromEntries(LOCALES.map((locale) => [locale, probeStrings(readFixtureContent(locale), locale, probes)]));
    const contentDir = writeContentDir(path.join(workDir, "content"), contents);
    buildOrThrow({ contentDir, outDir });
    html = listFiles(outDir)
      .filter((rel) => rel.endsWith(".html"))
      .map((rel) => readOut(outDir, rel))
      .join("\n");
  });

  test("no raw probe markup reaches any HTML file", () => {
    assert.ok(probes.length > 0, "fixture has string fields");
    assert.ok(!html.includes(RAW_MARKUP), "raw markup from content was emitted unescaped");
  });

  test("each string field (top level, nested objects, arrays) appears escaped", () => {
    const missing = probes.filter(({ probe }) => !escapedPattern(probe).test(html)).map(({ label }) => label);
    assert.deepEqual(missing, [], "content fields missing from the output or not escaped");
  });
});
