import { DEFAULT_LOCALE, PAGES, pageFor } from "../pages.mjs";
import { esc } from "./escape.mjs";
import { documentHtml } from "./layout.mjs";

// The 404 page cannot know the visitor's language, so it shows every locale, default first.
export function renderNotFound(contents) {
  const ordered = [pageFor(DEFAULT_LOCALE), ...PAGES.filter((page) => page.locale !== DEFAULT_LOCALE)];
  const blocks = ordered.flatMap(({ locale, path }, index) => {
    const { title, message, linkLabel } = contents[locale].notFound;
    const heading = index === 0 ? "h1" : "h2";
    return [
      `<section lang="${esc(locale)}">`,
      `<${heading}>${esc(title)}</${heading}>`,
      `<p>${esc(message)}</p>`,
      `<a href="${esc(path)}">${esc(linkLabel)}</a>`,
      "</section>",
    ];
  });
  const primary = contents[DEFAULT_LOCALE].notFound;
  return documentHtml({
    lang: DEFAULT_LOCALE,
    title: primary.title,
    description: primary.message,
    headLines: ['<meta name="robots" content="noindex">'],
    bodyLines: ["<main>", ...blocks, "</main>"],
  });
}
