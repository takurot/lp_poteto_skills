// Weekly README check (SPEC §8). Fetches takurot/poteto-skills at one commit, compares it with
// site/content (or CONTENT_DIR), and keeps at most one open issue labelled readme-drift in
// GITHUB_REPOSITORY: created on the first diff, updated when the diffs change, closed when they are gone.
// Needs GITHUB_TOKEN with issues: write. Never fails because of a diff; only an error exits non-zero.
import path from "node:path";
import { PAGES } from "../site/pages.mjs";
import { compare, fingerprint, issueBody } from "./readme-check.mjs";
import { loadContents } from "./site.mjs";

const UPSTREAM = "takurot/poteto-skills";
const LABEL = { name: "readme-drift", color: "D93F0B", description: "LP numbers differ from takurot/poteto-skills (weekly README check)" };
const TITLE = "README check: LP numbers differ from takurot/poteto-skills";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const token = requireEnv("GITHUB_TOKEN");
const repo = requireEnv("GITHUB_REPOSITORY");
const contentDir = path.resolve(import.meta.dirname, "..", process.env.CONTENT_DIR || "site/content");

async function api(pathname, { method = "GET", body, raw = false, okStatuses = [] } = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "lp-readme-check",
      "x-github-api-version": "2022-11-28",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok && !okStatuses.includes(response.status)) {
    throw new Error(`${method} ${pathname}: HTTP ${response.status} ${await response.text()}`);
  }
  if (raw) return response.text();
  return response.status === 204 ? null : response.json();
}

async function fetchUpstream() {
  const { default_branch: branch } = await api(`/repos/${UPSTREAM}`);
  const { sha } = await api(`/repos/${UPSTREAM}/commits/${encodeURIComponent(branch)}`);
  const file = (rel) => api(`/repos/${UPSTREAM}/contents/${rel}?ref=${sha}`, { raw: true });
  const [readme, marketplace, manifest] = await Promise.all([
    api(`/repos/${UPSTREAM}/readme?ref=${sha}`, { raw: true }),
    file(".agents/plugins/marketplace.json").then(JSON.parse),
    file("skills/manifest.json").then(JSON.parse),
  ]);
  return { sha, upstream: { readme, marketplace, manifest } };
}

// Oldest first. The label-filtered list lags a few seconds behind issue creation, so two runs close
// together can each create an issue; every run therefore closes all but the oldest as duplicates.
async function openIssues() {
  const issues = await api(`/repos/${repo}/issues?state=open&labels=${LABEL.name}&per_page=100&sort=created&direction=asc`);
  return issues.filter((issue) => !issue.pull_request);
}

async function closeDuplicates(duplicates, keep) {
  for (const issue of duplicates) {
    await api(`/repos/${repo}/issues/${issue.number}/comments`, { method: "POST", body: { body: `Duplicate of #${keep.number}. Closing.` } });
    await api(`/repos/${repo}/issues/${issue.number}`, { method: "PATCH", body: { state: "closed", state_reason: "not_planned" } });
  }
}

async function reconcile(diffs, sha) {
  const [existing, ...duplicates] = await openIssues();
  if (existing) await closeDuplicates(duplicates, existing);
  if (diffs.length === 0) {
    if (!existing) return "in sync, no open issue";
    await api(`/repos/${repo}/issues/${existing.number}/comments`, { method: "POST", body: { body: `No diff at ${UPSTREAM}@${sha}. Closing.` } });
    await api(`/repos/${repo}/issues/${existing.number}`, { method: "PATCH", body: { state: "closed", state_reason: "completed" } });
    return `in sync, closed #${existing.number}`;
  }
  const body = issueBody(diffs, { upstreamRef: sha });
  if (!existing) {
    await api(`/repos/${repo}/labels`, { method: "POST", body: LABEL, okStatuses: [422] });
    const created = await api(`/repos/${repo}/issues`, { method: "POST", body: { title: TITLE, body, labels: [LABEL.name] } });
    return `created #${created.number}`;
  }
  if (existing.body?.includes(`fingerprint:${fingerprint(diffs)}`)) return `unchanged, #${existing.number} already lists these diffs`;
  await api(`/repos/${repo}/issues/${existing.number}`, { method: "PATCH", body: { body } });
  await api(`/repos/${repo}/issues/${existing.number}/comments`, { method: "POST", body: { body: `The diffs changed at ${UPSTREAM}@${sha}. The table above is current.` } });
  return `updated #${existing.number}`;
}

try {
  const { sha, upstream } = await fetchUpstream();
  const contents = loadContents(contentDir, PAGES.map((page) => page.locale));
  const diffs = compare(upstream, contents);
  for (const d of diffs) console.log(`diff ${d.locale} ${d.field}: expected ${d.expected}, actual ${d.actual}`);
  console.log(`readme-check: ${diffs.length} diff(s) against ${UPSTREAM}@${sha}; ${await reconcile(diffs, sha)}`);
} catch (error) {
  console.error(`readme-check failed: ${error.message}`);
  process.exitCode = 1;
}
