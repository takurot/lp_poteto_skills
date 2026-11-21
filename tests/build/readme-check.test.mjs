import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { compare, issueBody, upstreamFacts } from "../../scripts/readme-check.mjs";
import { repoRoot } from "./helpers/build.mjs";

const fixtureDir = path.join(repoRoot, "tests/build/fixtures/upstream");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const upstream = () => ({
  readme: fs.readFileSync(path.join(fixtureDir, "README.md"), "utf8"),
  marketplace: readJson(path.join(fixtureDir, "marketplace.json")),
  manifest: readJson(path.join(fixtureDir, "manifest.json")),
});
// The real site content: the check must pass on main as it is.
const contents = () => ({
  en: readJson(path.join(repoRoot, "site/content/en.json")),
  ja: readJson(path.join(repoRoot, "site/content/ja.json")),
});

describe("upstreamFacts", () => {
  test("reads the SPEC §2 numbers from the structured files and the README", () => {
    const { facts, problems } = upstreamFacts(upstream());
    assert.deepEqual(problems, []);
    assert.equal(facts.skills, 110);
    assert.equal(facts.defaultSkills, 109);
    assert.equal(facts.hosts, 2);
    assert.equal(facts.pstack, "0.15.46");
    assert.equal(facts.codexPlugins.length, 22);
    assert.ok(!facts.codexPlugins.includes("codex-hooks"), "codex-hooks is excluded");
  });

  test("an upstream file that disagrees with itself or lacks a value is a problem, not a silent pass", () => {
    const data = upstream();
    data.manifest.skill_count = 111;
    data.manifest.skills = data.manifest.skills.filter((skill) => skill.plugin !== "pstack");
    data.readme = data.readme.replace(/Skills for /g, "Skill files for ");
    const { problems } = upstreamFacts(data);
    assert.equal(problems.length, 3, problems.join("\n"));
    assert.match(problems.join("\n"), /skill_count/);
    assert.match(problems.join("\n"), /pstack/);
    assert.match(problems.join("\n"), /host/);
  });
});

describe("upstreamFacts reads hosts from the Contents section only", () => {
  test('a capitalised "Skills for X" outside Contents is ignored', () => {
    const data = upstream();
    data.readme += "\n## Extra\n\nWe may add Skills for Cursor.\n";
    assert.equal(upstreamFacts(data).facts.hosts, 2);
  });

  test("a Contents bullet with a parenthetical suffix still counts its host", () => {
    const data = upstream();
    data.readme = data.readme.replace("Skills for Codex, including", "Skills for Codex (with `agents/openai.yaml`), including");
    assert.equal(upstreamFacts(data).facts.hosts, 2);
  });
});

describe("upstream values are validated before they reach an issue", () => {
  test("a plugin name or version with unexpected characters is a problem and its raw value is not echoed", () => {
    const data = upstream();
    data.marketplace.plugins.push({ name: "@someone ![x](https://evil.example/x.png)" });
    data.manifest.skills.find((s) => s.plugin === "pstack").plugin_version = "0.15.46 @team";
    const { problems } = upstreamFacts(data);
    assert.equal(problems.length, 2, problems.join("\n"));
    assert.ok(!problems.join("\n").includes("@"), problems.join("\n"));
  });

  test("a non-integer skill_count is a problem", () => {
    const data = upstream();
    data.manifest.skill_count = "110";
    assert.match(upstreamFacts(data).problems.join("\n"), /skill_count/);
  });
});

describe("compare", () => {
  test("the current content matches upstream: no diffs", () => {
    assert.deepEqual(compare(upstream(), contents()), []);
  });

  test("a shifted number in one locale yields exactly that diff", () => {
    const shifted = contents();
    shifted.ja.numbers.items[0].value = "111";
    assert.deepEqual(compare(upstream(), shifted), [
      { locale: "ja", field: "numbers.items[0] (Skills)", expected: "110", actual: "111" },
    ]);
  });

  test("an upstream change shows up in every locale and every place that repeats the number", () => {
    const data = upstream();
    data.marketplace.plugins.push({ name: "new-plugin" });
    const fields = compare(data, contents()).map((diff) => `${diff.locale} ${diff.field}`);
    for (const locale of ["en", "ja"]) {
      assert.ok(fields.includes(`${locale} numbers.items[2] (Codex plugins)`), fields.join("\n"));
      assert.ok(fields.includes(`${locale} codex.plugins`), fields.join("\n"));
      assert.ok(fields.includes(`${locale} codex.intro`), fields.join("\n"));
      assert.ok(fields.includes(`${locale} codex.pluginsLabel`), fields.join("\n"));
    }
  });

  test("the plugin list diff names what is missing and what is extra", () => {
    const shifted = contents();
    shifted.en.codex.plugins = shifted.en.codex.plugins.filter((name) => name !== "x").concat("y");
    const [diff] = compare(upstream(), shifted).filter((d) => d.field === "codex.plugins");
    assert.equal(diff.locale, "en");
    assert.equal(diff.expected, "missing: x");
    assert.equal(diff.actual, "extra: y");
  });

  test("a number in prose matches as a whole number, so 1109 does not count as 109", () => {
    const shifted = contents();
    shifted.en.install.defaultSetNote = shifted.en.install.defaultSetNote.replace("109", "1109");
    assert.deepEqual(
      compare(upstream(), shifted).map((d) => `${d.locale} ${d.field}`),
      ["en install.defaultSetNote"],
    );
  });

  test("upstream problems are reported as diffs with locale 'upstream'", () => {
    const data = upstream();
    data.manifest.skill_count = 111;
    assert.ok(compare(data, contents()).some((d) => d.locale === "upstream"));
  });
});

test("issueBody lists every diff as a table row and is stable for the same diffs", () => {
  const diffs = [{ locale: "ja", field: "numbers.items[0] (Skills)", expected: "110", actual: "111" }];
  const body = issueBody(diffs, { upstreamRef: "abc123" });
  assert.match(body, /\| `ja` \| `numbers\.items\[0\] \(Skills\)` \| `110` \| `111` \|/);
  assert.match(body, /abc123/);
  assert.equal(body, issueBody(diffs, { upstreamRef: "abc123" }));
});

test("issueBody puts each cell in a code span, so mentions, links and control characters stay inert", () => {
  const diffs = [{ locale: "en", field: "codex.intro", expected: "contains 22", actual: "ping @team #12 | x\r\ny`z" }];
  const row = issueBody(diffs, { upstreamRef: "abc" }).split("\n").find((line) => line.startsWith("| `en`"));
  assert.equal(row, "| `en` | `codex.intro` | `contains 22` | `ping @team #12 \\| x  y'z` |");
});

test("containsToken-style matching rejects 1,109 for 109", () => {
  const shifted = contents();
  shifted.en.install.defaultSetNote = shifted.en.install.defaultSetNote.replace("109", "1,109");
  assert.deepEqual(
    compare(upstream(), shifted).map((d) => `${d.locale} ${d.field}`),
    ["en install.defaultSetNote"],
  );
});
