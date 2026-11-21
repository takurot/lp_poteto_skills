// The single registry of published pages. canonical, hreflang and og:url are derived from it.
export const PAGES = [
  { locale: "en", file: "index.html", path: "/" },
  { locale: "ja", file: "ja/index.html", path: "/ja/" },
];

export const DEFAULT_LOCALE = "en";
export const NOT_FOUND_FILE = "404.html";
export const GITHUB_URL = "https://github.com/takurot/poteto-skills";

export function pageFor(locale) {
  const page = PAGES.find((candidate) => candidate.locale === locale);
  if (!page) throw new Error(`no page registered for locale ${locale}`);
  return page;
}
