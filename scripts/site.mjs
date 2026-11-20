import fs from "node:fs";
import path from "node:path";
import { schema, validate } from "../site/content/schema.mjs";

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
