// Keeps at most one open readme-drift issue in sync with the current diffs. `api(pathname, options)` is
// the GitHub REST client from readme-check-run.mjs; tests pass a fake.
import { FINGERPRINT_MARKER, fingerprint, issueBody } from "./readme-check.mjs";

export const LABEL = { name: "readme-drift", color: "D93F0B", description: "LP numbers differ from takurot/poteto-skills (weekly README check)" };
const TITLE = "README check: LP numbers differ from takurot/poteto-skills";
const UPSTREAM = "takurot/poteto-skills";

// Oldest first, and only issues this check wrote: a human may put the label on anything. The
// label-filtered list lags a few seconds behind issue creation, so two runs close together can each
// create an issue; every run closes all but the oldest.
async function ownIssues(api, repo) {
  const issues = await api(`/repos/${repo}/issues?state=open&labels=${LABEL.name}&per_page=100&sort=created&direction=asc`);
  return issues.filter((issue) => !issue.pull_request && issue.body?.includes(FINGERPRINT_MARKER));
}

async function comment(api, repo, number, body) {
  await api(`/repos/${repo}/issues/${number}/comments`, { method: "POST", body: { body } });
}

async function close(api, repo, number, reason) {
  await api(`/repos/${repo}/issues/${number}`, { method: "PATCH", body: { state: "closed", state_reason: reason } });
}

// Returns a one-line description of what it did.
export async function reconcile({ diffs, sha, api, repo }) {
  const [existing, ...duplicates] = await ownIssues(api, repo);
  for (const duplicate of duplicates) {
    await comment(api, repo, duplicate.number, `Duplicate of #${existing.number}. Closing.`);
    await close(api, repo, duplicate.number, "not_planned");
  }
  if (diffs.length === 0) {
    if (!existing) return "in sync, no open issue";
    await comment(api, repo, existing.number, `No diff at ${UPSTREAM}@${sha}. Closing.`);
    await close(api, repo, existing.number, "completed");
    return `in sync, closed #${existing.number}`;
  }
  const body = issueBody(diffs, { upstreamRef: sha });
  if (!existing) {
    await api(`/repos/${repo}/labels`, { method: "POST", body: LABEL, okStatuses: [422] });
    const created = await api(`/repos/${repo}/issues`, { method: "POST", body: { title: TITLE, body, labels: [LABEL.name] } });
    return `created #${created.number}`;
  }
  if (existing.body.includes(`${FINGERPRINT_MARKER}${fingerprint(diffs)}`)) return `unchanged, #${existing.number} already lists these diffs`;
  await api(`/repos/${repo}/issues/${existing.number}`, { method: "PATCH", body: { body } });
  await comment(api, repo, existing.number, `The diffs changed at ${UPSTREAM}@${sha}. The table above is current.`);
  return `updated #${existing.number}`;
}
