import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const WRANGLER_PORT = 8787;
const CLOUDFLARE_SPEC = "cloudflare.spec.mjs";

// `npm run e2e` builds first; this config only serves the existing build/. The cloudflare project
// runs against `wrangler dev` so the real _headers and asset routing apply.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "temp/playwright-results",
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  projects: [
    {
      name: "chromium",
      testIgnore: CLOUDFLARE_SPEC,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: "cloudflare",
      testMatch: CLOUDFLARE_SPEC,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${WRANGLER_PORT}` },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/serve.mjs build",
      env: { PORT: String(PORT) },
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `npx wrangler dev --ip 127.0.0.1 --port ${WRANGLER_PORT} --log-level warn`,
      env: { WRANGLER_SEND_METRICS: "false" },
      url: `http://127.0.0.1:${WRANGLER_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
