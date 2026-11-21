// The single registry of published pages. canonical, hreflang and og:url are derived from it.
export const PAGES = [
  { locale: "en", file: "index.html", path: "/" },
  { locale: "ja", file: "ja/index.html", path: "/ja/" },
];

export const DEFAULT_LOCALE = "en";
export const NOT_FOUND_FILE = "404.html";
export const GITHUB_URL = "https://github.com/takurot/poteto-skills";
// scripts/generate-og.mjs renders the image at this size; the og:image:width/height tags repeat it.
export const OG_IMAGE = { path: "/og.png", width: 1200, height: 630 };

export function pageFor(locale) {
  const page = PAGES.find((candidate) => candidate.locale === locale);
  if (!page) throw new Error(`no page registered for locale ${locale}`);
  return page;
}
