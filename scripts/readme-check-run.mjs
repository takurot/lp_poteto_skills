// Weekly README check (SPEC §8). Fetches takurot/poteto-skills at one commit, compares it with
// site/content (or CONTENT_DIR), and reconciles the readme-drift issue in GITHUB_REPOSITORY.
// Needs GITHUB_TOKEN with issues: write. Never fails because of a diff; only an error exits non-zero.
import path from "node:path";
import { PAGES } from "../site/pages.mjs";
import { compare } from "./readme-check.mjs";
import { reconcile } from "./readme-issue.mjs";
import { loadContents } from "./site.mjs";

const UPSTREAM = "takurot/poteto-skills";
const TIMEOUT_MS = 15_000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function makeApi(token) {
  const request = (pathname, { method, body, raw }) =>
    fetch(`https://api.github.com${pathname}`, {
      method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "lp-readme-check",
        "x-github-api-version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // A GET is retried once on a network error or a 5xx; writes are not, so nothing is posted twice.
  return async (pathname, { method = "GET", body, raw = false, okStatuses = [] } = {}) => {
    let response;
    try {
      response = await request(pathname, { method, body, raw });
      if (method === "GET" && response.status >= 500) response = await request(pathname, { method, body, raw });
    } catch (error) {
      if (method !== "GET") throw error;
      response = await request(pathname, { method, body, raw });
    }
    if (!response.ok && !okStatuses.includes(response.status)) {
      throw new Error(`${method} ${pathname}: HTTP ${response.status} ${await response.text()}`);
    }
    if (raw) return response.text();
    return response.status === 204 ? null : response.json();
  };
}

async function fetchUpstream(api) {
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

try {
  const api = makeApi(requireEnv("GITHUB_TOKEN"));
  const repo = requireEnv("GITHUB_REPOSITORY");
  const contentDir = path.resolve(import.meta.dirname, "..", process.env.CONTENT_DIR || "site/content");
  const { sha, upstream } = await fetchUpstream(api);
  const contents = loadContents(contentDir, PAGES.map((page) => page.locale));
  const diffs = compare(upstream, contents);
  for (const d of diffs) console.log(`diff ${d.locale} ${d.field}: expected ${d.expected}, actual ${d.actual}`);
  console.log(`readme-check: ${diffs.length} diff(s) against ${UPSTREAM}@${sha}; ${await reconcile({ diffs, sha, api, repo })}`);
} catch (error) {
  console.error(`readme-check failed: ${error.message}`);
  process.exitCode = 1;
}
