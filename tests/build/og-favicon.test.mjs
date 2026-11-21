import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { buildOrThrow, makeTempDir, readOut, repoRoot } from "./helpers/build.mjs";
import { linksByRel } from "./helpers/html.mjs";

const STATIC_DIR = path.join(repoRoot, "site/static");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// IHDR is always the first chunk: 4-byte length, "IHDR", then width and height as big-endian uint32.
function pngSize(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, "PNG signature");
  assert.equal(bytes.subarray(12, 16).toString("latin1"), "IHDR", "first chunk is IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("og.png (SPEC §4, F6)", () => {
  const bytes = fs.readFileSync(path.join(STATIC_DIR, "og.png"));

  test("is a 1200x630 PNG", () => {
    assert.deepEqual(pngSize(bytes), { width: 1200, height: 630 });
  });

  test("is a plausible size for a typography-only card: not blank, under 300KB", () => {
    assert.ok(bytes.length > 5_000, `${bytes.length} bytes looks blank`);
    assert.ok(bytes.length < 300_000, `${bytes.length} bytes is too large`);
  });
});

describe("favicon.svg (SPEC §4)", () => {
  const svg = fs.readFileSync(path.join(STATIC_DIR, "favicon.svg"), "utf8");

  test("is a standalone SVG document with a square viewBox", () => {
    assert.match(svg, /^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    const [, width, height] = svg.match(/viewBox="0 0 (\d+) (\d+)"/) ?? [];
    assert.ok(width && width === height, "square viewBox");
    assert.match(svg.trim(), /<\/svg>$/);
  });

  test("has no text, script, or external reference", () => {
    assert.doesNotMatch(svg, /<text|<script|<image|<foreignObject|href=|url\(|@import/i);
  });

  test("uses only the VoiceBox black and the accent red", () => {
    const colors = new Set([...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([color]) => color.toUpperCase()));
    assert.deepEqual([...colors].sort(), ["#0A0A0A", "#EF4444"]);
  });
});

describe("favicon link", () => {
  const outDir = makeTempDir(after);
  before(() => buildOrThrow({ outDir }));

  for (const file of ["index.html", "ja/index.html", "404.html"]) {
    test(`${file} links /favicon.svg as an SVG icon`, () => {
      assert.deepEqual(linksByRel(readOut(outDir, file), "icon"), [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }]);
    });
  }
});
