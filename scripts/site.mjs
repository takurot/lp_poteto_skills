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
  const generatedPaths = new Set(generated.map(([rel]) => rel));
  const statics = readStatic(staticDir);
  const collisions = statics.map(([rel]) => rel).filter((rel) => generatedPaths.has(rel));
  if (collisions.length > 0) {
    throw new BuildInputError(`static files would overwrite generated pages: ${collisions.join(", ")}`);
  }
  return new Map([...generated, ...statics].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// The only step that writes. Files go to a sibling staging dir first, so an I/O error mid-write
// leaves the previous outDir in place; only the final swap touches it.
export function writeSite(files, outDir) {
  const staging = `${outDir}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  for (const [rel, data] of files) {
    const target = path.join(staging, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.renameSync(staging, outDir);
}
