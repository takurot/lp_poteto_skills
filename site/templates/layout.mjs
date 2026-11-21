import { esc } from "./escape.mjs";

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
    '<link rel="stylesheet" href="/style.css">',
    "</head>",
    "<body>",
    ...bodyLines,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
