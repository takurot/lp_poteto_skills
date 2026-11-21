// Renders site/static/og.png (SPEC §4, F6) with Playwright Chromium and the self-hosted fonts.
// Run by hand when the card text changes: `node scripts/generate-og.mjs`, then commit the PNG.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { OG_IMAGE } from "../site/pages.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const FONTS_DIR = path.join(repoRoot, "site/static/fonts");
const OUT_FILE = path.join(repoRoot, "site/static", OG_IMAGE.path);

const FACES = [
  { family: "Archivo Black", weight: 400, file: "archivo-black-latin-400-normal.woff2" },
  { family: "Work Sans", weight: 500, file: "work-sans-latin-500-normal.woff2" },
];

const TEXT = {
  wordmark: "POTETO-SKILLS",
  headline: "pstack for Codex",
  line: "Skills for Claude Code & Codex",
};

// Inlined as data URLs so the page needs no server. No generic fallback family: a font that fails
// to load must fail the script, not render in a system face.
function fontFace({ family, weight, file }) {
  const data = fs.readFileSync(path.join(FONTS_DIR, file)).toString("base64");
  return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url(data:font/woff2;base64,${data}) format("woff2"); }`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${FACES.map(fontFace).join("\n")}
* { margin: 0; }
body {
  width: ${OG_IMAGE.width}px; height: ${OG_IMAGE.height}px; box-sizing: border-box; padding: 80px 88px;
  display: flex; flex-direction: column; justify-content: space-between;
  background: #0A0A0A; color: #FAFAFA;
}
.wordmark { font: 400 32px/1 "Archivo Black"; letter-spacing: 0.04em; }
h1 { font: 400 128px/1.05 "Archivo Black"; letter-spacing: -0.02em; }
.rule { width: 192px; height: 12px; margin-top: 40px; background: #EF4444; }
.line { font: 500 44px/1.2 "Work Sans"; }
</style>
</head>
<body>
<p class="wordmark">${TEXT.wordmark}</p>
<div><h1>${TEXT.headline}</h1><div class="rule"></div></div>
<p class="line">${TEXT.line.replace("&", "&amp;")}</p>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: OG_IMAGE.width, height: OG_IMAGE.height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const missing = await page.evaluate(async (faces) => {
    await document.fonts.ready;
    return faces.filter(({ family, weight }) => !document.fonts.check(`${weight} 16px "${family}"`, "A")).map(({ family }) => family);
  }, FACES);
  if (missing.length > 0) throw new Error(`fonts did not load: ${missing.join(", ")}`);
  const overflow = await page.evaluate(() => document.body.scrollWidth > innerWidth || document.body.scrollHeight > innerHeight);
  if (overflow) throw new Error("card text overflows the image");
  await page.screenshot({ path: OUT_FILE, clip: { x: 0, y: 0, width: OG_IMAGE.width, height: OG_IMAGE.height } });
  console.log(`generate-og: wrote ${path.relative(repoRoot, OUT_FILE)} (${fs.statSync(OUT_FILE).size} bytes)`);
} finally {
  await browser.close();
}
