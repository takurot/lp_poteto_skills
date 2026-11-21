import path from "node:path";
import { fileURLToPath } from "node:url";
import { BuildInputError, loadContents } from "./site.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.resolve(repoRoot, process.env.CONTENT_DIR ?? "site/content");

try {
  loadContents(contentDir, ["en", "ja"]);
  console.error("build: content is valid; rendering is not implemented yet (see issue #5)");
  process.exit(1);
} catch (error) {
  console.error(`build failed: ${error instanceof BuildInputError ? error.message : error.stack}`);
  process.exit(1);
}
