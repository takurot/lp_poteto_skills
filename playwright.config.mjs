import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// `npm run e2e` builds first; this config only serves the existing build/.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "temp/playwright-results",
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node tests/e2e/serve.mjs build",
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
  },
});
