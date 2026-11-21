import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { issueBody } from "../../scripts/readme-check.mjs";
import { LABEL, reconcile } from "../../scripts/readme-issue.mjs";

const REPO = "owner/lp";
const BOT = { login: "github-actions[bot]" };
const DIFF_A = [{ locale: "ja", field: "numbers.items[0] (Skills)", expected: "110", actual: "111" }];
const DIFF_B = [...DIFF_A, { locale: "en", field: "numbers.items[1] (Hosts)", expected: "2", actual: "3" }];

// An in-memory stand-in for the GitHub issues API. Records every write.
function fakeGitHub(issues = []) {
  const state = { issues: issues.map((issue) => ({ state: "open", labels: [{ name: LABEL.name }], user: BOT, ...issue })), writes: [] };
  let next = 100;
  const api = async (pathname, { method = "GET", body } = {}) => {
    if (method === "GET") {
      assert.match(pathname, new RegExp(`^/repos/${REPO}/issues\\?state=open&labels=${LABEL.name}`));
      return state.issues.filter((issue) => issue.state === "open").sort((a, b) => a.number - b.number);
    }
    state.writes.push(`${method} ${pathname.replace(`/repos/${REPO}`, "")}`);
    const number = Number(pathname.match(/issues\/(\d+)/)?.[1]);
    if (method === "POST" && pathname.endsWith("/labels")) return {};
    if (method === "POST" && pathname.endsWith("/issues")) {
      const issue = { number: next++, state: "open", user: BOT, labels: [{ name: LABEL.name }], ...body };
      state.issues.push(issue);
      return issue;
    }
    if (method === "PATCH") Object.assign(state.issues.find((issue) => issue.number === number), body);
    return {};
  };
  return { api, state };
}

const run = (gh, diffs) => reconcile({ diffs, sha: "abc", api: gh.api, repo: REPO });
const bodyFor = (diffs) => issueBody(diffs, { upstreamRef: "old" });

describe("reconcile", () => {
  test("first diff: ensures the label and creates one issue", async () => {
    const gh = fakeGitHub();
    assert.equal(await run(gh, DIFF_A), "created #100");
    assert.deepEqual(gh.state.writes, ["POST /labels", "POST /issues"]);
  });

  test("same diffs again: no write at all, even when the upstream commit moved", async () => {
    const gh = fakeGitHub([{ number: 7, body: bodyFor(DIFF_A) }]);
    assert.match(await run(gh, DIFF_A), /unchanged, #7/);
    assert.deepEqual(gh.state.writes, []);
  });

  test("changed diffs: updates the body and comments", async () => {
    const gh = fakeGitHub([{ number: 7, body: bodyFor(DIFF_A) }]);
    assert.equal(await run(gh, DIFF_B), "updated #7");
    assert.deepEqual(gh.state.writes, ["PATCH /issues/7", "POST /issues/7/comments"]);
    assert.match(gh.state.issues[0].body, /Hosts/);
  });

  test("no diffs: comments on and closes the open issue", async () => {
    const gh = fakeGitHub([{ number: 7, body: bodyFor(DIFF_A) }]);
    assert.equal(await run(gh, []), "in sync, closed #7");
    assert.deepEqual(gh.state.writes, ["POST /issues/7/comments", "PATCH /issues/7"]);
    assert.equal(gh.state.issues[0].state, "closed");
  });

  test("no diffs and no issue: nothing to do", async () => {
    const gh = fakeGitHub();
    assert.equal(await run(gh, []), "in sync, no open issue");
    assert.deepEqual(gh.state.writes, []);
  });

  test("two open issues: keeps the oldest and closes the newer as a duplicate", async () => {
    const gh = fakeGitHub([
      { number: 8, body: bodyFor(DIFF_A) },
      { number: 7, body: bodyFor(DIFF_A) },
    ]);
    assert.match(await run(gh, DIFF_A), /unchanged, #7/);
    assert.deepEqual(gh.state.writes, ["POST /issues/8/comments", "PATCH /issues/8"]);
    assert.equal(gh.state.issues.find((issue) => issue.number === 8).state, "closed");
  });

  test("an issue someone else labelled readme-drift is never touched", async () => {
    const gh = fakeGitHub([{ number: 3, body: "unrelated report", user: { login: "someone" } }]);
    assert.equal(await run(gh, []), "in sync, no open issue");
    assert.equal(await run(gh, DIFF_A), "created #100");
    assert.equal(gh.state.issues.find((issue) => issue.number === 3).body, "unrelated report");
    assert.ok(!gh.state.writes.some((write) => write.includes("/issues/3")));
  });
});
