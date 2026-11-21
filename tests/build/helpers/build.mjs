import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const fixtureContentDir = path.join(repoRoot, "tests/build/fixtures/content");
export const fixtureStaticDir = path.join(repoRoot, "tests/build/fixtures/static");
export const TEST_SITE_URL = "https://lp.example.test";
export const LOCALES = ["en", "ja"];

const buildScript = path.join(repoRoot, "scripts/build.mjs");

// registerCleanup is node:test's `after`, or `t.after` bound to a test context.
export function makeTempDir(registerCleanup) {
  const base = path.join(repoRoot, "temp", "test-build");
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "run-"));
  registerCleanup(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function runBuild({ contentDir = fixtureContentDir, outDir, staticDir = fixtureStaticDir, siteUrl = TEST_SITE_URL, extraEnv = {} }) {
  const env = { ...process.env, ...extraEnv, CONTENT_DIR: contentDir, OUT_DIR: outDir, STATIC_DIR: staticDir, SITE_URL: siteUrl };
  return spawnSync(process.execPath, [buildScript], { env, encoding: "utf8" });
}

export function buildOrThrow(options) {
  const result = runBuild(options);
  if (result.status !== 0) {
    throw new Error(`build exited ${result.status}\n${result.stderr}`);
  }
  return result;
}

export function readFixtureContent(locale) {
  return JSON.parse(fs.readFileSync(path.join(fixtureContentDir, `${locale}.json`), "utf8"));
}

export function writeContentDir(dir, contents) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [locale, value] of Object.entries(contents)) {
    fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify(value, null, 2));
  }
  return dir;
}

export function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

export function hashTree(dir) {
  return Object.fromEntries(
    listFiles(dir).map((rel) => [rel, createHash("sha256").update(fs.readFileSync(path.join(dir, rel))).digest("hex")]),
  );
}

export function readOut(outDir, rel) {
  return fs.readFileSync(path.join(outDir, rel), "utf8");
}
