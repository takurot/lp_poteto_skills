import { DEFAULT_LOCALE, PAGES, pageFor } from "../pages.mjs";
import { esc } from "./escape.mjs";
import { documentHtml } from "./layout.mjs";

// The 404 page cannot know the visitor's language, so it speaks every locale, default first, and
// offers one way out: the default home page, which links to the others.
export function renderNotFound(contents) {
  const home = pageFor(DEFAULT_LOCALE);
  const others = PAGES.filter((page) => page.locale !== DEFAULT_LOCALE);
  const primary = contents[DEFAULT_LOCALE].notFound;
  const translations = others.map(({ locale }) => ({ locale, ...contents[locale].notFound }));
  const linkLabel = [
    esc(primary.linkLabel),
    ...translations.map(({ locale, linkLabel: label }) => `<span lang="${esc(locale)}">${esc(label)}</span>`),
  ].join(" / ");
  return documentHtml({
    lang: DEFAULT_LOCALE,
    title: primary.title,
    description: primary.message,
    headLines: ['<meta name="robots" content="noindex">'],
    bodyLines: [
      '<header class="site-header">',
      '<div class="wrap bar">',
      `<p class="wordmark">${esc(contents[DEFAULT_LOCALE].header.wordmark)}</p>`,
      "</div>",
      "</header>",
      '<main class="not-found">',
      '<div class="wrap">',
      `<h1>${esc(primary.title)}</h1>`,
      `<p class="lead">${esc(primary.message)}</p>`,
      ...translations.map(({ locale, title, message }) => `<p lang="${esc(locale)}"><strong>${esc(title)}</strong> ${esc(message)}</p>`),
      `<a class="btn btn-primary" href="${esc(home.path)}">${linkLabel}</a>`,
      "</div>",
      "</main>",
    ],
  });
}
