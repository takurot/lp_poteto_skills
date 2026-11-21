import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { buildOrThrow, makeTempDir, repoRoot } from "./helpers/build.mjs";

const script = path.join(repoRoot, "scripts/check-size.mjs");
const runCheck = (dir) => spawnSync(process.execPath, [script, dir], { encoding: "utf8" });

test("the size check sums gzip bytes of every HTML and CSS file and ignores everything else", async (t) => {
  const { gzipSizes } = await import("../../scripts/check-size.mjs");
  const dir = makeTempDir(t.after.bind(t));
  fs.mkdirSync(path.join(dir, "ja"));
  fs.mkdirSync(path.join(dir, "fonts"));
  const html = "<!doctype html><title>x</title>".repeat(20);
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "ja/index.html"), html);
  fs.writeFileSync(path.join(dir, "style.css"), "a{color:red}");
  fs.writeFileSync(path.join(dir, "fonts/big.woff2"), randomBytes(100_000));
  fs.writeFileSync(path.join(dir, "copy.js"), "x".repeat(10));

  assert.deepEqual(gzipSizes(dir), {
    "index.html": gzipSync(html).length,
    "ja/index.html": gzipSync(html).length,
    "style.css": gzipSync("a{color:red}").length,
  });
});

test("the built site passes the 50KB HTML+CSS gzip budget", (t) => {
  const outDir = makeTempDir(t.after.bind(t));
  buildOrThrow({ outDir });
  const result = runCheck(outDir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /HTML\+CSS gzip total: \d+ bytes \(budget 51200\)/);
});

test("HTML+CSS over 50KB gzip fails the check and names the files", (t) => {
  const dir = makeTempDir(t.after.bind(t));
  fs.writeFileSync(path.join(dir, "index.html"), randomBytes(52_000).toString("base64"));
  fs.writeFileSync(path.join(dir, "style.css"), "a{}");
  const result = runCheck(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /over budget/);
  assert.match(result.stdout, /index\.html/);
});

test("a directory with no HTML fails instead of passing with a zero total", (t) => {
  const dir = makeTempDir(t.after.bind(t));
  assert.notEqual(runCheck(dir).status, 0);
  assert.notEqual(runCheck(path.join(dir, "missing")).status, 0);
});
