import { expect, test } from "@playwright/test";

const GITHUB_URL = "https://github.com/takurot/poteto-skills";
const WIDTHS = [360, 1280];
const PAGES = [
  { name: "en", path: "/", lang: "en", status: 200 },
  { name: "ja", path: "/ja/", lang: "ja", status: 200 },
  { name: "404", path: "/no-such-page", lang: "en", status: 404 },
];

for (const width of WIDTHS) {
  test.describe(`${width}px viewport`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const { name, path, lang, status } of PAGES) {
      test(`${name}: status ${status}, lang ${lang}, no horizontal page scroll`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response.status()).toBe(status);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await page.evaluate(() => document.fonts.ready);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      });
    }

    test("Display size is 40px below 640px and 56px above; long commands scroll inside their block", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("h1")).toHaveCSS("font-size", width < 640 ? "40px" : "56px");
      const pre = page.locator("#install pre").first();
      await expect(pre).toHaveCSS("overflow-x", "auto");
      const box = await pre.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    });
  });
}

test("F3: the hero CTA links exactly to the GitHub repository", async ({ page }) => {
  for (const path of ["/", "/ja/"]) {
    await page.goto(path);
    await expect(page.locator("#hero a.btn-primary")).toHaveAttribute("href", GITHUB_URL);
  }
});

test("F1: the language switch goes / -> /ja/ -> /", async ({ page }) => {
  await page.goto("/");
  await page.locator('nav a[hreflang="ja"]').click();
  await expect(page).toHaveURL(/\/ja\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.locator('nav a[hreflang="en"]').click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("F5: the 404 page has one link, and it leads home", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
  await expect(page.locator("a")).toHaveCount(1);
  await page.locator("a").click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});

for (const path of ["/", "/ja/", "/no-such-page"]) {
  test(`keyboard: Tab reaches every link on ${path}, each with the visible focus ring`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Tab order checked in Chromium");
    await page.goto(path);
    const linkCount = await page.locator("a[href]").count();
    const reached = new Map();
    for (let step = 0; step < 200; step += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        return {
          key: `${[...document.querySelectorAll("*")].indexOf(element)} ${element.tagName} ${element.textContent.slice(0, 40)}`,
          isLink: element.matches("a[href]"),
          focusVisible: element.matches(":focus-visible"),
          shadow: getComputedStyle(element).boxShadow,
        };
      });
      if (!focused) break;
      if (reached.has(focused.key)) break;
      reached.set(focused.key, focused);
    }
    const links = [...reached.values()].filter((entry) => entry.isLink);
    expect(links.length).toBe(linkCount);
    for (const entry of reached.values()) {
      expect(entry.focusVisible, entry.key).toBe(true);
      expect(entry.shadow, entry.key).toContain("rgb(10, 10, 10) 0px 0px 0px 4px");
    }
  });
}

test("F7: every request stays on the page's origin and no cookie is set", async ({ page, context, baseURL }) => {
  const origins = new Set();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  for (const path of ["/", "/ja/", "/no-such-page"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
  }
  expect([...origins]).toEqual([new URL(baseURL).origin]);
  expect(await context.cookies()).toEqual([]);
});

test("F7: the self-hosted fonts load from /fonts/", async ({ page }) => {
  const fontResponses = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".woff2")) fontResponses.push([new URL(response.url()).pathname, response.status()]);
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('56px "Archivo Black"'))).toBe(true);
  expect(fontResponses.length).toBeGreaterThan(0);
  for (const [pathname, status] of fontResponses) {
    expect(pathname.startsWith("/fonts/"), pathname).toBe(true);
    expect(status, pathname).toBe(200);
  }
});

test.describe("F4: copy buttons", () => {
  test("with JS, every button shows and copies its command", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const buttons = page.locator("button.copy");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(buttons.nth(index)).toBeVisible();
    }
    const first = buttons.first();
    const command = await page.locator(`#${await first.getAttribute("aria-describedby")}`).textContent();
    await first.click();
    await expect(first).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  });

  test.describe("without JS", () => {
    test.use({ javaScriptEnabled: false });

    test("buttons stay hidden and commands remain selectable text", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("button.copy").first()).toBeHidden();
      await expect(page.locator("button.copy:visible")).toHaveCount(0);
      await expect(page.locator("#install pre").first()).not.toHaveCSS("user-select", "none");
      await expect(page.locator("#install-cmd-1")).toHaveText("git clone https://github.com/takurot/poteto-skills.git");
    });
  });
});
