import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildOrThrow, hashTree, listFiles, makeTempDir } from "./helpers/build.mjs";

// A clock-derived value with one-second resolution would otherwise match across back-to-back builds.
function waitForNextSecond() {
  const start = Math.floor(Date.now() / 1000);
  while (Math.floor(Date.now() / 1000) === start) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
}

test("G4: two builds of the same input produce byte-identical trees", (t) => {
  const workDir = makeTempDir(t.after.bind(t));
  const first = path.join(workDir, "first");
  const second = path.join(workDir, "second");
  buildOrThrow({ outDir: first, extraEnv: { TZ: "UTC" } });
  waitForNextSecond();
  buildOrThrow({ outDir: second, extraEnv: { TZ: "Asia/Tokyo" } });

  const firstTree = hashTree(first);
  assert.ok(Object.keys(firstTree).length > 0, "build produced files");
  assert.deepEqual(hashTree(second), firstTree);
});

test("G4: rebuilding into the same directory converges to the same tree", (t) => {
  const outDir = makeTempDir(t.after.bind(t));
  buildOrThrow({ outDir });
  const firstTree = hashTree(outDir);
  fs.writeFileSync(path.join(outDir, "stale.html"), "left over from an older build");
  buildOrThrow({ outDir });
  assert.deepEqual(hashTree(outDir), firstTree, "stale files removed, everything else identical");
});

test("generated HTML uses LF newlines only", (t) => {
  const outDir = makeTempDir(t.after.bind(t));
  buildOrThrow({ outDir });
  const html = listFiles(outDir).filter((rel) => rel.endsWith(".html"));
  assert.ok(html.length >= 3, "index, ja and 404 pages exist");
  for (const rel of html) {
    assert.ok(!fs.readFileSync(path.join(outDir, rel), "utf8").includes("\r"), `${rel} contains CR`);
  }
});
