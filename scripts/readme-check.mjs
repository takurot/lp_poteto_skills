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
const containsToken = (text, token) => new RegExp(`(^|[^\\d.])${escapeRegExp(token)}(?![\\d.]*\\d)`).test(text);

// Returns { facts, problems }. A problem is upstream data that is missing or contradicts itself.
export function upstreamFacts({ readme, marketplace, manifest }) {
  const problems = [];
  const skills = manifest.skill_count;
  if (skills !== manifest.skills.length) {
    problems.push(`skills/manifest.json: skill_count ${skills} but ${manifest.skills.length} skills listed`);
  }
  const pstackVersions = [...new Set(manifest.skills.filter((s) => s.plugin === "pstack").map((s) => s.plugin_version))];
  if (pstackVersions.length !== 1) {
    problems.push(`skills/manifest.json: expected one pstack plugin_version, found ${JSON.stringify(pstackVersions)}`);
  }
  // README "Contents" names each host as "Skills for <Host>" (SPEC §2).
  const hostNames = [...new Set([...readme.matchAll(/Skills for ([A-Z][\w ]*?)(?=[;,.]|\s+—|\s+including|$)/gm)].map((m) => m[1]))];
  if (hostNames.length === 0) problems.push('README: no "Skills for <host>" line found in Contents');
  return {
    facts: {
      skills,
      defaultSkills: manifest.skills.filter((s) => s.default_install).length,
      hosts: hostNames.length,
      pstack: pstackVersions[0],
      codexPlugins: marketplace.plugins.map((p) => p.name).filter((name) => !OPTIONAL_PLUGINS.has(name)),
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

const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");

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
    `<!-- readme-check fingerprint:${fingerprint(diffs)} -->`,
    "",
  ].join("\n");
}
