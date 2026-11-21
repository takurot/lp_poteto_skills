import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, mock, test } from "node:test";
import { writeSite } from "../../scripts/site.mjs";
import { buildOrThrow, hashTree, makeTempDir, repoRoot, runBuild } from "./helpers/build.mjs";

const MARKER = ".build-output";

function assertRefused(result, outDir) {
  assert.notEqual(result.status, 0, "build exits non-zero");
  assert.match(result.stderr, /OUT_DIR/);
  assert.doesNotMatch(result.stderr, /\n\s+at /, "readable message, not a stack trace");
  assert.ok(!fs.existsSync(`${outDir}.staging`), "no staging directory left behind");
}

describe("OUT_DIR inside the repository", () => {
  test("temp/ itself is refused and its contents are left intact", (t) => {
    const tempDir = path.join(repoRoot, "temp");
    const sentinelDir = makeTempDir(t.after.bind(t));
    fs.writeFileSync(path.join(sentinelDir, "keep.txt"), "scratch work");
    const result = runBuild({ outDir: tempDir });
    assertRefused(result, tempDir);
    assert.equal(fs.readFileSync(path.join(sentinelDir, "keep.txt"), "utf8"), "scratch work");
  });

  test("a directory below build/ is refused", (t) => {
    const outDir = path.join(repoRoot, "build", "out-dir-guard-probe");
    t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
    const result = runBuild({ outDir });
    assertRefused(result, outDir);
    assert.ok(!fs.existsSync(outDir), "output directory was created");
  });
});

describe("writeSite only replaces directories it created", () => {
  test("a non-empty OUT_DIR without the marker is refused and untouched", (t) => {
    const outDir = makeTempDir(t.after.bind(t));
    fs.mkdirSync(path.join(outDir, "photos"));
    fs.writeFileSync(path.join(outDir, "photos/cat.jpg"), "not a build");
    const before = hashTree(outDir);
    const result = runBuild({ outDir });
    assertRefused(result, outDir);
    assert.match(result.stderr, /\.build-output/);
    assert.deepEqual(hashTree(outDir), before, "unrelated directory left untouched");
  });

  test("a non-empty <out>.staging without the marker is refused and untouched", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const outDir = path.join(workDir, "out");
    const staging = `${outDir}.staging`;
    fs.mkdirSync(staging);
    fs.writeFileSync(path.join(staging, "notes.txt"), "someone else's files");
    const before = hashTree(staging);
    const result = runBuild({ outDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\.staging/);
    assert.deepEqual(hashTree(staging), before, "unrelated staging directory left untouched");
    assert.ok(!fs.existsSync(outDir), "output directory was created");
  });

  test("an absent OUT_DIR is built and marked, and a rebuild replaces it without leftovers", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const outDir = path.join(workDir, "out");
    buildOrThrow({ outDir });
    assert.ok(fs.existsSync(path.join(outDir, MARKER)), "first build writes the marker");
    const first = hashTree(outDir);
    buildOrThrow({ outDir });
    assert.deepEqual(hashTree(outDir), first);
    assert.deepEqual(fs.readdirSync(workDir), ["out"], "no staging or previous directory left behind");
  });

  test("a failed swap restores the previous output", (t) => {
    const workDir = makeTempDir(t.after.bind(t));
    const outDir = path.join(workDir, "out");
    buildOrThrow({ outDir });
    const before = hashTree(outDir);

    const realRename = fs.renameSync;
    let calls = 0;
    mock.method(fs, "renameSync", (from, to) => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error("simulated rename failure"), { code: "EIO" });
      return realRename(from, to);
    });
    t.after(() => mock.restoreAll());

    assert.throws(() => writeSite(new Map([["index.html", "new build"]]), outDir), /simulated rename failure/);
    mock.restoreAll();
    assert.deepEqual(hashTree(outDir), before, "previous output restored");
    assert.ok(!fs.existsSync(`${outDir}.previous`), "no previous directory left behind");
  });
});
