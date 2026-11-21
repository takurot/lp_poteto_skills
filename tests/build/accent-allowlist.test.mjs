import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRules, readStyle } from "./helpers/css.mjs";

// SPEC §4: the only selectors allowed to paint with the accent red. Static: the hero underline and the
// pull quote border. Interactive: Primary button background and Ghost button underline (links in the
// page are Ghost buttons), on hover and active only.
const ACCENT_ALLOWLIST = [
  ".hero-title::after",
  ".pull-quote",
  ".btn-primary:hover",
  ".btn-primary:active",
  ".btn-ghost:hover",
  ".btn-ghost:active",
];

const ACCENT_TOKEN = /var\(\s*--c-accent(?:-active)?\s*\)/;
const ACCENT_HEX = /#(?:ef4444|dc2626)\b|rgba?\(\s*(?:239\D+68\D+68|220\D+38\D+38)\b/i;

const declarations = parseRules(readStyle()).flatMap((rule) =>
  rule.declarations.map((declaration) => ({ ...declaration, selectors: rule.selectors })),
);
const isTokenDefinition = ({ property }) => property === "--c-accent" || property === "--c-accent-active";

test("SPEC §4: only allowlisted selectors reference --c-accent or --c-accent-active", () => {
  const selectors = new Set(
    declarations.filter(({ value }) => ACCENT_TOKEN.test(value)).flatMap((declaration) => declaration.selectors),
  );
  assert.deepEqual(
    [...selectors].filter((selector) => !ACCENT_ALLOWLIST.includes(selector)),
    [],
    "selectors outside the allowlist use the accent",
  );
  assert.deepEqual(
    ACCENT_ALLOWLIST.filter((selector) => !selectors.has(selector)),
    [],
    "allowlist entries no longer used (remove them)",
  );
});

test("the accent colors, as hex or rgb(), appear only in the token definitions", () => {
  const raw = declarations.filter((declaration) => ACCENT_HEX.test(declaration.value) && !isTokenDefinition(declaration));
  assert.deepEqual(
    raw.map(({ selectors, property, value }) => `${selectors.join(", ")} { ${property}: ${value} }`),
    [],
  );
});
