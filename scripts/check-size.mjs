// SPEC §7: HTML and CSS together stay under 50KB gzip, fonts excluded. Sums every .html and .css file in
// the directory, which is stricter than what one page load transfers.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const BUDGET_BYTES = 50 * 1024;
const MEASURED = new Set([".html", ".css"]);

// Relative POSIX path -> gzip byte count, for every HTML and CSS file under dir.
export function gzipSizes(dir) {
  return Object.fromEntries(
    fs
      .readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && MEASURED.has(path.extname(entry.name)))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .map((file) => [path.relative(dir, file).split(path.sep).join("/"), gzipSync(fs.readFileSync(file)).length])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

function main(dir) {
  const sizes = gzipSizes(dir);
  if (!Object.keys(sizes).some((rel) => rel.endsWith(".html"))) {
    throw new Error(`no HTML files in ${dir}; run the build first`);
  }
  const total = Object.values(sizes).reduce((sum, bytes) => sum + bytes, 0);
  for (const [rel, bytes] of Object.entries(sizes)) console.log(`${String(bytes).padStart(7)}  ${rel}`);
  console.log(`HTML+CSS gzip total: ${total} bytes (budget ${BUDGET_BYTES})`);
  if (total >= BUDGET_BYTES) {
    console.error(`check-size: ${total} bytes is over budget (${BUDGET_BYTES})`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(path.resolve(process.argv[2] ?? "build"));
  } catch (error) {
    console.error(`check-size: ${error.message}`);
    process.exitCode = 1;
  }
}
