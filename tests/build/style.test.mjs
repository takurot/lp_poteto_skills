import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contrastRatio } from "./helpers/contrast.mjs";
import { customProperties, parseRules, readStyle } from "./helpers/css.mjs";

const SPEC_TOKENS = {
  "--c-primary": "#0A0A0A",
  "--c-accent": "#EF4444",
  "--c-accent-active": "#DC2626",
  "--c-bg": "#FAFAFA",
  "--c-surface": "#F5F5F5",
  "--c-surface-raised": "#E5E5E5",
  "--c-text": "#0A0A0A",
  "--c-text-2": "#525252",
  "--c-text-3": "#A3A3A3",
  "--c-border-subtle": "#E5E5E5",
  "--c-border-medium": "#D4D4D4",
  "--c-border-strong": "#0A0A0A",
  "--f-display": '"Archivo Black", Impact, "Arial Black", sans-serif',
  "--f-body": '"Work Sans", -apple-system, "Segoe UI", Helvetica, sans-serif',
  "--f-mono": '"Space Mono", "Courier New", Consolas, monospace',
  "--focus-ring": "0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A",
};

const normalize = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();

const css = readStyle();
const rules = parseRules(css);
const tokens = customProperties(css);
const declarations = rules.flatMap((rule) => rule.declarations.map((declaration) => ({ ...declaration, rule })));
const where = ({ rule, property, value }) => `${rule.selectors.join(", ")} { ${property}: ${value} }`;

describe("style.css follows SPEC §4", () => {
  test("defines the SPEC §4 tokens on :root with their exact values", () => {
    for (const [name, value] of Object.entries(SPEC_TOKENS)) {
      assert.equal(normalize(tokens[name] ?? "(missing)"), normalize(value), name);
    }
  });

  test("declares color-scheme: light on the root element", () => {
    const rootSchemes = declarations.filter(
      ({ rule, property }) => property === "color-scheme" && rule.atRule === null && rule.selectors.some((s) => s === ":root" || s === "html"),
    );
    assert.deepEqual(rootSchemes.map(({ value }) => value), ["light"]);
  });

  test("every border radius is 0", () => {
    const rounded = declarations.filter(({ property, value }) => /radius$/.test(property) && value !== "0");
    assert.deepEqual(rounded.map(where), []);
  });

  test("box-shadow is none, or the focus ring under :focus-visible", () => {
    const shadows = declarations.filter(({ property }) => property === "box-shadow");
    assert.ok(shadows.length > 0, "the focus ring is declared somewhere");
    const bad = shadows.filter(
      ({ rule, value }) => !(value === "none" || (value === "var(--focus-ring)" && rule.selectors.every((s) => s.includes(":focus-visible")))),
    );
    assert.deepEqual(bad.map(where), []);
  });

  test("red is never a text color, and tertiary gray is never used", () => {
    const redText = declarations.filter(({ property, value }) => property === "color" && /--c-accent/.test(value));
    assert.deepEqual(redText.map(where), [], "red text fails WCAG AA at body sizes (3.61:1)");
    const tertiary = declarations.filter(({ property, value }) => !property.startsWith("--") && /--c-text-3\b|#a3a3a3/i.test(value));
    assert.deepEqual(tertiary.map(where), [], "#A3A3A3 is for placeholders and disabled states, which this page has none of");
  });

  test("the Primary button text is 16px bold, the SPEC §4 condition for its red hover", () => {
    const primary = declarations.filter(({ rule }) => rule.atRule === null && rule.selectors.includes(".btn-primary"));
    const value = (property) => primary.find((declaration) => declaration.property === property)?.value;
    assert.equal(value("font-size"), "16px");
    assert.equal(value("font-weight"), "700");
    const overridden = declarations.filter(
      ({ rule, property }) => ["font-size", "font-weight"].includes(property) && rule.selectors.some((s) => /\.btn-primary:/.test(s)),
    );
    assert.deepEqual(overridden.map(where), [], "no state of .btn-primary changes its type size or weight");
  });
});

describe("SPEC §4/§7 contrast pairs, computed from the style.css tokens", () => {
  const color = (name) => tokens[name];

  test("body and secondary text on the page background meet WCAG AA (4.5:1)", () => {
    assert.ok(contrastRatio(color("--c-text"), color("--c-bg")) >= 4.5);
    assert.equal(contrastRatio(color("--c-text-2"), color("--c-bg")).toFixed(2), "7.49");
  });

  test("code block text (#FAFAFA on #0A0A0A) meets WCAG AA", () => {
    assert.ok(contrastRatio(color("--c-bg"), color("--c-primary")) >= 4.5);
  });

  test("the red hover pairs reach 3:1, the large-text threshold SPEC §4 relies on, and no more than that", () => {
    const hover = contrastRatio(color("--c-bg"), color("--c-accent"));
    assert.equal(hover.toFixed(2), "3.61");
    assert.ok(hover >= 3 && hover < 4.5, "below 4.5:1, so it stays limited to 16px bold button text");
    assert.ok(contrastRatio(color("--c-bg"), color("--c-accent-active")) >= 3);
  });

  test("tertiary gray stays below AA, which is why it is not used for text", () => {
    assert.ok(contrastRatio(color("--c-text-3"), color("--c-bg")) < 4.5);
  });
});
