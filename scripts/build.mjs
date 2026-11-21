import path from "node:path";
import { PAGES } from "../site/pages.mjs";
import { BuildInputError, loadContents, renderSite, writeSite } from "./site.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

// Placeholder until Phase 3 sets the real workers.dev origin through SITE_URL.
const DEFAULT_SITE_URL = "https://poteto-skills.example.workers.dev";

function parseSiteUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new BuildInputError(`SITE_URL must be an absolute http(s) URL, got ${JSON.stringify(raw)}`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new BuildInputError(`SITE_URL must be an http(s) origin with no path, query or fragment, got ${JSON.stringify(raw)}`);
  }
  return url.origin;
}

// True when `inner` is `dir` itself or somewhere below it.
function isWithin(dir, inner) {
  const relative = path.relative(dir, inner);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const BUILD_DIR = path.join(repoRoot, "build");
const TEMP_DIR = path.join(repoRoot, "temp");

// writeSite replaces OUT_DIR wholesale, so it must not reach source files, the shared temp/ scratch
// root, or a build input.
function resolveOutDir(raw, inputDirs) {
  const outDir = path.resolve(repoRoot, raw);
  if (isWithin(outDir, repoRoot)) {
    throw new BuildInputError(`OUT_DIR ${outDir} would delete the repository`);
  }
  const allowedInRepo = outDir === BUILD_DIR || (isWithin(TEMP_DIR, outDir) && outDir !== TEMP_DIR);
  if (isWithin(repoRoot, outDir) && !allowedInRepo) {
    throw new BuildInputError(`OUT_DIR ${outDir} is inside the repository but is neither build/ nor a directory below temp/`);
  }
  const clash = inputDirs.find((dir) => isWithin(outDir, dir) || isWithin(dir, outDir));
  if (clash) {
    throw new BuildInputError(`OUT_DIR ${outDir} overlaps the build input ${clash}`);
  }
  return outDir;
}

function readConfig(env) {
  const contentDir = path.resolve(repoRoot, env.CONTENT_DIR || "site/content");
  const staticDir = path.resolve(repoRoot, env.STATIC_DIR || "site/static");
  return {
    contentDir,
    staticDir,
    outDir: resolveOutDir(env.OUT_DIR || "build", [contentDir, staticDir]),
    siteUrl: parseSiteUrl(env.SITE_URL || DEFAULT_SITE_URL),
  };
}

try {
  const { contentDir, staticDir, outDir, siteUrl } = readConfig(process.env);
  const contents = loadContents(contentDir, PAGES.map((page) => page.locale));
  const files = renderSite({ contents, siteUrl, staticDir });
  writeSite(files, outDir);
  console.log(`build: wrote ${files.size} files to ${path.relative(repoRoot, outDir) || "."} for ${siteUrl}`);
} catch (error) {
  console.error(`build failed: ${error instanceof BuildInputError ? error.message : error.stack}`);
  process.exit(1);
}
