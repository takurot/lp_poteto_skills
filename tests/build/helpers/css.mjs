import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./build.mjs";

export const STYLE_PATH = path.join(repoRoot, "site/static/style.css");

export function readStyle() {
  return fs.readFileSync(STYLE_PATH, "utf8");
}

function parseDeclarations(body) {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":");
      return { property: part.slice(0, colon).trim().toLowerCase(), value: part.slice(colon + 1).trim() };
    });
}

// Flattens a stylesheet into style rules. Rules nested in @media/@supports carry the at-rule prelude;
// @font-face blocks come back with selector "@font-face". Enough for the hand-written style.css, not a
// general CSS parser: it assumes no braces or semicolons inside strings.
export function parseRules(css, atRule = null) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open === -1) break;
    const prelude = source.slice(index, open).trim();
    let depth = 1;
    let close = open + 1;
    for (; close < source.length && depth > 0; close += 1) {
      if (source[close] === "{") depth += 1;
      if (source[close] === "}") depth -= 1;
    }
    const body = source.slice(open + 1, close - 1);
    if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
      rules.push(...parseRules(body, prelude));
    } else {
      const selectors = prelude.startsWith("@") ? [prelude] : prelude.split(",").map((selector) => selector.trim());
      rules.push({ selectors, atRule, declarations: parseDeclarations(body) });
    }
    index = close;
  }
  return rules;
}

export function customProperties(css) {
  const root = parseRules(css).filter((rule) => rule.atRule === null && rule.selectors.includes(":root"));
  return Object.fromEntries(
    root.flatMap((rule) => rule.declarations).filter(({ property }) => property.startsWith("--")).map(({ property, value }) => [property, value]),
  );
}
