// Runs against `wrangler dev`, which serves build/ with the real wrangler.jsonc and _headers (SPEC §5.4).
import { expect, test } from "@playwright/test";

const CSP =
  "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const FONT = "/fonts/work-sans-latin-400-normal.woff2";

const PAGES = [
  { path: "/", status: 200 },
  { path: "/ja/", status: 200 },
  { path: "/no-such-page", status: 404 },
];

// Records CSP violations, uncaught errors and console errors. Chrome logs the 404 document itself as a
// console error, so a failed load of the page's own URL is not a problem.
async function watchProblems(page) {
  const problems = [];
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource") && message.location().url === page.url()) return;
    problems.push(`console: ${message.text()}`);
  });
  return problems;
}

for (const { path, status } of PAGES) {
  test(`${path}: served with the security headers and loads with zero CSP violations`, async ({ page }) => {
    const problems = await watchProblems(page);
    const response = await page.goto(path);
    expect(response.status()).toBe(status);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toBe(CSP);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    await page.evaluate(() => document.fonts.ready);
    if (status === 200) {
      const copyButton = page.locator("button.copy").first();
      await expect(copyButton, "copy.js ran under script-src 'self'").toBeVisible();
      await copyButton.click();
    }

    const violations = await page.evaluate(() => window.__cspViolations);
    expect([...violations, ...problems]).toEqual([]);
  });
}

test("fonts are cached as immutable and the unhashed stylesheet for an hour", async ({ request }) => {
  const font = await request.get(FONT);
  expect(font.status()).toBe(200);
  expect(font.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  const css = await request.get("/style.css");
  expect(css.status()).toBe(200);
  expect(css.headers()["cache-control"]).toBe("public, max-age=3600");
});

test("/ja redirects to /ja/ and /index.html to /", async ({ request }) => {
  for (const [from, to] of [
    ["/ja", "/ja/"],
    ["/index.html", "/"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(307);
    expect(response.headers().location, from).toBe(to);
  }
});

test("build bookkeeping files are not served", async ({ request }) => {
  for (const path of ["/.build-output", "/.assetsignore", "/_headers"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("robots.txt allows crawling", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("User-agent: *\nAllow: /\n");
});
