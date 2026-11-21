import { esc } from "./escape.mjs";

// SPEC §7: only the faces the first view renders. Fonts need crossorigin even from the same origin.
const PRELOAD_FONTS = ["/fonts/archivo-black-latin-400-normal.woff2", "/fonts/work-sans-latin-400-normal.woff2"];

// headLines and bodyLines are markup already built from esc()'d values.
export function documentHtml({ lang, title, description, headLines = [], bodyLines }) {
  return [
    "<!doctype html>",
    `<html lang="${esc(lang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    ...headLines,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    ...PRELOAD_FONTS.map((href) => `<link rel="preload" href="${esc(href)}" as="font" type="font/woff2" crossorigin>`),
    '<link rel="stylesheet" href="/style.css">',
    "</head>",
    "<body>",
    ...bodyLines,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
