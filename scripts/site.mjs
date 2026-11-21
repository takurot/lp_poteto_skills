import fs from "node:fs";
import path from "node:path";
import { schema, validate } from "../site/content/schema.mjs";
import { NOT_FOUND_FILE, PAGES } from "../site/pages.mjs";
import { renderNotFound } from "../site/templates/not-found.mjs";
import { renderPage } from "../site/templates/page.mjs";

// An input problem the author fixes by editing files. build.mjs prints its message without a stack.
export class BuildInputError extends Error {}

function readLocale(contentDir, locale) {
  const file = `${locale}.json`;
  let text;
  try {
    text = fs.readFileSync(path.join(contentDir, file), "utf8");
  } catch (error) {
    return { errors: [`${file}: cannot read (${error.code ?? error.message})`] };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { errors: [`${file}: invalid JSON (${error.message})`] };
  }
  return { value, errors: validate(value, schema).map((error) => `${file}: ${error}`) };
}

// Reads and validates every locale file; throws once with all problems so the author sees them together.
export function loadContents(contentDir, locales) {
  const results = locales.map((locale) => [locale, readLocale(contentDir, locale)]);
  const errors = results.flatMap(([, result]) => result.errors);
  if (errors.length > 0) {
    throw new BuildInputError(`invalid content in ${contentDir}:\n${errors.map((error) => `  ${error}`).join("\n")}`);
  }
  return Object.fromEntries(results.map(([locale, result]) => [locale, result.value]));
}

const toPosix = (rel) => rel.split(path.sep).join("/");

function readStatic(staticDir) {
  if (!fs.statSync(staticDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new BuildInputError(`static directory not found: ${staticDir}`);
  }
  return fs
    .readdirSync(staticDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => toPosix(path.relative(staticDir, path.join(entry.parentPath, entry.name))))
    .filter((rel) => !rel.split("/").some((part) => part.startsWith(".")))
    .map((rel) => [rel, fs.readFileSync(path.join(staticDir, rel))]);
}

// Builds the whole site in memory: relative output path -> file contents, in sorted path order.
export function renderSite({ contents, siteUrl, staticDir }) {
  const generated = [
    ...PAGES.map(({ locale, file }) => [file, renderPage(contents[locale], locale, { siteUrl })]),
    [NOT_FOUND_FILE, renderNotFound(contents)],
  ];
  // Lowercased because a case-insensitive filesystem (macOS, Windows) would merge JA/Index.html into ja/index.html.
  const generatedPaths = new Set(generated.map(([rel]) => rel.toLowerCase()));
  const statics = readStatic(staticDir);
  const collisions = statics.map(([rel]) => rel).filter((rel) => generatedPaths.has(rel.toLowerCase()));
  if (collisions.length > 0) {
    throw new BuildInputError(`static files would overwrite generated pages: ${collisions.join(", ")}`);
  }
  return new Map([...generated, ...statics].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// Written into every output tree so a later build knows the directory is its own to replace.
export const OUTPUT_MARKER = ".build-output";
// Wrangler reads this from the assets directory and skips the listed files when it uploads build/.
const ASSETS_IGNORE = [".assetsignore", `${OUTPUT_MARKER}\n`];

// Removing a directory is allowed only when it is absent, empty, or carries OUTPUT_MARKER.
function assertReplaceable(dir) {
  const stat = fs.statSync(dir, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isDirectory() && (fs.readdirSync(dir).length === 0 || fs.existsSync(path.join(dir, OUTPUT_MARKER)))) return;
  throw new BuildInputError(
    `refusing to replace OUT_DIR path ${dir}: it is not an empty directory and has no ${OUTPUT_MARKER} marker from a previous build. Remove it yourself or choose another OUT_DIR.`,
  );
}

// The only step that writes. Files go to a sibling staging dir first, so a failure before the swap
// leaves the previous outDir in place. The swap moves the old outDir aside, moves staging in, and
// moves the old one back if that second rename fails.
export function writeSite(files, outDir) {
  const staging = `${outDir}.staging`;
  const previous = `${outDir}.previous`;
  [outDir, staging, previous].forEach(assertReplaceable);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(previous, { recursive: true, force: true });
  for (const [rel, data] of [[OUTPUT_MARKER, ""], ASSETS_IGNORE, ...files]) {
    const target = path.join(staging, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  const hadPrevious = fs.existsSync(outDir);
  if (hadPrevious) fs.renameSync(outDir, previous);
  try {
    fs.renameSync(staging, outDir);
  } catch (error) {
    if (hadPrevious) fs.renameSync(previous, outDir);
    throw error;
  }
  fs.rmSync(previous, { recursive: true, force: true });
}
