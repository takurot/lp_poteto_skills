import { expect, test } from "@playwright/test";

const PATHS = ["/", "/ja/", "/no-such-page"];
const RED = ["rgb(239, 68, 68)", "rgb(220, 38, 38)"];

// Every element and its ::before/::after, as [label, computed style] pairs, evaluated in the page.
const STYLE_WALK = `
  () => [...document.querySelectorAll("*")].flatMap((element) =>
    ["", "::before", "::after"]
      .map((which) => [element, which, getComputedStyle(element, which || null)])
      .filter(([, which, style]) => !which || (style.content !== "none" && style.content !== "normal"))
  )
`;

async function settle(page, path) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
}

for (const width of [360, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of PATHS) {
      test(`${path}: every element and pseudo-element has border-radius 0`, async ({ page }) => {
        await settle(page, path);
        const rounded = await page.evaluate(`(${STYLE_WALK})().flatMap(([element, which, style]) =>
          ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"]
            .filter((key) => style[key] !== "0px")
            .map((key) => element.tagName + "." + element.className + which + " " + key + "=" + style[key]))`);
        expect(rounded).toEqual([]);
      });

      test(`${path}: no element casts a box-shadow while nothing is focused`, async ({ page }) => {
        await settle(page, path);
        const shadowed = await page.evaluate(`(${STYLE_WALK})()
          .filter(([, , style]) => style.boxShadow !== "none")
          .map(([element, which, style]) => element.tagName + "." + element.className + which + " " + style.boxShadow)`);
        expect(shadowed).toEqual([]);
      });

      test(`${path}: at most one statically red element in any viewport while scrolling`, async ({ page }) => {
        await settle(page, path);
        const result = await page.evaluate(
          `(async (red) => {
            const isRed = (value) => red.some((rgb) => value.includes(rgb));
            const paintsRed = (style) =>
              isRed(style.color) ||
              isRed(style.backgroundColor) ||
              ["Top", "Right", "Bottom", "Left"].some((side) => parseFloat(style["border" + side + "Width"]) > 0 && style["border" + side + "Style"] !== "none" && isRed(style["border" + side + "Color"])) ||
              (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 && isRed(style.outlineColor)) ||
              (style.textDecorationLine !== "none" && isRed(style.textDecorationColor));
            const redOnes = (${STYLE_WALK})().filter(([, , style]) => paintsRed(style));
            const label = ([element, which]) => element.tagName.toLowerCase() + "." + element.className + which;
            const step = Math.floor(innerHeight / 4);
            const maxScroll = document.documentElement.scrollHeight - innerHeight;
            const worst = [];
            for (let y = 0; ; y = Math.min(y + step, maxScroll)) {
              scrollTo(0, y);
              await new Promise(requestAnimationFrame);
              const visible = redOnes.filter(([element]) => {
                const rect = element.getBoundingClientRect();
                return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0 && rect.height > 0;
              });
              if (visible.length > 1) worst.push({ y, red: visible.map(label) });
              if (y >= maxScroll) break;
            }
            return { all: redOnes.map(label), worst };
          })(${JSON.stringify(RED)})`,
        );
        expect(result.worst).toEqual([]);
        if (path !== "/no-such-page") {
          expect(result.all.sort()).toEqual(["blockquote.pull-quote", "h1.hero-title::after"]);
        } else {
          expect(result.all).toEqual([]);
        }
      });
    }
  });
}

test("the focus ring is the only box-shadow, and it appears on :focus-visible", async ({ page }) => {
  await settle(page, "/");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({
    visible: document.activeElement.matches(":focus-visible"),
    shadow: getComputedStyle(document.activeElement).boxShadow,
  }));
  expect(focused.visible).toBe(true);
  expect(focused.shadow).toBe("rgb(250, 250, 250) 0px 0px 0px 2px, rgb(10, 10, 10) 0px 0px 0px 4px");
});

test("hover red stays on the hovered control: Primary background, Ghost underline, text never red", async ({ page }) => {
  await settle(page, "/");
  const cta = page.locator("#hero a.btn-primary");
  await cta.hover();
  await expect(cta).toHaveCSS("background-color", RED[0]);
  await expect(cta).toHaveCSS("color", "rgb(250, 250, 250)");
  await expect(cta).toHaveCSS("font-size", "16px");
  await expect(cta).toHaveCSS("font-weight", "700");
  const ghost = page.locator("header nav a").last();
  await ghost.hover();
  await expect(ghost).toHaveCSS("text-decoration-color", RED[0]);
  await expect(ghost).toHaveCSS("color", "rgb(10, 10, 10)");
});
