// Renders site/static/og.png (SPEC §4, F6) with Playwright Chromium and the self-hosted fonts.
// Run by hand when the card text changes: `node scripts/generate-og.mjs`, then commit the PNG.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { OG_IMAGE } from "../site/pages.mjs";
import { esc } from "../site/templates/escape.mjs";

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
<p class="wordmark">${esc(TEXT.wordmark)}</p>
<div><h1>${esc(TEXT.headline)}</h1><div class="rule"></div></div>
<p class="line">${esc(TEXT.line)}</p>
</body>
</html>`;

// Runs in the page. Counts pixels with any hue that are not the rule's exact red inside the rule's box,
// so antialiased text stays grey and a second red element or a stray color fails the run.
async function strayColorPixels(base64) {
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const canvas = new OffscreenCanvas(img.width, img.height);
  const context = canvas.getContext("2d");
  context.drawImage(img, 0, 0);
  const data = context.getImageData(0, 0, img.width, img.height).data;
  const rule = document.querySelector(".rule").getBoundingClientRect();
  let strays = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (Math.max(r, g, b) - Math.min(r, g, b) <= 16) continue;
    const x = (i / 4) % img.width;
    const y = Math.floor(i / 4 / img.width);
    const inRule = x >= rule.left && x < rule.right && y >= rule.top && y < rule.bottom;
    if (!(inRule && r === 0xef && g === 0x44 && b === 0x44)) strays += 1;
  }
  return strays;
}

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
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: OG_IMAGE.width, height: OG_IMAGE.height } });
  const strays = await page.evaluate(strayColorPixels, png.toString("base64"));
  if (strays > 0) throw new Error(`${strays} colored pixels are not the #EF4444 rule (SPEC §4: one red line, nothing else)`);
  fs.writeFileSync(OUT_FILE, png);
  console.log(`generate-og: wrote ${path.relative(repoRoot, OUT_FILE)} (${fs.statSync(OUT_FILE).size} bytes)`);
} finally {
  await browser.close();
}
