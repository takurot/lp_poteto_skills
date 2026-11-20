import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildOrThrow, fixtureStaticDir, hashTree, listFiles, makeTempDir, runBuild } from "./helpers/build.mjs";

test("static files are copied byte-for-byte, keeping subdirectories", (t) => {
  const outDir = makeTempDir(t.after.bind(t));
  buildOrThrow({ outDir });
  const built = hashTree(outDir);
  for (const rel of ["robots.txt", "nested/asset.txt"]) {
    assert.equal(built[rel], hashTree(fixtureStaticDir)[rel], `${rel} copied unchanged`);
  }
});

test("dotfiles in the static directory are not published", (t) => {
  const outDir = makeTempDir(t.after.bind(t));
  buildOrThrow({ outDir });
  assert.ok(fs.existsSync(path.join(fixtureStaticDir, ".gitkeep")), "fixture has a dotfile");
  assert.deepEqual(
    listFiles(outDir).filter((rel) => rel.split("/").some((part) => part.startsWith("."))),
    [],
  );
});

test("a static file that collides with a generated page fails the build and writes nothing", (t) => {
  const workDir = makeTempDir(t.after.bind(t));
  const staticDir = path.join(workDir, "static");
  fs.mkdirSync(path.join(staticDir, "ja"), { recursive: true });
  fs.writeFileSync(path.join(staticDir, "ja/index.html"), "hand-written page");
  const outDir = path.join(workDir, "out");

  const result = runBuild({ outDir, staticDir });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ja\/index\.html/);
  assert.ok(!fs.existsSync(outDir), "output directory was created");
});
