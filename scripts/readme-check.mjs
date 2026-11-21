// Pure comparison of the LP numbers (SPEC §2) against takurot/poteto-skills. No I/O: the caller passes
// the upstream README text, marketplace.json and skills/manifest.json, and the parsed content files.
import { createHash } from "node:crypto";

const OPTIONAL_PLUGINS = new Set(["codex-hooks"]);

// numbers.items is a fixed-order list of four (site/content/schema.mjs). Each entry names the fact it shows.
const NUMBER_ITEMS = [
  { label: "Skills", fact: "skills" },
  { label: "Hosts", fact: "hosts" },
  { label: "Codex plugins", fact: (facts) => facts.codexPlugins.length },
  { label: "pstack", fact: "pstack" },
];

// Prose fields that repeat a number. The value must appear there as a whole token.
const PROSE = [
  { field: "install.defaultSetNote", get: (c) => c.install.defaultSetNote, fact: "defaultSkills" },
  { field: "codex.intro", get: (c) => c.codex.intro, fact: (facts) => facts.codexPlugins.length },
  { field: "codex.pluginsLabel", get: (c) => c.codex.pluginsLabel, fact: (facts) => facts.codexPlugins.length },
  { field: "meta.description", get: (c) => c.meta.description, fact: "pstack" },
];

const factValue = (facts, fact) => String(typeof fact === "function" ? fact(facts) : facts[fact]);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsToken = (text, token) => new RegExp(`(^|[^\\d.,])${escapeRegExp(token)}(?![\\d.,]*\\d)`).test(text);

// Upstream strings end up in an issue posted by this repo, so only these shapes are accepted.
const PLUGIN_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const VERSION = /^\d+\.\d+\.\d+$/;

// Each "- `path` — Skills for <Host>" bullet of README's "## Contents" section names one host (SPEC §2).
function readmeHosts(readme) {
  const contents = readme.match(/^## Contents\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? "";
  return [...new Set([...contents.matchAll(/^- .*?— Skills for ([A-Z][\w]*(?: [A-Z][\w]*)*)/gm)].map((m) => m[1]))];
}

// Returns { facts, problems }. A problem is upstream data that is missing, malformed or contradicts itself.
export function upstreamFacts({ readme, marketplace, manifest }) {
  const problems = [];
  const skills = manifest.skill_count;
  if (!Number.isInteger(skills) || skills !== manifest.skills.length) {
    problems.push(`skills/manifest.json: skill_count is not an integer equal to the ${manifest.skills.length} skills listed`);
  }
  const pstackVersions = [...new Set(manifest.skills.filter((s) => s.plugin === "pstack").map((s) => s.plugin_version))];
  if (pstackVersions.length !== 1 || !VERSION.test(pstackVersions[0])) {
    problems.push(`skills/manifest.json: expected one x.y.z pstack plugin_version, found ${pstackVersions.length} value(s)`);
  }
  const hostNames = readmeHosts(readme);
  if (hostNames.length === 0) problems.push('README: no "Skills for <host>" bullet found in Contents');
  const pluginNames = marketplace.plugins.map((p) => p.name);
  const badNames = pluginNames.filter((name) => typeof name !== "string" || !PLUGIN_NAME.test(name)).length;
  if (badNames > 0) problems.push(`.agents/plugins/marketplace.json: ${badNames} plugin name(s) are not lowercase kebab-case`);
  return {
    facts: {
      skills,
      defaultSkills: manifest.skills.filter((s) => s.default_install).length,
      hosts: hostNames.length,
      pstack: pstackVersions[0],
      codexPlugins: pluginNames.filter((name) => PLUGIN_NAME.test(name) && !OPTIONAL_PLUGINS.has(name)),
    },
    problems,
  };
}

function compareLocale(locale, content, facts) {
  const diffs = [];
  NUMBER_ITEMS.forEach(({ label, fact }, index) => {
    const expected = factValue(facts, fact);
    const actual = content.numbers.items[index]?.value;
    if (actual !== expected) diffs.push({ locale, field: `numbers.items[${index}] (${label})`, expected, actual: String(actual) });
  });
  const listed = new Set(content.codex.plugins);
  const upstreamSet = new Set(facts.codexPlugins);
  const missing = facts.codexPlugins.filter((name) => !listed.has(name));
  const extra = content.codex.plugins.filter((name) => !upstreamSet.has(name));
  if (missing.length || extra.length) {
    diffs.push({ locale, field: "codex.plugins", expected: `missing: ${missing.join(", ")}`, actual: `extra: ${extra.join(", ")}` });
  }
  for (const { field, get, fact } of PROSE) {
    const expected = factValue(facts, fact);
    if (!containsToken(get(content), expected)) diffs.push({ locale, field, expected: `contains ${expected}`, actual: get(content) });
  }
  return diffs;
}

// Every difference between upstream and the content files, in a stable order. Empty means in sync.
export function compare(upstream, contents) {
  const { facts, problems } = upstreamFacts(upstream);
  return [
    ...problems.map((problem) => ({ locale: "upstream", field: "data", expected: "consistent", actual: problem })),
    ...Object.keys(contents)
      .sort()
      .flatMap((locale) => compareLocale(locale, contents[locale], facts)),
  ];
}

// A code span keeps @mentions, #references, links and HTML inert. Backticks and control characters
// cannot break out of it, and a pipe is escaped for the table.
const MAX_CELL = 200;
const cell = (text) => {
  const flat = String(text).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/`/g, "'").replace(/\|/g, "\\|");
  return `\`${flat.length > MAX_CELL ? `${flat.slice(0, MAX_CELL)}...` : flat}\``;
};

export const FINGERPRINT_MARKER = "readme-check fingerprint:";

// Identifies a set of diffs; the runner skips the update when an open issue already has this fingerprint.
export const fingerprint = (diffs) => createHash("sha256").update(JSON.stringify(diffs)).digest("hex").slice(0, 16);

export function issueBody(diffs, { upstreamRef }) {
  return [
    `The LP numbers no longer match [takurot/poteto-skills](https://github.com/takurot/poteto-skills/tree/${upstreamRef}) (SPEC §2).`,
    "Fix `site/content/*.json` and redeploy (SPEC §9). This issue closes itself when the weekly check finds no diff.",
    "",
    "| locale | field | expected | actual |",
    "|---|---|---|---|",
    ...diffs.map((d) => `| ${cell(d.locale)} | ${cell(d.field)} | ${cell(d.expected)} | ${cell(d.actual)} |`),
    "",
    `<!-- ${FINGERPRINT_MARKER}${fingerprint(diffs)} -->`,
    "",
  ].join("\n");
}
